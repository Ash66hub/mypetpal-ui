import { Injectable } from '@angular/core';
import * as Phaser from 'phaser';
import {
  DecorItem,
  DecorService,
  DecorInstance
} from '../../../core/decor/decor.service';
import { DebugService } from '../../../core/debug/debug.service';

@Injectable({
  providedIn: 'root'
})
export class DecorManagerService {
  private readonly DECOR_SCALE = 0.25;
  private readonly DECOR_PIXEL_BLOCK_SIZE = 1;
  private readonly SW_HORIZONTAL_SKEW_DEGREES = 15;
  private readonly SE_WALL_HORIZONTAL_SKEW_DEGREES = -5;
  private readonly SE_LEFT_TILT_ANGLE = 2;
  private readonly SW_LEFT_TILT_ANGLE = -13;
  private readonly SE_WALL_RIGHT_TILT_ANGLE = 7;
  private readonly LOUNGE_SOFA_CORNER_SW_RIGHT_TILT_ANGLE = -5;
  private readonly LOUNGE_SOFA_CORNER_DECOR_ID = 'f19';
  private readonly BED_SW_RIGHT_TILT_ANGLE = 2;
  private readonly BED_SW_HORIZONTAL_SKEW_DEGREES = -5;
  private readonly BED_DECOR_ID = 'f5';
  private readonly SELECTION_DEPTH = 9;
  private readonly SELECTION_HALO_SCALE = 1.04;
  private readonly SELECTION_HALO_ALPHA = 0.45;
  private readonly SELECTION_HALO_COLOR = 0x7c3aed;
  private readonly TOOLBOX_DEPTH = 30;
  private readonly ALPHA_THRESHOLD = 10;
  private readonly WALL_OVERLAP_RATIO = 0.5;
  private readonly MIXED_WALL_OVERLAP_RATIO = 0.5;
  private readonly DECOR_WALL_OVERLAP_RATIO = 0.5;
  private readonly GENERAL_OVERLAP_RATIO = 0.5;
  private readonly opaqueBoundsCache = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  private debugGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private decorService: DecorService,
    private debugService: DebugService
  ) {}

  canAddMoreDecor(
    item: DecorItem,
    decorSprites: Phaser.GameObjects.Group | null
  ): boolean {
    if (!decorSprites) return true;

    const children = decorSprites.getChildren();
    const sameTypeCount = children.filter(
      (c: any) => this.getDecorId(c) === item.id
    ).length;

    return sameTypeCount < this.getLimitForItem(item);
  }

  getLimitForItem(item: DecorItem): number {
    return this.decorService.getLimitForItem(item);
  }

  addDecorToGame(
    scene: Phaser.Scene,
    item: DecorItem,
    x: number,
    y: number,
    initialRotation: string = 'SE',
    onSpriteAdded?: (sprite: Phaser.Physics.Arcade.Sprite) => void
  ): void {
    const seKey = `${item.id}_SE`;
    const swKey = `${item.id}_SW`;

    const loadAndAdd = () => {
      this.applyPixelFilter(scene, seKey);
      this.applyPixelFilter(scene, swKey);

      const seRenderKey = this.ensurePixelatedTexture(scene, seKey);
      const swRenderKey = this.ensurePixelatedTexture(scene, swKey);
      const swSkewRenderKey = this.ensureHorizontallySkewedTexture(
        scene,
        swRenderKey,
        this.SW_HORIZONTAL_SKEW_DEGREES
      );
      const bedSwSkewRenderKey = this.ensureHorizontallySkewedTexture(
        scene,
        swRenderKey,
        this.BED_SW_HORIZONTAL_SKEW_DEGREES
      );
      const swEffectiveRenderKey =
        (item.id === this.BED_DECOR_ID || item.id === 'f61')
          ? bedSwSkewRenderKey
          : swSkewRenderKey;
      const seWallSkewRenderKey = this.ensureHorizontallySkewedTexture(
        scene,
        seRenderKey,
        this.SE_WALL_HORIZONTAL_SKEW_DEGREES
      );
      const seEffectiveRenderKey =
        item.category === 'wall' ? seWallSkewRenderKey : seRenderKey;

      const initialRenderKey =
        initialRotation === 'SW' ? swEffectiveRenderKey : seEffectiveRenderKey;

      const sprite = scene.physics.add.sprite(x, y, initialRenderKey);
      sprite.setScale(this.DECOR_SCALE);
      sprite.setAngle(
        this.getAngleForRotation(initialRotation, item.id, item.category)
      );
      this.applyOpaqueCollisionBounds(scene, sprite, initialRenderKey);

      sprite.setImmovable(true);
      const isRug = item.name.toLowerCase().includes('rug') || item.id.toLowerCase().startsWith('rug') || item.imagePath.toLowerCase().includes('rug');
      sprite.setDepth(isRug ? 0.001 : 10);
      sprite.setData('item', item);
      sprite.setData('decorId', item.id);
      sprite.setData('decorCategory', item.category);
      sprite.setData('rotation', initialRotation);
      sprite.setData('seRenderKey', seEffectiveRenderKey);
      sprite.setData('swRenderKey', swEffectiveRenderKey);

      if (onSpriteAdded) {
        onSpriteAdded(sprite);
      }
    };

    const sePath = item.imagePath.startsWith('/')
      ? item.imagePath
      : `/${item.imagePath}`;

    if (!scene.textures.exists(seKey)) {
      scene.load.image(seKey, sePath);
      const swPath = sePath.replace('_SE.png', '_SW.png');
      scene.load.image(swKey, swPath);

      scene.load.once('complete', loadAndAdd);
      scene.load.start();
    } else {
      loadAndAdd();
    }
  }

  private applyPixelFilter(scene: Phaser.Scene, textureKey: string): void {
    const texture = scene.textures.get(textureKey);
    if (!texture) return;

    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private ensurePixelatedTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): string {
    const pixelKey = `${textureKey}_px`;
    if (scene.textures.exists(pixelKey)) {
      return pixelKey;
    }

    const texture = scene.textures.get(textureKey);
    const sourceImage = texture?.getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;

    if (!sourceImage) {
      return textureKey;
    }

    const width = sourceImage.width;
    const height = sourceImage.height;
    const block = this.DECOR_PIXEL_BLOCK_SIZE;

    const downW = Math.max(1, Math.floor(width / block));
    const downH = Math.max(1, Math.floor(height / block));

    const tiny = document.createElement('canvas');
    tiny.width = downW;
    tiny.height = downH;
    const tinyCtx = tiny.getContext('2d');

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const outCtx = output.getContext('2d');

    if (!tinyCtx || !outCtx) {
      return textureKey;
    }

    tinyCtx.imageSmoothingEnabled = false;
    outCtx.imageSmoothingEnabled = false;

    tinyCtx.clearRect(0, 0, downW, downH);
    tinyCtx.drawImage(sourceImage, 0, 0, downW, downH);

    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(tiny, 0, 0, downW, downH, 0, 0, width, height);

    scene.textures.addCanvas(pixelKey, output);
    this.applyPixelFilter(scene, pixelKey);

    return pixelKey;
  }

  private ensureHorizontallySkewedTexture(
    scene: Phaser.Scene,
    textureKey: string,
    skewDegrees: number
  ): string {
    const skewKey = `${textureKey}_skx${skewDegrees}`;
    if (scene.textures.exists(skewKey)) {
      return skewKey;
    }

    const texture = scene.textures.get(textureKey);
    const sourceImage = texture?.getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;

    if (!sourceImage) {
      return textureKey;
    }

    const width = sourceImage.width;
    const height = sourceImage.height;
    const shear = Math.tan(Phaser.Math.DegToRad(skewDegrees));
    const shearX = -shear * height;
    const minShift = Math.min(0, shearX);
    const maxShift = Math.max(0, shearX);
    const translateX = -minShift;

    const output = document.createElement('canvas');
    output.width = Math.ceil(width + (maxShift - minShift));
    output.height = height;
    const ctx = output.getContext('2d');

    if (!ctx) {
      return textureKey;
    }

    ctx.imageSmoothingEnabled = false;

    // Positive skew pulls the top toward the right; negative pulls it toward the left.
    ctx.setTransform(1, 0, -shear, 1, translateX, 0);
    ctx.drawImage(sourceImage, 0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    scene.textures.addCanvas(skewKey, output);
    this.applyPixelFilter(scene, skewKey);

    return skewKey;
  }

  selectDecor(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene,
    onSelect: (sprite: Phaser.GameObjects.Sprite) => void
  ): void {
    onSelect(sprite);
    this.showSelectionFeedback(sprite, scene);
  }

  refreshSelectionFeedback(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene
  ): void {
    this.showSelectionFeedback(sprite, scene);
  }

  private showSelectionFeedback(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene
  ): void {
    let selectionOverlay = (sprite as any).__selectionOverlay as
      | Phaser.GameObjects.Image
      | undefined;
    if (!selectionOverlay) {
      selectionOverlay = scene.add.image(
        sprite.x,
        sprite.y,
        sprite.texture.key
      );
      (sprite as any).__selectionOverlay = selectionOverlay;
    }

    const frameName = (sprite.frame as any)?.name;
    if (frameName !== undefined && frameName !== null) {
      selectionOverlay.setTexture(sprite.texture.key, frameName);
    } else {
      selectionOverlay.setTexture(sprite.texture.key);
    }

    const item = sprite.getData('item') as DecorItem | undefined;
    const isRug = item?.name.toLowerCase().includes('rug') || item?.imagePath.toLowerCase().includes('rug');

    selectionOverlay
      .setPosition(sprite.x, sprite.y)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(
        sprite.scaleX * this.SELECTION_HALO_SCALE,
        sprite.scaleY * this.SELECTION_HALO_SCALE
      )
      .setAngle(sprite.angle)
      .setAlpha(this.SELECTION_HALO_ALPHA)
      .setTint(this.SELECTION_HALO_COLOR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(isRug ? 0.005 : this.SELECTION_DEPTH)
      .setVisible(true);

    selectionOverlay.setFlip(sprite.flipX, sprite.flipY);

    // Backward compatibility: if an older rectangular border exists, hide it.
    const selectionBorder = (sprite as any).__selectionBorder as
      | Phaser.GameObjects.Graphics
      | undefined;
    if (selectionBorder) {
      selectionBorder.setVisible(false);
    }
  }

  deleteDecor(
    sprite: Phaser.GameObjects.Sprite,
    decorSprites: Phaser.GameObjects.Group
  ): void {
    const selectionBorder = (sprite as any).__selectionBorder;
    if (selectionBorder) {
      selectionBorder.destroy();
    }

    const selectionOverlay = (sprite as any).__selectionOverlay;
    if (selectionOverlay) {
      selectionOverlay.destroy();
    }

    decorSprites.remove(sprite);
    sprite.destroy();
  }

  toggleRotation(sprite: Phaser.GameObjects.Sprite): void {
    const currentRotation = sprite.getData('rotation');
    const nextRotation = currentRotation === 'SE' ? 'SW' : 'SE';
    const seRenderKey = sprite.getData('seRenderKey');
    const swRenderKey = sprite.getData('swRenderKey');
    const nextKey = nextRotation === 'SW' ? swRenderKey : seRenderKey;

    sprite.setTexture(nextKey);
    sprite.setData('rotation', nextRotation);
    sprite.setAngle(
      this.getAngleForRotation(
        nextRotation,
        sprite.getData('decorId'),
        sprite.getData('decorCategory')
      )
    );
    this.applyOpaqueCollisionBounds(
      sprite.scene,
      sprite as Phaser.Physics.Arcade.Sprite,
      nextKey
    );
  }

  private applyOpaqueCollisionBounds(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Arcade.Sprite,
    textureKey: string
  ): void {
    const bounds = this.getOpaqueBounds(scene, textureKey);

    // Shrink the body by the overlap ratio so the debug bounds
    // reflect the actual effective collision area.
    const shrinkX = bounds.width * this.GENERAL_OVERLAP_RATIO * 0.5;
    const shrinkY = bounds.height * this.GENERAL_OVERLAP_RATIO * 0.5;
    const effectiveWidth = Math.max(1, bounds.width - shrinkX * 2);
    const effectiveHeight = Math.max(1, bounds.height - shrinkY * 2);

    sprite.setBodySize(effectiveWidth, effectiveHeight);
    sprite.setOffset(bounds.x + shrinkX, bounds.y + shrinkY);
  }

  private getOpaqueBounds(
    scene: Phaser.Scene,
    textureKey: string
  ): { x: number; y: number; width: number; height: number } {
    const cached = this.opaqueBoundsCache.get(textureKey);
    if (cached) {
      return cached;
    }

    const texture = scene.textures.get(textureKey);
    const sourceImage = texture?.getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement
      | undefined;

    if (!sourceImage) {
      const fallback = { x: 0, y: 0, width: 1, height: 1 };
      this.opaqueBoundsCache.set(textureKey, fallback);
      return fallback;
    }

    const width = sourceImage.width;
    const height = sourceImage.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallback = { x: 0, y: 0, width, height };
      this.opaqueBoundsCache.set(textureKey, fallback);
      return fallback;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceImage, 0, 0, width, height);

    const data = ctx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > this.ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const resolved =
      maxX >= minX && maxY >= minY
        ? {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
          }
        : { x: 0, y: 0, width, height };

    this.opaqueBoundsCache.set(textureKey, resolved);
    return resolved;
  }

  private getAngleForRotation(
    rotation: string,
    decorId?: string,
    decorCategory?: string
  ): number {
    if (rotation === 'SW') {
      if (decorId === this.LOUNGE_SOFA_CORNER_DECOR_ID) {
        return this.LOUNGE_SOFA_CORNER_SW_RIGHT_TILT_ANGLE;
      }

      return (decorId === this.BED_DECOR_ID || decorId === 'f61')
        ? this.BED_SW_RIGHT_TILT_ANGLE
        : this.SW_LEFT_TILT_ANGLE;
    }

    if (rotation === 'SE') {
      if (decorCategory === 'wall') {
        return this.SE_WALL_RIGHT_TILT_ANGLE;
      }

      return (decorId === this.BED_DECOR_ID || decorId === 'f61') ? -4 : this.SE_LEFT_TILT_ANGLE;
    }

    return 0;
  }

  resolveDecorOverlap(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene,
    decorSprites: Phaser.GameObjects.Group
  ): void {
    const movingSprite = sprite as Phaser.Physics.Arcade.Sprite;
    const movingBody = movingSprite.body as Phaser.Physics.Arcade.Body | null;
    if (!movingBody) {
      return;
    }

    const isMovingWall = this.isWallDecor(movingSprite);

    let attempts = 0;
    const maxAttempts = 60;
    const defaultEdgePadding = 0;

    while (attempts < maxAttempts) {
      movingBody.updateFromGameObject();

      let separatedThisPass = false;

      for (const item of decorSprites.getChildren()) {
        if (item === sprite) continue;

        const otherSprite = item as Phaser.Physics.Arcade.Sprite;
        
        // Rugs don't cause or receive push-back
        const isRug = (sprite.getData('item') as DecorItem)?.name.toLowerCase().includes('rug');
        const isOtherRug = (otherSprite.getData('item') as DecorItem)?.name.toLowerCase().includes('rug');
        if (isRug || isOtherRug) continue;

        const otherBody = otherSprite.body as Phaser.Physics.Arcade.Body | null;
        if (!otherBody) continue;

        const isOtherWall = this.isWallDecor(otherSprite);
        const movingRotation =
          (movingSprite.getData('rotation') as string) || '';
        const otherRotation = (otherSprite.getData('rotation') as string) || '';
        const wallPair = isMovingWall && isOtherWall;
        const decorWallPair =
          (isMovingWall && !isOtherWall) || (!isMovingWall && isOtherWall);
        if (wallPair) {
          continue;
        }
        const sameWallOrientation =
          wallPair && movingRotation === otherRotation;
        const mixedWallPair = wallPair && movingRotation !== otherRotation;
        // Bodies are already shrunk by the general overlap ratio,
        // so no additional negative padding is needed.
        const edgePadding = 0;

        otherBody.updateFromGameObject();

        const isOverlapping =
          movingBody.right > otherBody.x &&
          movingBody.x < otherBody.right &&
          movingBody.bottom > otherBody.y &&
          movingBody.y < otherBody.bottom;

        if (!isOverlapping) continue;

        if (decorWallPair) {
          const wallSprite = isMovingWall ? movingSprite : otherSprite;
          const decorSprite = isMovingWall ? otherSprite : movingSprite;

          // If decor is visually behind the wall, allow overlap without pushback.
          if (decorSprite.depth < wallSprite.depth) {
            continue;
          }
        }

        const moveLeft = otherBody.x - movingBody.right - edgePadding;
        const moveRight = otherBody.right - movingBody.x + edgePadding;
        const moveUp = otherBody.y - movingBody.bottom - edgePadding;
        const moveDown = otherBody.bottom - movingBody.y + edgePadding;

        const candidates = [
          { axis: 'x' as const, delta: moveLeft },
          { axis: 'x' as const, delta: moveRight },
          { axis: 'y' as const, delta: moveUp },
          { axis: 'y' as const, delta: moveDown }
        ];

        const best = candidates.reduce((prev, curr) =>
          Math.abs(curr.delta) < Math.abs(prev.delta) ? curr : prev
        );

        if (best.axis === 'x') {
          sprite.x += best.delta;
        } else {
          sprite.y += best.delta;
        }

        movingBody.updateFromGameObject();
        separatedThisPass = true;
        break;
      }

      if (!separatedThisPass) {
        break;
      }

      attempts++;
    }
  }

  private isWallDecor(sprite: Phaser.GameObjects.Sprite): boolean {
    const category =
      ((sprite as any).getData?.('decorCategory') as string) || '';
    if (category === 'wall') {
      return true;
    }

    const decorId = ((sprite as any).getData?.('decorId') as string) || '';
    if (decorId.toLowerCase().startsWith('w')) {
      return true;
    }

    const item = (sprite as any).getData?.('item') as DecorItem | undefined;
    const name = item?.name?.toLowerCase() || '';
    return name.includes('wall');
  }

  updateDecorPreview(
    scene: Phaser.Scene,
    ghost: Phaser.Physics.Arcade.Sprite,
    item: DecorItem,
    worldX: number,
    worldY: number,
    rotation: string = 'SE',
    isValid: boolean
  ): void {
    const seKey = `${item.id}_SE`;
    const swKey = `${item.id}_SW`;

    // Ensure assets are loaded for the ghost
    if (!scene.textures.exists(seKey)) {
      scene.load.image(seKey, item.imagePath);
      const swPath = item.imagePath.replace('_SE.png', '_SW.png');
      scene.load.image(swKey, swPath);
      scene.load.start();
      return; 
    }

    const seRenderKey = this.ensurePixelatedTexture(scene, seKey);
    const swRenderKey = this.ensurePixelatedTexture(scene, swKey);
    
    // Simplified key rotation logic for preview
    const swSkewRenderKey = this.ensureHorizontallySkewedTexture(scene, swRenderKey, this.SW_HORIZONTAL_SKEW_DEGREES);
    const bedSwSkewRenderKey = this.ensureHorizontallySkewedTexture(scene, swRenderKey, this.BED_SW_HORIZONTAL_SKEW_DEGREES);
    const swKeyEff = (item.id === this.BED_DECOR_ID || item.id === 'f61') ? bedSwSkewRenderKey : swSkewRenderKey;
    
    const seWallSkewRenderKey = this.ensureHorizontallySkewedTexture(scene, seRenderKey, this.SE_WALL_HORIZONTAL_SKEW_DEGREES);
    const seKeyEff = item.category === 'wall' ? seWallSkewRenderKey : seRenderKey;

    const textureKey = rotation === 'SW' ? swKeyEff : seKeyEff;
    
    ghost.setTexture(textureKey);
    ghost.setPosition(worldX, worldY);
    ghost.setScale(this.DECOR_SCALE);
    ghost.setAngle(this.getAngleForRotation(rotation, item.id, item.category));
    ghost.setAlpha(0.6);
    ghost.setDepth(100); 
    ghost.setVisible(true);
    ghost.setData('item', item);
    ghost.setData('rotation', rotation);

    if (!isValid) {
      ghost.setTint(0xff0000);
    } else {
      ghost.clearTint();
    }
    
    this.applyOpaqueCollisionBounds(scene, ghost, textureKey);
  }

  checkDecorOverlap(
    sprite: Phaser.Physics.Arcade.Sprite,
    decorSprites: Phaser.GameObjects.Group
  ): boolean {
    const movingBody = sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!movingBody) return false;

    movingBody.updateFromGameObject();

    const isMovingWall = this.isWallDecor(sprite);
    const movingRotation = (sprite.getData('rotation') as string) || '';
    const movingItem = sprite.getData('item') as DecorItem | undefined;
    const isMovingRug = movingItem?.name.toLowerCase().includes('rug') || movingItem?.imagePath.toLowerCase().includes('rug');

    if (isMovingRug) return false;

    for (const item of decorSprites.getChildren()) {
      if (item === sprite) continue;

      const otherSprite = item as Phaser.Physics.Arcade.Sprite;
      const otherItem = otherSprite.getData('item') as DecorItem | undefined;
      const isOtherRug = otherItem?.name.toLowerCase().includes('rug') || otherItem?.imagePath.toLowerCase().includes('rug');
      
      if (isOtherRug) continue;

      const otherBody = otherSprite.body as Phaser.Physics.Arcade.Body | null;
      if (!otherBody) continue;

      const isOtherWall = this.isWallDecor(otherSprite);
      const otherRotation = (otherSprite.getData('rotation') as string) || '';
      
      const wallPair = isMovingWall && isOtherWall;
      const decorWallPair = (isMovingWall && !isOtherWall) || (!isMovingWall && isOtherWall);

      if (wallPair) continue;

      otherBody.updateFromGameObject();

      const isOverlapping =
        movingBody.right > otherBody.x &&
        movingBody.x < otherBody.right &&
        movingBody.bottom > otherBody.y &&
        movingBody.y < otherBody.bottom;

      if (!isOverlapping) continue;

      if (decorWallPair) {
        const wallSprite = isMovingWall ? sprite : otherSprite;
        const decorSprite = isMovingWall ? otherSprite : sprite;

        // If decor is visually behind the wall, allow overlap.
        if (decorSprite.depth < wallSprite.depth) {
          continue;
        }
      }

      return true;
    }

    return false;
  }

  refreshDecorCounts(decorSprites: Phaser.GameObjects.Group | null): void {
    if (!decorSprites) return;

    const counts: Record<string, number> = {};
    decorSprites.getChildren().forEach((child: any) => {
      const id = this.getDecorId(child);
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });

    this.decorService.activeCounts.set(counts);
  }

  clearAllDecor(decorSprites: Phaser.GameObjects.Group | null): void {
    if (!decorSprites) {
      this.decorService.activeCounts.set({});
      return;
    }

    decorSprites.getChildren().forEach((child: any) => {
      const border = (child as any).__selectionBorder;
      if (border) border.destroy();
      const overlay = (child as any).__selectionOverlay;
      if (overlay) overlay.destroy();
      child.destroy();
    });

    decorSprites.clear(true, true);
    this.decorService.activeCounts.set({});
  }

  getDecorInstances(
    decorSprites: Phaser.GameObjects.Group | null,
    userId: number
  ): DecorInstance[] {
    if (!decorSprites) return [];

    return decorSprites
      .getChildren()
      .map((child: any) => {
        const decorId = this.getDecorId(child);
        if (!decorId) return null;

        return {
          userId,
          decorId,
          x: child.x,
          y: child.y,
          rotation: child.getData('rotation')
        } as DecorInstance;
      })
      .filter((instance): instance is DecorInstance => instance !== null);
  }

  private getDecorId(sprite: Phaser.GameObjects.GameObject): string {
    const textureKey = (sprite as any).texture?.key as string | undefined;
    if (textureKey) {
      const match = textureKey.match(/^([a-z]\d+)_/i);
      if (match?.[1]) {
        return match[1].toLowerCase();
      }
    }

    const directId = (sprite as any).getData?.('decorId');
    if (directId) return directId;

    const item = (sprite as any).getData?.('item');
    return item?.id || '';
  }

  restoreDecorSnapshot(
    scene: Phaser.Scene,
    instances: DecorInstance[],
    onDecorAdded: (
      item: DecorItem,
      x: number,
      y: number,
      rotation: string
    ) => void
  ): void {
    instances.forEach(instance => {
      const item = this.decorService
        .items()
        .find(i => i.id === instance.decorId);
      if (item) {
        onDecorAdded(item, instance.x, instance.y, instance.rotation);
      }
    });
  }

  setupDecorToolbox(
    scene: Phaser.Scene,
    onRotate: () => void,
    onDelete: () => void
  ): Phaser.GameObjects.Container {
    const iconSize = 48;

    const rotateIcon = scene.add
      .image(-32, 0, 'rotate')
      .setOrigin(0.5)
      .setDisplaySize(iconSize, iconSize);
    const trashIcon = scene.add
      .image(32, 0, 'trash')
      .setOrigin(0.5)
      .setDisplaySize(iconSize, iconSize);

    const toolbox = scene.add.container(0, 0, [rotateIcon, trashIcon]);
    toolbox.setDepth(this.TOOLBOX_DEPTH);
    toolbox.setScale(0.3);

    rotateIcon.setInteractive({ useHandCursor: true });
    rotateIcon.on('pointerdown', (p: any, lx: any, ly: any, e: any) => {
      e.stopPropagation();
      onRotate();
    });
    rotateIcon.on('pointerup', (p: any, lx: any, ly: any, e: any) => {
      e.stopPropagation();
    });

    trashIcon.setInteractive({ useHandCursor: true });
    trashIcon.on('pointerdown', (p: any, lx: any, ly: any, e: any) => {
      e.stopPropagation();
      onDelete();
    });
    trashIcon.on('pointerup', (p: any, lx: any, ly: any, e: any) => {
      e.stopPropagation();
    });

    return toolbox;
  }

  drawDebugBounds(
    scene: Phaser.Scene,
    decorSprites: Phaser.GameObjects.Group | null
  ): void {
    if (!this.debugService.debugMode) {
      if (this.debugGraphics) {
        this.debugGraphics.clear();
      }
      return;
    }

    if (!decorSprites) return;

    if (!this.debugGraphics) {
      this.debugGraphics = scene.add.graphics();
    }
    this.debugGraphics.clear();
    this.debugGraphics.setDepth(999);

    for (const child of decorSprites.getChildren()) {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      const textureKey = sprite.texture.key;
      const bounds = this.opaqueBoundsCache.get(textureKey);
      if (!bounds) continue;

      // Calculate the four corners of the opaque bounds in local space
      // (relative to sprite origin)
      const originX = sprite.originX * sprite.width;
      const originY = sprite.originY * sprite.height;

      const localX = bounds.x - originX;
      const localY = bounds.y - originY;

      const corners = [
        { x: localX, y: localY },
        { x: localX + bounds.width, y: localY },
        { x: localX + bounds.width, y: localY + bounds.height },
        { x: localX, y: localY + bounds.height }
      ];

      // Transform each corner by the sprite's scale and rotation
      const cos = Math.cos(sprite.rotation);
      const sin = Math.sin(sprite.rotation);
      const sx = sprite.scaleX;
      const sy = sprite.scaleY;

      const worldCorners = corners.map(c => {
        const scaledX = c.x * sx;
        const scaledY = c.y * sy;
        return {
          x: sprite.x + (scaledX * cos - scaledY * sin),
          y: sprite.y + (scaledX * sin + scaledY * cos)
        };
      });

      // Draw the rotated rectangle
      this.debugGraphics.lineStyle(1, 0x00ff00, 0.8);
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(worldCorners[0].x, worldCorners[0].y);
      for (let i = 1; i < worldCorners.length; i++) {
        this.debugGraphics.lineTo(worldCorners[i].x, worldCorners[i].y);
      }
      this.debugGraphics.closePath();
      this.debugGraphics.strokePath();
    }
  }
}

