import { Injectable } from '@angular/core';
import * as Phaser from 'phaser';
import {
  DecorItem,
  DecorService,
  DecorInstance
} from '../../../core/decor/decor.service';

@Injectable({
  providedIn: 'root'
})
export class DecorManagerService {
  private readonly MAX_WALLS_PER_TYPE = 50;
  private readonly MAX_ITEMS_PER_TYPE = 10;
  private readonly DECOR_SCALE = 0.25;
  private readonly DECOR_PIXEL_BLOCK_SIZE = 2;
  private readonly SELECTION_DEPTH = 9;
  private readonly TOOLBOX_DEPTH = 30;

  constructor(private decorService: DecorService) {}

  canAddMoreDecor(
    item: DecorItem,
    decorSprites: Phaser.GameObjects.Group | null
  ): boolean {
    if (!decorSprites) return true;

    const children = decorSprites.getChildren();
    if (item.category === 'wall') {
      const sameWallTypeCount = children.filter(
        (c: any) => this.getDecorId(c) === item.id
      ).length;
      return sameWallTypeCount < this.MAX_WALLS_PER_TYPE;
    } else {
      const sameItemCount = children.filter(
        (c: any) => this.getDecorId(c) === item.id
      ).length;
      return sameItemCount < this.MAX_ITEMS_PER_TYPE;
    }
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
    const initialKey = `${item.id}_${initialRotation}`;

    const loadAndAdd = () => {
      this.applyPixelFilter(scene, seKey);
      this.applyPixelFilter(scene, swKey);

      const seRenderKey = this.ensurePixelatedTexture(scene, seKey);
      const swRenderKey = this.ensurePixelatedTexture(scene, swKey);

      const initialRenderKey =
        initialRotation === 'SW' ? swRenderKey : seRenderKey;

      const sprite = scene.physics.add.sprite(x, y, initialRenderKey);
      sprite.setScale(this.DECOR_SCALE);
      sprite.setAngle(initialRotation === 'SW' ? -5 : 0);

      const newWidth = sprite.width * 0.9;
      const newHeight = sprite.height * 0.9;
      sprite.setBodySize(newWidth, newHeight);
      sprite.setOffset(
        (sprite.width - newWidth) / 2,
        (sprite.height - newHeight) / 2
      );

      sprite.setImmovable(true);
      sprite.setDepth(10);
      sprite.setData('item', item);
      sprite.setData('decorId', item.id);
      sprite.setData('decorCategory', item.category);
      sprite.setData('rotation', initialRotation);
      sprite.setData('seRenderKey', seRenderKey);
      sprite.setData('swRenderKey', swRenderKey);

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

  selectDecor(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene,
    onSelect: (sprite: Phaser.GameObjects.Sprite) => void
  ): void {
    onSelect(sprite);
    this.showSelectionFeedback(sprite, scene);
  }

  private showSelectionFeedback(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene
  ): void {
    let selectionBorder = (sprite as any).__selectionBorder;
    if (!selectionBorder) {
      selectionBorder = scene.add.graphics();
      selectionBorder.setDepth(this.SELECTION_DEPTH);
      (sprite as any).__selectionBorder = selectionBorder;
    }

    selectionBorder.clear();
    selectionBorder.lineStyle(0.5, 0x7c3aed, 0.8);

    const bounds = sprite.getBounds();
    selectionBorder.strokeRect(
      bounds.x - 2,
      bounds.y - 2,
      bounds.width + 4,
      bounds.height + 4
    );
    selectionBorder.setVisible(true);
  }

  deleteDecor(
    sprite: Phaser.GameObjects.Sprite,
    decorSprites: Phaser.GameObjects.Group
  ): void {
    const selectionBorder = (sprite as any).__selectionBorder;
    if (selectionBorder) {
      selectionBorder.destroy();
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
    sprite.setAngle(nextRotation === 'SW' ? -5 : 0);
  }

  resolveDecorOverlap(
    sprite: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene,
    decorSprites: Phaser.GameObjects.Group
  ): void {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      let overlappingItem: any = null;

      decorSprites.getChildren().forEach((item: any) => {
        if (item !== sprite) {
          (sprite.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
          (item.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
          if (scene.physics.overlap(sprite, item)) {
            overlappingItem = item;
          }
        }
      });

      if (!overlappingItem) break;

      const angle = Phaser.Math.Angle.Between(
        overlappingItem.x,
        overlappingItem.y,
        sprite.x,
        sprite.y
      );
      sprite.x += Math.cos(angle) * 3;
      sprite.y += Math.sin(angle) * 3;

      attempts++;
    }
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
    const rotateIcon = scene.add
      .image(-12, 0, 'rotate')
      .setOrigin(0.5)
      .setDisplaySize(16, 16);
    const trashIcon = scene.add
      .image(12, 0, 'trash')
      .setOrigin(0.5)
      .setDisplaySize(16, 16);

    const toolbox = scene.add.container(0, 0, [rotateIcon, trashIcon]);
    toolbox.setDepth(this.TOOLBOX_DEPTH);
    toolbox.setScale(0.3);

    rotateIcon.setInteractive({ useHandCursor: true });
    rotateIcon.on('pointerdown', (p: any, lx: any, ly: any, e: any) => {
      e.stopPropagation();
      onRotate();
    });

    trashIcon.setInteractive({ useHandCursor: true });
    trashIcon.on('pointerdown', (p: any, lx: any, ly: any, e: any) => {
      e.stopPropagation();
      onDelete();
    });

    return toolbox;
  }
}
