import { Component, OnInit, AfterViewInit } from '@angular/core';
import Phaser from 'phaser';
import { PetStreamService } from '../pet/pet-service/pet-stream.service';
import { Route, Router } from '@angular/router';

@Component({
    selector: 'app-game',
    templateUrl: './game.component.html',
    styleUrls: ['./game.component.scss'],
    standalone: false
})
export class GameComponent implements OnInit, AfterViewInit {
  private game: Phaser.Game;
  private dog: any;
  private currentZoom: number = 1.0;
  private moveDirection: string | null = null;
  private moveSpeed: number = 120;
  private arrowGroup: Phaser.GameObjects.Group | null = null;
  private arrowsVisible: boolean = false;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;

  constructor(
    private petStreamService: PetStreamService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initialize();
  }

  private async initialize() {
    const success = await this.getPetDetails();
    if (success) {
      setTimeout(() => this.initializeGame(), 100);
    }
  }

  private async getPetDetails(): Promise<boolean> {
    let pet = this.petStreamService.currentPetStream.getValue();

    // If stream is empty, check localStorage for userId and try to fetch pet
    if (!pet.petId) {
      const userId = localStorage.getItem('userId');
      if (userId) {
        try {
          await this.petStreamService.getUserPets(userId);
          pet = this.petStreamService.currentPetStream.getValue();
        } catch (error) {
          console.error('Failed to fetch pet on reload:', error);
        }
      }
    }

    if (!pet.petId) {
      this.router.navigate(['/petCreation']);
      return false;
    }
    return true;
  }

  // === Zoom Controls ===
  public zoomIn() {
    this.currentZoom = Math.min(this.currentZoom + 0.1, 2.0);
    this.applyZoom();
  }

  public zoomOut() {
    this.currentZoom = Math.max(this.currentZoom - 0.1, 0.5);
    this.applyZoom();
  }

  private applyZoom() {
    if (this.game && this.game.scene.scenes[0]) {
      const scene = this.game.scene.scenes[0];
      scene.tweens.add({
        targets: scene.cameras.main,
        zoom: this.currentZoom,
        duration: 200,
        ease: 'Power2'
      });
    }
  }

  // === D-Pad Movement Controls (called from Phaser arrows) ===
  public startMove(direction: string) {
    this.moveDirection = direction;
  }

  public stopMove() {
    this.moveDirection = null;
    if (this.dog) {
      this.dog.body.setVelocity(0, 0);
    }
  }

  // === Game Initialization ===
  private initializeGame(): void {
    const self = this;
    const container = document.getElementById('game-container');
    const width = container?.offsetWidth || window.innerWidth;
    const height = container?.offsetHeight || window.innerHeight;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: width,
      height: height,
      backgroundColor: '#f0f2f5',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: {
        preload: function(this: any) { this.gameComponent.preload(this); },
        create: function(this: any) { this.gameComponent.create(this); },
        update: function(this: any) { this.gameComponent.update(this); },
        init: function(this: any) { this.gameComponent = self; }
      },
      parent: 'game-container',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      }
    };

    this.game = new Phaser.Game(config);
    this.game.canvas.style.backgroundColor = 'transparent';
  }

  preload(scene: Phaser.Scene): void {
    scene.load.image('dog', '/assets/dog.png');
    scene.load.image('room', '/assets/room-isometric.png');
  }

  create(scene: Phaser.Scene): void {
    const centerX = scene.cameras.main.centerX;
    const centerY = scene.cameras.main.centerY;

    const room = scene.add.image(centerX, centerY, 'room');
    room.setDisplaySize(600, 600); 
    this.dog = scene.physics.add.sprite(centerX, centerY + 65, 'dog').setScale(0.07);
    this.dog.setCollideWorldBounds(true);
    this.dog.setBounce(0);

    scene.physics.world.setBounds(
      centerX - 250, centerY - 100, 500, 330,
      true, true, true, true
    );

    // Boundary Boundary Visualizer - uncomment for debugging
    /*
    const graphics = scene.add.graphics();
    graphics.lineStyle(2, 0x00ff00, 0.3); 
    graphics.beginPath();
    graphics.moveTo(centerX, centerY - 100); // Top
    graphics.lineTo(centerX + 250, centerY + 65); // Right
    graphics.lineTo(centerX, centerY + 230); // Bottom
    graphics.lineTo(centerX - 250, centerY + 65);  // Left
    graphics.closePath();
    graphics.strokePath();
    */

    (scene as any).centerX = centerX;
    (scene as any).centerY = centerY;

    // === Phaser Arrow Controls (appear around pet on hover) ===
    const arrowOffset = 32;
    let hoverCount = 0; // track how many interactive elements the pointer is over

    const showArrows = () => {
      this.arrowsVisible = true;
      this.arrowGroup?.getChildren().forEach((c: any) => {
        scene.tweens.killTweensOf(c);
        scene.tweens.add({ targets: c, alpha: 0.45, duration: 150 });
      });
    };

    const hideArrows = () => {
      this.arrowsVisible = false;
      this.arrowGroup?.getChildren().forEach((c: any) => {
        scene.tweens.killTweensOf(c);
        scene.tweens.add({ targets: c, alpha: 0, duration: 250 });
      });
    };

    const makeArrow = (label: string, ox: number, oy: number, dir: string) => {
      const txt = scene.add.text(0, 0, label, {
        fontSize: '26px',
        color: '#ffffff',
        stroke: '#555555',
        strokeThickness: 2,
      })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(10)
        .setInteractive({ useHandCursor: true });

      (txt as any).offsetX = ox;
      (txt as any).offsetY = oy;

      txt.on('pointerover', () => { hoverCount++; showArrows(); });
      txt.on('pointerout',  () => { hoverCount = Math.max(0, hoverCount - 1); this.stopMove(); if (hoverCount === 0) hideArrows(); });
      txt.on('pointerdown', () => this.startMove(dir));
      txt.on('pointerup',   () => this.stopMove());
      return txt;
    };

    const arrowUp    = makeArrow('▲', 0,           -arrowOffset, 'up');
    const arrowDown  = makeArrow('▼', 0,            arrowOffset, 'down');
    const arrowLeft  = makeArrow('◀', -arrowOffset, 0,           'left');
    const arrowRight = makeArrow('▶',  arrowOffset, 0,           'right');

    this.arrowGroup = scene.add.group([arrowUp, arrowDown, arrowLeft, arrowRight]);

    // Large invisible hover zone centered on pet — much bigger than the sprite
    const hoverZone = scene.add.zone(0, 0, 110, 110).setDepth(9).setInteractive();
    (hoverZone as any).isHoverZone = true;
    hoverZone.on('pointerover', () => { hoverCount++; showArrows(); });
    hoverZone.on('pointerout',  () => {
      hoverCount = Math.max(0, hoverCount - 1);
      // Small delay so moving from zone to arrow doesn't flicker
      scene.time.delayedCall(50, () => {
        if (hoverCount === 0 && !this.moveDirection) hideArrows();
      });
    });
    (this as any)._hoverZone = hoverZone;

    // === Keyboard Arrow Keys ===
    this.cursors = scene.input.keyboard!.createCursorKeys();

    // === Mouse Drag Panning (all mouse drags pan the camera) ===
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        scene.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / scene.cameras.main.zoom;
        scene.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / scene.cameras.main.zoom;
      }
    });

    // Mouse Scroll Zoom
    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number, deltaZ: number) => {
      if (deltaY > 0) {
        this.zoomOut();
      } else if (deltaY < 0) {
        this.zoomIn();
      }
    });

    // Handle Window Resize to update centerX/centerY
    scene.scale.on('resize', (gameSize: any) => {
      const newCenterX = gameSize.width / 2;
      const newCenterY = gameSize.height / 2;
      (scene as any).centerX = newCenterX;
      (scene as any).centerY = newCenterY;
      room.setPosition(newCenterX, newCenterY);
    });
  }

  private isInsideFloor(x: number, y: number): boolean {
    if (!this.game?.scene?.scenes[0]) return true;
    const scene = this.game.scene.scenes[0] as any;
    const centerX = scene.centerX || window.innerWidth / 2;
    const centerY = (scene.centerY || window.innerHeight / 2) + 65;
    const halfWidth = 250;
    const halfHeight = 165;

    return (
      Math.abs(x - centerX) / halfWidth + Math.abs(y - centerY) / halfHeight <= 1
    );
  }

  update(scene: Phaser.Scene): void {
    if (!this.dog) return;

    // Keyboard input: set direction while key held, stop immediately on release
    if (this.cursors) {
      if      (this.cursors.up.isDown)    { this.moveDirection = 'up'; }
      else if (this.cursors.down.isDown)  { this.moveDirection = 'down'; }
      else if (this.cursors.left.isDown)  { this.moveDirection = 'left'; }
      else if (this.cursors.right.isDown) { this.moveDirection = 'right'; }
      else if (!this.arrowsVisible) {
        // No key held AND not hovering arrows: stop all movement
        this.moveDirection = null;
        this.dog.body.setVelocity(0, 0);
      }
    }

    // Position arrows and hover zone around the pet every frame
    if (this.arrowGroup) {
      this.arrowGroup.getChildren().forEach((child: any) => {
        child.x = this.dog.x + child.offsetX;
        child.y = this.dog.y + child.offsetY;
      });
    }
    const hz = (this as any)._hoverZone;
    if (hz) {
      hz.x = this.dog.x;
      hz.y = this.dog.y;
    }

    // Apply movement only if next step is inside the floor
    if (this.moveDirection) {
      let vx = 0;
      let vy = 0;
      switch (this.moveDirection) {
        case 'up':    vy = -this.moveSpeed; break;
        case 'down':  vy =  this.moveSpeed; break;
        case 'left':  vx = -this.moveSpeed; break;
        case 'right': vx =  this.moveSpeed; break;
      }
      const nextX = this.dog.x + vx * (1 / 60);
      const nextY = this.dog.y + vy * (1 / 60);

      if (this.isInsideFloor(nextX, nextY)) {
        this.dog.body.setVelocity(vx, vy);
      } else {
        // Hard stop at boundary — zero velocity AND zero acceleration residuals
        this.dog.body.setVelocity(0, 0);
        this.dog.body.reset(this.dog.x, this.dog.y);
      }
    }

    // Safety: push back if somehow outside the diamond
    if (!this.isInsideFloor(this.dog.x, this.dog.y)) {
      this.dog.body.setVelocity(0, 0);
      const sc = scene as any;
      this.dog.x += (sc.centerX - this.dog.x) * 0.1;
      this.dog.y += (sc.centerY + 65 - this.dog.y) * 0.1;
    }
  }
}
