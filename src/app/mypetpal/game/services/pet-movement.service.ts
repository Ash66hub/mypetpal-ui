import { Injectable } from '@angular/core';
import { DecorManagerService } from './decor-manager.service';
import * as Phaser from 'phaser';

@Injectable({
  providedIn: 'root'
})
export class PetMovementService {
  private readonly STEP_DISTANCE = 4.4;
  private readonly MOVE_DURATION = 150;
  private readonly PET_COLLISION_RADIUS = 2;
  private readonly DEPTH_SCALE = 0.01;
  private readonly PET_FOOT_OFFSET_FACTOR = 0.35;
  private readonly MIN_ZOOM = 2;
  private readonly MAX_ZOOM = 12.0;
  private readonly ZOOM_STEP = 0.5;
  private readonly ZOOM_DURATION = 200;

  // Cache for decor pixel masks (keyed by texture+frame)
  private decorPixelMaskCache: Record<string, Uint8Array | undefined> = {};

  constructor(private decorManagerService: DecorManagerService) {}

  // Helper to get or generate the pixel mask for a decor
  private getDecorPixelMask(
    scene: Phaser.Scene,
    decor: Phaser.GameObjects.Sprite
  ): { mask: Uint8Array; width: number; height: number } | undefined {
    const textureKey = decor.texture.key;
    const frameName =
      decor.frame && (decor.frame as any).name !== undefined
        ? (decor.frame as any).name
        : undefined;
    const cacheKey = frameName ? `${textureKey}:${frameName}` : textureKey;

    if (this.decorPixelMaskCache[cacheKey]) {
      const mask = this.decorPixelMaskCache[cacheKey]!;
      const tex = scene.textures.get(textureKey);
      const frame = frameName ? tex.get(frameName) : tex.get('__BASE');
      const width = frame.width || (frame as any).naturalWidth;
      const height = frame.height || (frame as any).naturalHeight;
      return { mask, width, height };
    }

    // Generate mask
    const tex = scene.textures.get(textureKey);
    let sourceImage: HTMLImageElement | HTMLCanvasElement | undefined;

    if (frameName && tex.get(frameName)) {
      // Create a canvas for the frame
      const frame = tex.get(frameName);
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(
        tex.getSourceImage() as any,
        frame.cutX,
        frame.cutY,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height
      );
      sourceImage = canvas;
    } else {
      sourceImage = tex.getSourceImage() as
        | HTMLImageElement
        | HTMLCanvasElement;
    }

    if (!sourceImage) return undefined;

    const width = sourceImage.width;
    const height = sourceImage.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(sourceImage, 0, 0);

    const data = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      mask[i] = data[i * 4 + 3]; // alpha channel
    }

    this.decorPixelMaskCache[cacheKey] = mask;
    return { mask, width, height };
  }

  moveStep(
    dog: Phaser.Physics.Arcade.Sprite,
    direction: string,
    isMoving: boolean,
    onMoveComplete: () => void,
    isInsideFloor: (x: number, y: number) => boolean,
    isCollidingWithDecor: (x: number, y: number) => boolean,
    isCollidingWithRemotePets: (x: number, y: number) => boolean
  ): void {
    if (isMoving || !dog) return;

    let targetX = dog.x;
    let targetY = dog.y;

    switch (direction) {
      case 'up':
        targetY -= this.STEP_DISTANCE;
        break;
      case 'down':
        targetY += this.STEP_DISTANCE;
        break;
      case 'left':
        targetX -= this.STEP_DISTANCE;
        break;
      case 'right':
        targetX += this.STEP_DISTANCE;
        break;
    }

    if (
      isInsideFloor(targetX, targetY) &&
      !isCollidingWithDecor(targetX, targetY) &&
      !isCollidingWithRemotePets(targetX, targetY)
    ) {
      const scene = dog.scene;
      scene.tweens.add({
        targets: dog,
        x: targetX,
        y: targetY,
        duration: this.MOVE_DURATION,
        ease: 'Cubic.easeOut',
        onComplete: onMoveComplete
      });
    }
  }

  isCollidingWithRemotePets(
    x: number,
    y: number,
    remotePets: Map<string, Phaser.GameObjects.Sprite>
  ): boolean {
    if (!remotePets || remotePets.size === 0) return false;

    for (const remotePet of Array.from(remotePets.values())) {
      const dist = Phaser.Math.Distance.Between(x, y, remotePet.x, remotePet.y);
      if (dist < this.PET_COLLISION_RADIUS) {
        return true;
      }
    }
    return false;
  }

  isCollidingWithDecor(
    x: number,
    y: number,
    dog: Phaser.Physics.Arcade.Sprite,
    decorSprites: Phaser.GameObjects.Group | null,
    scene: Phaser.Scene
  ): boolean {
    if (!decorSprites || !dog) return false;

    const centerX = x;
    const centerY = y;
    const projectedPetDepth =
      (y + dog.displayHeight * this.PET_FOOT_OFFSET_FACTOR) * this.DEPTH_SCALE;

    const haloScale =
      (this.decorManagerService as any)['SELECTION_HALO_SCALE'] || 1.04;

    for (const child of decorSprites.getChildren()) {
      const decor = child as Phaser.GameObjects.Sprite;
      // Skip collision for 'Open Doorway' (id: 'w11')
      if (decor.getData && decor.getData('decorId') === 'w11') {
        continue;
      }
      // If pet is visually behind this decor, do not treat it as blocking.
      if (projectedPetDepth < decor.depth) {
        continue;
      }

      // Pixel-perfect collision: transform pet position to decor local image space
      const maskInfo = this.getDecorPixelMask(scene, decor);
      if (!maskInfo) continue;
      const { mask, width, height } = maskInfo;

      // Inverse transform: world -> decor local
      const mat = new Phaser.GameObjects.Components.TransformMatrix();
      mat.applyITRS(
        decor.x,
        decor.y,
        decor.rotation,
        decor.scaleX * haloScale,
        decor.scaleY * haloScale
      );

      // Account for origin and flip
      let local = mat.applyInverse(centerX, centerY);

      // Offset for origin (Phaser's local coordinate system starts from the center usually, but depends on how you use it)
      local.x += width * decor.originX;
      local.y += height * decor.originY;

      if (decor.flipX) local.x = width - local.x;
      if (decor.flipY) local.y = height - local.y;

      // Check if inside image bounds
      const lx = Math.round(local.x);
      const ly = Math.round(local.y);
      let hit = false;
      if (lx >= 0 && lx < width && ly >= 0 && ly < height) {
        if (mask[ly * width + lx] > 10) hit = true;
      }

      if (hit) {
        return true;
      }
    }

    return false;
  }

  zoomIn(currentZoom: number): number {
    return Math.min(currentZoom + this.ZOOM_STEP, this.MAX_ZOOM);
  }

  zoomOut(currentZoom: number): number {
    return Math.max(currentZoom - this.ZOOM_STEP, this.MIN_ZOOM);
  }

  applyZoom(
    scene: Phaser.Scene,
    targetZoom: number,
    onComplete: () => void
  ): void {
    scene.tweens.add({
      targets: scene.cameras.main,
      zoom: targetZoom,
      duration: this.ZOOM_DURATION,
      ease: 'Power2',
      onComplete
    });
  }

  createArrows(
    scene: Phaser.Scene,
    petX: number,
    petY: number,
    arrowOffset: number,
    onArrowClick: (direction: string) => void
  ): Phaser.GameObjects.Container[] {
    const arrows: Phaser.GameObjects.Container[] = [];
    const directions = [
      { dir: 'up', ox: 0, oy: -arrowOffset, angle: 0 },
      { dir: 'down', ox: 0, oy: arrowOffset, angle: 180 },
      { dir: 'left', ox: -arrowOffset, oy: 0, angle: 270 },
      { dir: 'right', ox: arrowOffset, oy: 0, angle: 90 }
    ];

    directions.forEach(({ dir, ox, oy, angle }) => {
      const arrow = this.createArrowContainer(
        scene,
        petX + ox,
        petY + oy,
        angle,
        dir,
        onArrowClick
      );
      arrows.push(arrow);
    });

    return arrows;
  }

  private createArrowContainer(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    direction: string,
    onArrowClick: (dir: string) => void
  ): Phaser.GameObjects.Container {
    const graphics = scene.add.graphics();
    const radius = 7;

    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(-radius, radius * 0.7);
    graphics.lineTo(radius, radius * 0.7);
    graphics.lineTo(0, -radius);
    graphics.closePath();
    graphics.fillPath();

    const container = scene.add.container(x, y, [graphics]);
    container.setAngle(angle);
    container.setAlpha(0);
    container.setDepth(15);

    const hitArea = new Phaser.Geom.Circle(0, 0, 18);
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => onArrowClick(direction));

    return container;
  }
}
