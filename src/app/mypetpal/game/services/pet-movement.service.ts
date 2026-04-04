import { Injectable } from '@angular/core';
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

    for (const child of decorSprites.getChildren()) {
      const decor = child as Phaser.GameObjects.Sprite;
      const body = (child as any).body as
        | Phaser.Physics.Arcade.Body
        | undefined;
      if (!body) {
        continue;
      }

      // If pet is visually behind this decor, do not treat it as blocking.
      if (projectedPetDepth < decor.depth) {
        continue;
      }

      body.updateFromGameObject();

      const nearestX = Phaser.Math.Clamp(centerX, body.x, body.right);
      const nearestY = Phaser.Math.Clamp(centerY, body.y, body.bottom);
      const dist = Phaser.Math.Distance.Between(
        centerX,
        centerY,
        nearestX,
        nearestY
      );

      if (dist < this.PET_COLLISION_RADIUS) {
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
