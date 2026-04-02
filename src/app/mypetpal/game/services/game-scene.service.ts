import { Injectable } from '@angular/core';
import * as Phaser from 'phaser';

@Injectable({
  providedIn: 'root'
})
export class GameSceneService {
  private readonly WORLD_SIZE = 2000;
  private readonly WORLD_CENTER = 1000;
  private readonly ROOM_CENTER = 1000;

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

  preloadAssets(scene: Phaser.Scene): void {
    scene.load.image('dog', '/assets/dog.png');
    scene.load.image('room', '/assets/room-isometric.png');
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
    onSceneReady: (scene: Phaser.Scene) => void
  ): Phaser.GameObjects.Sprite {
    const roomCenterX = this.ROOM_CENTER;
    const roomCenterY = this.ROOM_CENTER;

    const room = scene.add.image(roomCenterX, roomCenterY, 'room');
    room.displayWidth = 600;
    room.scaleY = room.scaleX;

    const dog = scene.physics.add
      .sprite(dogStartX, dogStartY, 'dog')
      .setScale(0.028);
    dog.setCollideWorldBounds(true);
    dog.setBounce(0);

    scene.cameras.main.centerOn(cameraX, cameraY);
    scene.cameras.main.zoom = cameraZoom;

    this.setupPhysicsWorld(scene, roomCenterX, roomCenterY);
    this.setupInputHandlers(scene, room);
    this.storeSceneConstants(scene, roomCenterX, roomCenterY);

    setTimeout(() => onSceneReady(scene), 400);

    return dog;
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
    const hoverZone = scene.add
      .zone(0, 0, 56, 56)
      .setDepth(9)
      .setInteractive();
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
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !canPan()) return;

      scene.cameras.main.scrollX -=
        (pointer.x - pointer.prevPosition.x) / scene.cameras.main.zoom;
      scene.cameras.main.scrollY -=
        (pointer.y - pointer.prevPosition.y) / scene.cameras.main.zoom;
      onCameraMove();
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
  ): Phaser.Types.Input.Keyboard.CursorKeys {
    scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return;

      switch (event.key) {
        case 'ArrowUp':
          onArrowKey('up');
          break;
        case 'ArrowDown':
          onArrowKey('down');
          break;
        case 'ArrowLeft':
          onArrowKey('left');
          break;
        case 'ArrowRight':
          onArrowKey('right');
          break;
      }
    });

    return scene.input.keyboard!.createCursorKeys();
  }

  getWorldCenter(): { x: number; y: number } {
    return { x: this.WORLD_CENTER, y: this.WORLD_CENTER };
  }
}
