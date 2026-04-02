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
  private readonly MAX_WALLS = 50;
  private readonly MAX_ITEMS_PER_TYPE = 10;
  private readonly DECOR_SCALE = 0.25;
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
      const wallCount = children.filter(
        (c: any) => c.getData('item').category === 'wall'
      ).length;
      return wallCount < this.MAX_WALLS;
    } else {
      const sameItemCount = children.filter(
        (c: any) => c.getData('item').id === item.id
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
      const sprite = scene.physics.add.sprite(x, y, initialKey);
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
      sprite.setData('rotation', initialRotation);

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
    const item = sprite.getData('item');
    const nextKey = `${item.id}_${nextRotation}`;

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
      const id = child.getData('item').id;
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

    return decorSprites.getChildren().map((child: any) => ({
      userId,
      decorId: child.getData('item').id,
      x: child.x,
      y: child.y,
      rotation: child.getData('rotation')
    }));
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
