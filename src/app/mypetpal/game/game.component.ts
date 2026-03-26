import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Phaser from 'phaser';
import { PetStreamService } from '../pet/pet-service/pet-stream.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-game',
    templateUrl: './game.component.html',
    styleUrls: ['./game.component.scss'],
    standalone: false
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chatInput') chatInput!: ElementRef;
  private game!: Phaser.Game;
  private dog: any;
  private currentZoom: number = 1.0;
  private moveDirection: string | null = null;
  private moveSpeed: number = 120;
  private arrowGroup: Phaser.GameObjects.Group | null = null;
  private arrowsVisible: boolean = false;
  private isMoving: boolean = false; // Prevent overlapping steps
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private chatBubbles: Phaser.GameObjects.Container[] = [];

  constructor(
    private petStreamService: PetStreamService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initialize();
  }

  ngOnDestroy(): void {
    if (this.game) {
      this.game.destroy(true);
    }
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

  // === D-Pad Discrete Movement Controls ===
  public moveStep(direction: string) {
    if (this.isMoving || !this.dog) return;

    let targetX = this.dog.x;
    let targetY = this.dog.y;
    const stepDist = 22; // Half step (was 45)

    switch (direction) {
      case 'up':    targetY -= stepDist; break;
      case 'down':  targetY += stepDist; break;
      case 'left':  targetX -= stepDist; break;
      case 'right': targetX += stepDist; break;
    }

    // Check boundary before moving
    if (this.isInsideFloor(targetX, targetY)) {
      this.isMoving = true;
      const scene = this.game.scene.scenes[0];
      scene.tweens.add({
        targets: this.dog,
        x: targetX,
        y: targetY,
        duration: 150, // Quicker for smaller steps
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.isMoving = false;
        }
      });
    }
  }

  // === Chat System ===
  public talk(text: string) {
    if (!text || !this.dog || !this.game?.scene?.scenes[0]) return;
    
    // Limits
    const charLimit = 100;
    let filteredText = text.substring(0, charLimit);
    
    // Force break long words to prevent horizontal overflow (like in screenshot)
    const words = filteredText.split(' ');
    filteredText = words.map(word => {
      if (word.length > 20) {
        // Insert a space every 20 chars for long continuous strings
        return word.match(/.{1,20}/g)?.join(' ') || word;
      }
      return word;
    }).join(' ');

    if (text.length > charLimit) filteredText += '...';

    const scene = this.game.scene.scenes[0];
    const paddingX = 10;
    const paddingY = 6;
    const maxBubbleWidth = 220;

    // Hide pointers on existing bubbles
    this.chatBubbles.forEach(b => {
      const pointer = b.getByName('pointer');
      if (pointer) (pointer as any).alpha = 0;
    });

    const txt = scene.add.text(0, 0, filteredText, {
      fontFamily: "'Nunito', sans-serif",
      fontSize: '14px',
      color: '#1a1a2e',
      align: 'center',
      resolution: window.devicePixelRatio || 2,
      wordWrap: { width: maxBubbleWidth - (paddingX * 2) }
    }).setOrigin(0.5);

    const bubbleWidth = Math.max(50, Math.min(txt.width + (paddingX * 2), maxBubbleWidth));
    const bubbleHeight = txt.height + (paddingY * 2);
    
    // Bubble Background
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.75);
    bg.fillRoundedRect(-bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 10);
    bg.lineStyle(1.2, 0xffffff, 0.9); 
    bg.strokeRoundedRect(-bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 10);
    
    // Pointer (separate object)
    const pointer = scene.add.graphics();
    pointer.setName('pointer'); // Correct way to set name
    const pointerSize = 6;
    pointer.fillStyle(0xffffff, 0.75);
    pointer.beginPath();
    pointer.moveTo(-pointerSize, bubbleHeight/2 - 1); 
    pointer.lineTo(0, bubbleHeight/2 + pointerSize);
    pointer.lineTo(pointerSize, bubbleHeight/2 - 1);
    pointer.closePath();
    pointer.fillPath();

    pointer.lineStyle(1.2, 0xffffff, 0.9);
    pointer.beginPath();
    pointer.moveTo(-pointerSize, bubbleHeight/2 - 1);
    pointer.lineTo(0, bubbleHeight/2 + pointerSize);
    pointer.lineTo(pointerSize, bubbleHeight/2 - 1);
    pointer.strokePath();

    const container = scene.add.container(this.dog.x, this.dog.y - 40, [pointer, bg, txt]);
    container.setDepth(20);
    container.setAlpha(0);
    (container as any).originalHeight = bubbleHeight;

    // Slide in animation
    scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
      ease: 'Power1'
    });

    this.chatBubbles.push(container);

    // Auto-fade after 5 seconds
    scene.time.delayedCall(5000, () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        y: container.y - 20,
        duration: 400,
        onComplete: () => {
          this.chatBubbles = this.chatBubbles.filter(b => b !== container);
          container.destroy();
        }
      });
    });
  }

  // === Chat Input Handling ===
  // Prevents Phaser from stealing keys (like SPACE) while typing
  public onInputFocus() {
    const scene = this.game?.scene?.scenes[0];
    if (scene && scene.input.keyboard) {
      scene.input.keyboard.enabled = false;
    }
  }

  public onInputBlur() {
    const scene = this.game?.scene?.scenes[0];
    if (scene && scene.input.keyboard) {
      scene.input.keyboard.enabled = true;
    }
  }

  @HostListener('window:mousedown', ['$event'])
  onWindowClick(event: MouseEvent) {
    if (!this.chatInput) return;
    
    // If clicking outside the input box, blur it to restore pet control
    const clickedInside = this.chatInput.nativeElement.contains(event.target);
    const isButton = (event.target as HTMLElement).tagName === 'BUTTON';
    
    if (!clickedInside && !isButton) {
      this.chatInput.nativeElement.blur();
    }
  }

  public stopMove() {
      // Discrete movement doesn't need stopMove velocity reset, 
      // but let's keep it for state safety
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
      transparent: true,
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
      },
      input: {
        keyboard: {
          capture: [] // Disable Phaser capturing keys globally (allows Space in HTML inputs)
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
    const arrowOffset = 26; // Brought closer
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

    const makeArrow = (dir: string, ox: number, oy: number, angle: number) => {
      // Use Phaser Graphics for high-res vector arrows
      const graphics = scene.add.graphics();
      const radius = 9; 
      
      // Draw a triangle
      graphics.fillStyle(0xffffff, 1);
      graphics.beginPath();
      graphics.moveTo(-radius, radius * 0.7);
      graphics.lineTo(radius, radius * 0.7);
      graphics.lineTo(0, -radius);
      graphics.closePath();
      graphics.fillPath();

      // Wrap in a container for easier interaction and centering
      const container = scene.add.container(0, 0, [graphics]);
      container.setAngle(angle);
      container.setAlpha(0);
      container.setDepth(15);
      
      // Make hit area for the container
      const hitArea = new Phaser.Geom.Circle(0, 0, 18);
      container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
      container.setInteractive({ useHandCursor: true });

      (container as any).offsetX = ox;
      (container as any).offsetY = oy;

      container.on('pointerover', () => { 
        hoverCount++; 
        showArrows(); 
        scene.tweens.add({ targets: container, scale: 1.25, alpha: 0.8, duration: 150 });
      });
      container.on('pointerout',  () => { 
        hoverCount = Math.max(0, hoverCount - 1); 
        scene.tweens.add({ targets: container, scale: 1.0, alpha: 0.45, duration: 150 });
        if (hoverCount === 0) hideArrows(); 
      });
      container.on('pointerdown', () => this.moveStep(dir));
      
      return container;
    };

    const arrowUp    = makeArrow('up',    0,           -arrowOffset, 0);
    const arrowDown  = makeArrow('down',  0,            arrowOffset, 180);
    const arrowLeft  = makeArrow('left',  -arrowOffset, 0,           270);
    const arrowRight = makeArrow('right',  arrowOffset, 0,           90);

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

    // === Keyboard Arrow Keys (Discrete Step) ===
    scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.repeat) return; // Prevent continuous movement when holding down
      
      switch (event.key) {
        case 'ArrowUp':    this.moveStep('up');    break;
        case 'ArrowDown':  this.moveStep('down');  break;
        case 'ArrowLeft':  this.moveStep('left');  break;
        case 'ArrowRight': this.moveStep('right'); break;
      }
    });

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

    // Position arrows, hover zone and chat bubbles around the pet every frame
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

    // Stack chat bubbles above pet (Newest at bottom)
    let stackY = -40; // Even closer
    for (let i = this.chatBubbles.length - 1; i >= 0; i--) {
        const bubble = this.chatBubbles[i];
        bubble.x = this.dog.x;
        // Ease bubbles into their stacked positions
        const targetY = this.dog.y + stackY - ((bubble as any).originalHeight / 2);
        bubble.y += (targetY - bubble.y) * 0.25; 
        stackY -= ((bubble as any).originalHeight + 6); // Very tight spacing
    }

    // Apply movement logic was removed here, replaced by moveStep() transitions

    // Safety: push back if somehow outside the diamond
    if (!this.isInsideFloor(this.dog.x, this.dog.y)) {
      this.dog.body.setVelocity(0, 0);
      const sc = scene as any;
      this.dog.x += (sc.centerX - this.dog.x) * 0.1;
      this.dog.y += (sc.centerY + 65 - this.dog.y) * 0.1;
    }
  }
}
