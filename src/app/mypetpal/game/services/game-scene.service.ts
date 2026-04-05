import { Injectable } from '@angular/core';
import * as Phaser from 'phaser';

@Injectable({
  providedIn: 'root'
})
export class GameSceneService {
  private readonly WORLD_SIZE = 2000;
  private readonly WORLD_CENTER = 1000;
  private readonly ROOM_CENTER = 1000;
  private readonly TOUCH_PAN_SENSITIVITY = 0.35;

  createGameConfig(
    parentId: string,
    sceneCallbacks: {
      preload: (scene: Phaser.Scene) => void;
      create: (scene: Phaser.Scene) => void;
      update: (scene: Phaser.Scene) => void;
    }
  ): Phaser.Types.Core.GameConfig {
    return {
      type: Phaser.CANVAS,
      width: this.WORLD_SIZE,
      height: this.WORLD_SIZE,
      transparent: true,
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: {
        preload: function (this: Phaser.Scene) {
          sceneCallbacks.preload(this);
        },
        create: function (this: Phaser.Scene) {
          sceneCallbacks.create(this);
        },
        update: function (this: Phaser.Scene) {
          sceneCallbacks.update(this);
        }
      } as any,
      parent: parentId,
      render: {
        antialias: false,
        roundPixels: true
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      input: {
        keyboard: {
          capture: []
        }
      }
    };
  }

  preloadAssets(
    scene: Phaser.Scene,
    petAssetKey: string,
    roomAssetKey: string
  ): void {
    scene.load.spritesheet(petAssetKey, `/assets/${petAssetKey}.png`, {
      frameWidth: 32,
      frameHeight: 32
    });
    scene.load.image(roomAssetKey, `/assets/${roomAssetKey}.png`);
    scene.load.image('rotate', '/assets/rotate.png');
    scene.load.image('trash', '/assets/delete.png');
    scene.load.image('rest', '/assets/rest.png');
  }

  setupScene(
    scene: Phaser.Scene,
    dogStartX: number,
    dogStartY: number,
    cameraX: number,
    cameraY: number,
    cameraZoom: number,
    petAssetKey: string,
    roomAssetKey: string,
    onSceneReady: (scene: Phaser.Scene) => void
  ): Phaser.GameObjects.Sprite {
    const roomCenterX = this.ROOM_CENTER;
    const roomCenterY = this.ROOM_CENTER;

    const room = scene.add.image(roomCenterX, roomCenterY, roomAssetKey);
    room.displayWidth = 600;
    room.scaleY = room.scaleX;

    const dog = scene.physics.add
      .sprite(dogStartX, dogStartY, petAssetKey)
      .setScale(0.9);
    dog.setCollideWorldBounds(true);
    dog.setBounce(0);

    const shadow = scene.add
      .container(dogStartX - 3, dogStartY + 8)
      .setDepth(4);
    shadow.add(
      scene.add
        .ellipse(0, 0, 12, 4, 0x000000, 0.09)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
    );
    shadow.add(
      scene.add
        .ellipse(0, 0, 6, 2, 0x000000, 0.14)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
    );
    (dog as any).shadow = shadow;

    this.createAnimations(scene, petAssetKey);
    dog.play('idle');

    scene.cameras.main.centerOn(cameraX, cameraY);
    scene.cameras.main.zoom = cameraZoom;

    this.setupPhysicsWorld(scene, roomCenterX, roomCenterY);
    this.setupInputHandlers(scene, room);
    this.storeSceneConstants(scene, roomCenterX, roomCenterY);

    setTimeout(() => onSceneReady(scene), 400);

    return dog;
  }

  private createAnimations(scene: Phaser.Scene, petAssetKey: string): void {
    const anims = scene.anims;

    // Idle animation - frames 0-3
    if (!anims.exists('idle')) {
      anims.create({
        key: 'idle',
        frames: anims.generateFrameNumbers(petAssetKey, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1
      });
    }

    const walkAnimations: Array<{ key: string; start: number; end: number }> = [
      { key: 'walk_down', start: 32, end: 35 },
      { key: 'walk_down_right', start: 36, end: 39 },
      { key: 'walk_right', start: 40, end: 43 },
      { key: 'walk_up_right', start: 44, end: 47 },
      { key: 'walk_up', start: 48, end: 51 },
      { key: 'walk_up_left', start: 52, end: 55 },
      { key: 'walk_left', start: 56, end: 59 },
      { key: 'walk_down_left', start: 60, end: 62 }
    ];

    walkAnimations.forEach(animation => {
      if (!anims.exists(animation.key)) {
        anims.create({
          key: animation.key,
          frames: anims.generateFrameNumbers(petAssetKey, {
            start: animation.start,
            end: animation.end
          }),
          frameRate: 12,
          repeat: -1
        });
      }
    });
  }

  private setupPhysicsWorld(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number
  ): void {
    scene.physics.world.setBounds(
      centerX - 285,
      centerY - 130,
      575,
      306,
      true,
      true,
      true,
      true
    );
  }

  private setupInputHandlers(
    scene: Phaser.Scene,
    room: Phaser.GameObjects.Image
  ): void {
    scene.scale.on('resize', (gameSize: any) => {
      const newCenterX = gameSize.width / 2;
      const newCenterY = gameSize.height / 2;
      (scene as any).centerX = newCenterX;
      (scene as any).centerY = newCenterY;
      room.setPosition(newCenterX, newCenterY);
    });
  }

  private storeSceneConstants(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number
  ): void {
    (scene as any).roomCenterX = centerX;
    (scene as any).roomCenterY = centerY;
    (scene as any).centerX = centerX;
    (scene as any).centerY = centerY;
  }

  setupPetInteractiveZone(
    scene: Phaser.Scene,
    onHoverStart: () => void,
    onHoverEnd: () => void
  ): Phaser.GameObjects.Zone {
    const hoverZone = scene.add.zone(0, 0, 56, 56).setDepth(9).setInteractive();
    (hoverZone as any).isHoverZone = true;

    hoverZone.on('pointerover', onHoverStart);
    hoverZone.on('pointerout', onHoverEnd);

    scene.input.on('gameout', onHoverEnd);

    return hoverZone;
  }

  setupCameraPanning(
    scene: Phaser.Scene,
    onCameraMove: () => void,
    canPan: () => boolean = () => true
  ): void {
    const isTouchCapableDevice = !!scene.game.device.input.touch;
    let lastTouchPanCenter: { x: number; y: number } | null = null;

    const getActiveTouchPointers = () =>
      scene.input.manager.pointers.filter(
        pointer => pointer.isDown && this.isTouchPointer(pointer)
      );

    const resetTouchPan = () => {
      lastTouchPanCenter = null;
    };

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !canPan()) return;

      if (isTouchCapableDevice || this.isTouchPointer(pointer)) {
        const activeTouchPointers = getActiveTouchPointers();

        if (activeTouchPointers.length < 2) {
          resetTouchPan();
          return;
        }

        const centerX =
          (activeTouchPointers[0].x + activeTouchPointers[1].x) / 2;
        const centerY =
          (activeTouchPointers[0].y + activeTouchPointers[1].y) / 2;

        if (!lastTouchPanCenter) {
          lastTouchPanCenter = { x: centerX, y: centerY };
          return;
        }

        scene.cameras.main.scrollX -=
          ((centerX - lastTouchPanCenter.x) * this.TOUCH_PAN_SENSITIVITY) /
          scene.cameras.main.zoom;
        scene.cameras.main.scrollY -=
          ((centerY - lastTouchPanCenter.y) * this.TOUCH_PAN_SENSITIVITY) /
          scene.cameras.main.zoom;
        lastTouchPanCenter = { x: centerX, y: centerY };
        onCameraMove();
        return;
      }

      scene.cameras.main.scrollX -=
        (pointer.x - pointer.prevPosition.x) / scene.cameras.main.zoom;
      scene.cameras.main.scrollY -=
        (pointer.y - pointer.prevPosition.y) / scene.cameras.main.zoom;
      onCameraMove();
    });

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isTouchPointer(pointer) && getActiveTouchPointers().length < 2) {
        resetTouchPan();
      }
    });

    scene.input.on('pointerup', () => {
      if (getActiveTouchPointers().length < 2) {
        resetTouchPan();
      }
    });

    scene.input.on('pointerupoutside', () => {
      if (getActiveTouchPointers().length < 2) {
        resetTouchPan();
      }
    });
  }

  setupMouseWheelZoom(
    scene: Phaser.Scene,
    onZoom: (direction: 'in' | 'out') => void
  ): void {
    scene.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: any,
        deltaX: number,
        deltaY: number
      ) => {
        if (deltaY > 0) {
          onZoom('out');
        } else if (deltaY < 0) {
          onZoom('in');
        }
      }
    );
  }

  setupKeyboardControls(
    scene: Phaser.Scene,
    onArrowKey: (key: string) => void
  ): { keys: Set<string>; cursors: Phaser.Types.Input.Keyboard.CursorKeys } {
    const pressedKeys = new Set<string>();

    scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          pressedKeys.add('up');
          if (!event.repeat) onArrowKey('up');
          break;
        case 'ArrowDown':
          pressedKeys.add('down');
          if (!event.repeat) onArrowKey('down');
          break;
        case 'ArrowLeft':
          pressedKeys.add('left');
          if (!event.repeat) onArrowKey('left');
          break;
        case 'ArrowRight':
          pressedKeys.add('right');
          if (!event.repeat) onArrowKey('right');
          break;
      }
    });

    scene.input.keyboard!.on('keyup', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          pressedKeys.delete('up');
          break;
        case 'ArrowDown':
          pressedKeys.delete('down');
          break;
        case 'ArrowLeft':
          pressedKeys.delete('left');
          break;
        case 'ArrowRight':
          pressedKeys.delete('right');
          break;
      }
    });

    return {
      keys: pressedKeys,
      cursors: scene.input.keyboard!.createCursorKeys()
    };
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    const pointerAny = pointer as any;
    return pointerAny.pointerType === 'touch' || !!pointerAny.wasTouch;
  }

  getWorldCenter(): { x: number; y: number } {
    return { x: this.WORLD_CENTER, y: this.WORLD_CENTER };
  }
}
