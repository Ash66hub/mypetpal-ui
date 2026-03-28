import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Phaser from 'phaser';
import { PetStreamService } from '../pet/pet-service/pet-stream.service';
import { Router } from '@angular/router';
import { DecorItem, DecorService, DecorInstance } from '../../core/decor/decor.service';
import { UserSettingsService, UserSettings } from '../../core/user-settings/user-settings.service';

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
  private decorSprites: Phaser.GameObjects.Group | null = null;
  private selectedDecor: Phaser.GameObjects.Sprite | null = null;
  private decorToolbox: Phaser.GameObjects.Container | null = null;
  private selectionBorder: Phaser.GameObjects.Graphics | null = null;
  private isDraggingDecor: boolean = false;
  public isSavingRoom: boolean = false;
  public toastMessage: string | null = null;
  private toastTimeout: any;
  private settingsSaveTimeout: any;

  public isEmojiPickerOpen: boolean = false;
  public isGameLoading: boolean = true;
  private settings: UserSettings | null = null;
  public readonly emojis: string[] = ['😂','❤️','😍','👍','😊','🐾','🐶','🐱','✨','🎮','🔥','🎉','😎','🤔','👏','🌟','🎵','😴','😭','😡','🥺','🥳','🙌','👀'];

  constructor(
    private petStreamService: PetStreamService,
    private router: Router,
    private decorService: DecorService,
    private userSettingsService: UserSettingsService
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initialize();
  }

  ngOnDestroy(): void {
    if (this.game) {
      this.game.destroy(true);
    }
    if (this.settingsSaveTimeout) {
      clearTimeout(this.settingsSaveTimeout);
    }
  }

  // Handle outside click to close emoji picker
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.emoji-selector-wrapper')) {
      this.isEmojiPickerOpen = false;
    }
  }

  public toggleEmojiPicker(): void {
    this.isEmojiPickerOpen = !this.isEmojiPickerOpen;
  }

  public addEmoji(emoji: string): void {
    if (this.chatInput && this.chatInput.nativeElement) {
      const el = this.chatInput.nativeElement;
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const val = el.value;

      // Ensure we don't exceed max length
      if (val.length + emoji.length <= 100) {
        el.value = val.substring(0, start) + emoji + val.substring(end);
        el.selectionStart = el.selectionEnd = start + emoji.length;
        el.focus();
      }
    }
  }

  private async initialize() {
    const success = await this.getPetDetails();
    if (success) {
      const userId = localStorage.getItem('userId');
      if (userId) {
        try {
          const s = await this.userSettingsService.getSettings(parseInt(userId)).toPromise();
          if (s) {
            this.settings = s;
            this.currentZoom = s.zoomLevel || 5.0;
          }
        } catch (e) {
          console.warn('Settings load failed:', e);
        }
      }
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
    this.currentZoom = Math.min(this.currentZoom + 0.5,12.0);
    this.applyZoom();
  }

  public zoomOut() {
    this.currentZoom = Math.max(this.currentZoom - 0.5, 2);
    this.applyZoom();
  }

  private applyZoom() {
    if (this.game && this.game.scene.scenes[0]) {
      const scene = this.game.scene.scenes[0];
      scene.tweens.add({
        targets: scene.cameras.main,
        zoom: this.currentZoom,
        duration: 200,
        ease: 'Power2',
        onComplete: () => this.saveUserSettings()
      });
    }
  }

  // === D-Pad Discrete Movement Controls ===
  public moveStep(direction: string) {
    if (this.isMoving || !this.dog) return;

    let targetX = this.dog.x;
    let targetY = this.dog.y;
    const stepDist = 4.4; // 1/5th of 22 (was 22)

    switch (direction) {
      case 'up':    targetY -= stepDist; break;
      case 'down':  targetY += stepDist; break;
      case 'left':  targetX -= stepDist; break;
      case 'right': targetX += stepDist; break;
    }

    // Check boundary AND decor collisions before moving
    if (this.isInsideFloor(targetX, targetY) && !this.isCollidingWithDecor(targetX, targetY)) {
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
          this.saveUserSettings(); // Persist pet position
        }
      });
    }
  }

  private isCollidingWithDecor(x: number, y: number): boolean {
    if (!this.decorSprites || !this.dog) return false;
    
    // Check if the dog's body at the target position would overlap
    const scene = this.game.scene.scenes[0];
    const body = this.dog.body as Phaser.Physics.Arcade.Body;
    const temp = scene.add.zone(x, y, body.width, body.height);
    scene.physics.add.existing(temp);
    const overlapping = scene.physics.overlap(temp, this.decorSprites);
    temp.destroy();
    return overlapping;
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
    const paddingX = 8;
    const paddingY = 4;
    const maxBubbleWidth = 160;

    // Hide pointers on existing bubbles
    this.chatBubbles.forEach(b => {
      const pointer = b.getByName('pointer');
      if (pointer) (pointer as any).alpha = 0;
    });

    const txt = scene.add.text(0, 0, filteredText, {
      fontFamily: "'Quicksand', sans-serif",
      fontStyle: 'bold',
      fontSize: '32px', // Render at high resolution
      color: '#1a1a2e',
      align: 'center',
      resolution: 4, // High resolution for sharpness
      wordWrap: { width: (maxBubbleWidth - (paddingX * 2)) * 4 } // Buffer for internal scaling
    }).setOrigin(0.5);

    // Scale down to desired visual size (8px / 32px = 0.25)
    txt.setScale(0.25);
    txt.setAlpha(1.0);

    const bubbleWidth = Math.max(40, Math.min((txt.width * 0.25) + (paddingX * 2), maxBubbleWidth));
    const bubbleHeight = (txt.height * 0.25) + (paddingY * 2);
    
    // Bubble Background
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.75);
    bg.fillRoundedRect(-bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 6);
    bg.lineStyle(1.0, 0xffffff, 0.9); 
    bg.strokeRoundedRect(-bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 6);
    
    // Pointer (separate object)
    const pointer = scene.add.graphics();
    pointer.setName('pointer'); // Correct way to set name
    const pointerSize = 4;
    pointer.fillStyle(0xffffff, 0.75);
    pointer.beginPath();
    pointer.moveTo(-pointerSize, bubbleHeight/2 - 1); 
    pointer.lineTo(0, bubbleHeight/2 + pointerSize);
    pointer.lineTo(pointerSize, bubbleHeight/2 - 1);
    pointer.closePath();
    pointer.fillPath();

    pointer.lineStyle(1.0, 0xffffff, 0.9);
    pointer.beginPath();
    pointer.moveTo(-pointerSize, bubbleHeight/2 - 1);
    pointer.lineTo(0, bubbleHeight/2 + pointerSize);
    pointer.lineTo(pointerSize, bubbleHeight/2 - 1);
    pointer.strokePath();

    const container = scene.add.container(this.dog.x, this.dog.y - 28, [pointer, bg, txt]);
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
    const clickedGame = document.getElementById('game-container')?.contains(event.target as Node);
    const isButton = (event.target as HTMLElement).tagName === 'BUTTON';
    
    if (!clickedInside && !isButton) {
      this.chatInput.nativeElement.blur();
      this.deselectDecor();
    }
  }

  // === Drag and Drop Handlers ===
  public onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  public onDrop(event: DragEvent) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('decorItem');
    if (!data) return;

    const item: DecorItem = JSON.parse(data);
    const container = document.getElementById('game-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const scene = this.game.scene.scenes[0];
    
    // Scale the DOM mouse position to our 2000x2000 internal resolution
    const gameX = (x / container.offsetWidth) * (scene.game.config.width as number);
    const gameY = (y / container.offsetHeight) * (scene.game.config.height as number);

    const worldPoint = scene.cameras.main.getWorldPoint(gameX, gameY);

    if (!this.isInsideFloor(worldPoint.x, worldPoint.y)) {
      // RESET POINTERS before returning to prevent phantom dragging!
      if (scene) {
        scene.input.activePointer.isDown = false;
        scene.input.activePointer.buttons = 0;
        scene.input.resetPointers();
      }
      return;
    }

    if (!this.canAddMoreDecor(item)) {
      this.showToast(item.category === 'wall' ? 'Max 50 walls allowed!' : `Max 10 ${item.name} allowed!`);
      // Reset pointers even on error
      if (scene) {
        scene.input.resetPointers();
      }
      return;
    }

    this.addDecorToGame(item, worldPoint.x, worldPoint.y);
    this.saveRoomLayout();

    // Reset Phaser pointers to prevent phantom panning
    if (scene) {
      scene.input.activePointer.isDown = false;
      scene.input.activePointer.buttons = 0;
      scene.input.resetPointers();
    }
  }

  private addDecorToGame(item: DecorItem, x: number, y: number, initialRotation: string = 'SE') {
    if (!this.game?.scene?.scenes[0]) return;
    const scene = this.game.scene.scenes[0];
    
    // Check if asset is loaded
    const seKey = `${item.id}_SE`;
    const swKey = `${item.id}_SW`;
    const initialKey = `${item.id}_${initialRotation}`;

    const loadAndAdd = () => {
      if (!this.decorSprites) {
        this.decorSprites = scene.physics.add.group();
        scene.physics.add.collider(this.decorSprites, this.decorSprites);
        if (this.dog) {
          scene.physics.add.collider(this.dog, this.decorSprites);
        }
      }

      const sprite = scene.physics.add.sprite(x, y, initialKey);
      sprite.setScale(0.25);
      sprite.setAngle(initialRotation === 'SW' ? -5 : 0); // Only tilt SW for isometric alignment
      
      // Reduce overlap threshold by 10%
      const newWidth = sprite.width * 0.90;
      const newHeight = sprite.height * 0.90;
      sprite.setBodySize(newWidth, newHeight);
      sprite.setOffset((sprite.width - newWidth) / 2, (sprite.height - newHeight) / 2);

      sprite.setImmovable(true);
      sprite.setInteractive({ draggable: true });
      sprite.setDepth(10);
      sprite.setData('item', item);
      sprite.setData('rotation', initialRotation);

      // Add to list
      this.decorSprites.add(sprite);
      
      this.updateToolboxPosition();
      this.refreshCounts();

      // Force initial separation if dropped on top of something (manual resolver)
      this.resolveDecorOverlap(sprite);

      // Handle interactions
      sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return;
        this.selectDecor(sprite);
      });

      scene.input.setDraggable(sprite);

      sprite.on('dragstart', () => {
        this.isDraggingDecor = true;
        this.selectDecor(sprite);
        sprite.setData('origX', sprite.x);
        sprite.setData('origY', sprite.y);
        sprite.setAlpha(0.6); // Semitransparent while dragging
        sprite.setImmovable(false); // Enable physics separation
      });

      sprite.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        // Enforce basic floor boundaries only
        if (this.isInsideFloor(dragX, dragY)) {
          sprite.setPosition(dragX, dragY);
        }
        this.updateToolboxPosition();
      });

      sprite.on('dragend', () => {
        this.isDraggingDecor = false;
        sprite.setAlpha(1.0);
        sprite.setImmovable(true); // Lock in place

        // Final resolve on release
        this.resolveDecorOverlap(sprite);
        this.updateToolboxPosition();

        // ONLY save if moved!
        const moved = Math.abs(sprite.x - sprite.getData('origX')) > 1 || 
                      Math.abs(sprite.y - sprite.getData('origY')) > 1;
        if (moved) {
          this.saveRoomLayout();
        }
      });
    };

    const sePath = item.imagePath.startsWith('/') ? item.imagePath : `/${item.imagePath}`;

    if (!scene.textures.exists(seKey)) {
      scene.load.image(seKey, sePath);
      // Construct SW path
      const swPath = sePath.replace('_SE.png', '_SW.png');
      scene.load.image(swKey, swPath);
      
      scene.load.once('complete', loadAndAdd);
      scene.load.start();
    } else {
      loadAndAdd();
    }
  }

  private selectDecor(sprite: Phaser.GameObjects.Sprite) {
    this.deselectDecor();
    this.selectedDecor = sprite;
    this.showSelectionFeedback(sprite);
    this.showDecorToolbox(sprite);
  }

  private deselectDecor() {
    if (this.selectedDecor) {
      this.selectedDecor.clearTint();
      this.selectedDecor = null;
    }
    this.hideSelectionFeedback();
    this.hideDecorToolbox();
  }

  private showSelectionFeedback(sprite: Phaser.GameObjects.Sprite) {
    const scene = this.game.scene.scenes[0];
    if (!scene) return;

    if (!this.selectionBorder) {
      this.selectionBorder = scene.add.graphics();
      this.selectionBorder.setDepth(9); // Just below sprite or above? User said highlight.
    }

    this.selectionBorder.clear();
    this.selectionBorder.lineStyle(0.5, 0x7c3aed, 0.8);
    
    // Draw relative to center
    const bounds = sprite.getBounds();
    this.selectionBorder.strokeRect(
      bounds.x - 2, 
      bounds.y - 2, 
      bounds.width + 4, 
      bounds.height + 4
    );
    this.selectionBorder.setVisible(true);
  }

  private hideSelectionFeedback() {
    if (this.selectionBorder) {
      this.selectionBorder.setVisible(false);
    }
  }

  private showDecorToolbox(sprite: Phaser.GameObjects.Sprite) {
    const scene = this.game.scene.scenes[0];
    if (!scene) return;

    if (!this.decorToolbox) {
      const rotateIcon = scene.add.image(-12, 0, 'rotate').setOrigin(0.5).setDisplaySize(16, 16);
      const trashIcon = scene.add.image(12, 0, 'trash').setOrigin(0.5).setDisplaySize(16, 16);
      
      this.decorToolbox = scene.add.container(0, 0, [rotateIcon, trashIcon]);
      this.decorToolbox.setDepth(30);
      this.decorToolbox.setScale(0.3); // Minimalist scale

      // Rotate interaction
      rotateIcon.setInteractive({ useHandCursor: true });
      rotateIcon.on('pointerdown', (p: any, lx: any, ly: any, e: any) => {
        e.stopPropagation();
        this.toggleRotation();
      });

      // Trash interaction
      trashIcon.setInteractive({ useHandCursor: true });
      trashIcon.on('pointerdown', (p: any, lx: any, ly: any, e: any) => {
        e.stopPropagation();
        this.deleteSelectedDecor();
      });
    }

    this.decorToolbox.setVisible(true);
    this.updateToolboxPosition();
  }

  private hideDecorToolbox() {
    if (this.decorToolbox) {
      this.decorToolbox.setVisible(false);
    }
  }

  private updateToolboxPosition() {
    if (this.selectedDecor) {
      const x = this.selectedDecor.x;
      const y = this.selectedDecor.y - (this.selectedDecor.displayHeight / 2) - 8;

      if (this.decorToolbox) {
        this.decorToolbox.setPosition(x, y);
      }
      
      if (this.selectionBorder) {
        this.showSelectionFeedback(this.selectedDecor);
      }
    }
  }

  private deleteSelectedDecor() {
    if (!this.selectedDecor) return;
    
    const sprite = this.selectedDecor;
    if (this.decorSprites) {
      this.decorSprites.remove(sprite);
    }
    this.deselectDecor();
    sprite.destroy();
    this.saveRoomLayout();
  }

  private toggleRotation() {
    if (!this.selectedDecor) return;
    
    const currentRotation = this.selectedDecor.getData('rotation');
    const nextRotation = currentRotation === 'SE' ? 'SW' : 'SE';
    const item = this.selectedDecor.getData('item');
    const nextKey = `${item.id}_${nextRotation}`;
    
    this.selectedDecor.setTexture(nextKey);
    this.selectedDecor.setData('rotation', nextRotation);
    this.selectedDecor.setAngle(nextRotation === 'SW' ? -5 : 0); // Dynamically update angle
 
    // After rotation, the bounds might have changed, so re-resolve overlap
    this.resolveDecorOverlap(this.selectedDecor);
    this.saveRoomLayout();
  }

  private resolveDecorOverlap(sprite: Phaser.GameObjects.Sprite) {
    if (!this.decorSprites) return;
    
    const scene = this.game.scene.scenes[0];
    let attempts = 0;
    const maxAttempts = 30; // More aggressive
    
    while (attempts < maxAttempts) {
      let overlappingItem: any = null;
      this.decorSprites.getChildren().forEach((item: any) => {
        if (item !== sprite) {
           // We use the physics overlap check but ensure bodies are synced
           (sprite.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
           (item.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
           if (scene.physics.overlap(sprite, item)) {
             overlappingItem = item;
           }
        }
      });
      
      if (!overlappingItem) break;
      
      // Push out: move sprite away from overlappingItem center
      const angle = Phaser.Math.Angle.Between(overlappingItem.x, overlappingItem.y, sprite.x, sprite.y);
      // Small nudge but repeat to find a free spot
      sprite.x += Math.cos(angle) * 3;
      sprite.y += Math.sin(angle) * 3;
      
      attempts++;
    }
    this.updateToolboxPosition();
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
      width: 2000,
      height: 2000,
      transparent: true,
      scale: {
        mode: Phaser.Scale.ENVELOP, // Robustly fills the screen
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: {
        preload: function(this: any) { this.gameComponent.preload(this); },
        create: function(this: any) { this.gameComponent.create(this); },
        update: function(this: any) { this.gameComponent.update(this); },
        init: function(this: any) { this.gameComponent = self; }
      },
      parent: 'game-container',
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
    scene.load.image('rotate', '/assets/rotate.png');
    scene.load.image('trash', '/assets/delete.png');
  }

  create(scene: Phaser.Scene): void {
    // Establish a fixed world origin (1000,1000) to keep all coordinates stable across devices
    const roomCenterX = 1000;
    const roomCenterY = 1000;
    (scene as any).roomCenterX = roomCenterX;
    (scene as any).roomCenterY = roomCenterY;
    const centerX = roomCenterX;
    const centerY = roomCenterY;

    // Place the floor
    const room = scene.add.image(roomCenterX, roomCenterY, 'room');
    room.displayWidth = 600;
    room.scaleY = room.scaleX; // Uniform scale

    // Initial position from settings or default
    const startX = this.settings?.lastPetX || roomCenterX;
    const startY = this.settings?.lastPetY || (roomCenterY + 27);

    this.dog = scene.physics.add.sprite(startX, startY, 'dog').setScale(0.028);
    // Pet stays at 0 default
    this.dog.setCollideWorldBounds(true);
    this.dog.setBounce(0);

    // Camera setup - restore last focus or default to room origin
    const camX = this.settings?.lastCameraX || roomCenterX;
    const camY = this.settings?.lastCameraY || roomCenterY;
    scene.cameras.main.centerOn(camX, camY);
    scene.cameras.main.zoom = this.currentZoom;
    
    // Enable Camera Panning (Middle click or Right click drag)
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Only pan if we aren't dragging decor and a secondary mouse button is pressed
      if (!pointer.isDown || this.isDraggingDecor) return; 
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        const dx = pointer.x - pointer.prevPosition.x;
        const dy = pointer.y - pointer.prevPosition.y;
        scene.cameras.main.scrollX -= dx / scene.cameras.main.zoom;
        scene.cameras.main.scrollY -= dy / scene.cameras.main.zoom;
        this.saveUserSettings(); // Save new camera focus
      }
    });

    scene.physics.world.setBounds(
      roomCenterX - 285, roomCenterY - 130, 575, 306,
      true, true, true, true
    );

    (scene as any).centerX = centerX;
    (scene as any).centerY = centerY;

    // === Phaser Arrow Controls (appear around pet on hover) ===
    const arrowOffset = 18; // Even closer
    let hoverCount = 0; // track how many interactive elements the pointer is over

    const showArrows = () => {
      this.arrowsVisible = true;
      this.arrowGroup?.getChildren().forEach((c: any) => {
        scene.tweens.killTweensOf(c);
        scene.tweens.add({ targets: c, alpha: 0.45, duration: 150 });
      });
    };

    // Global deselect within Phaser
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer, gameObjects: any[]) => {
      if (gameObjects.length === 0) {
        this.deselectDecor();
      }
    });

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
      const radius = 7; 
      
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
      if (pointer.isDown && !this.isDraggingDecor) {
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

    // Mark as fully booted & hide paw spinner
    setTimeout(() => {
        this.isGameLoading = false;
        this.loadSavedDecor();
    }, 400); // 400ms buffer prevents harsh snapping of the canvas layer
  }

  public showToast(message: string) {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastMessage = message;
    this.toastTimeout = setTimeout(() => this.toastMessage = null, 3000);
  }

  private loadSavedDecor() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    this.decorService.getSavedDecor(parseInt(userId)).subscribe({
      next: (instances) => {
        instances.forEach(instance => {
          const item = this.decorService.items().find(i => i.id === instance.decorId);
          if (item) {
            // Convert coordinate system if needed, but here we use world coordinates directly
            this.addDecorToGame(item, instance.x, instance.y, instance.rotation);
          }
        });
        this.refreshCounts();
        this.decorService.isRoomLoaded.set(true);
      },
      error: (err) => {
        console.error('Failed to load decor:', err);
        this.decorService.isRoomLoaded.set(true);
      }
    });
  }

  private canAddMoreDecor(item: DecorItem): boolean {
    if (!this.decorSprites) return true;
    
    const children = this.decorSprites.getChildren();
    if (item.category === 'wall') {
      const wallCount = children.filter((c: any) => c.getData('item').category === 'wall').length;
      return wallCount < 50;
    } else {
      // 10 per specific asset kind
      const sameItemCount = children.filter((c: any) => c.getData('item').id === item.id).length;
      return sameItemCount < 10;
    }
  }

  private refreshCounts() {
    if (!this.decorSprites) return;
    const counts: Record<string, number> = {};
    this.decorSprites.getChildren().forEach((child: any) => {
      const id = child.getData('item').id;
      counts[id] = (counts[id] || 0) + 1;
    });
    this.decorService.activeCounts.set(counts);
  }

  private saveRoomLayout() {
    const userId = localStorage.getItem('userId');
    if (!userId || !this.decorSprites) return;

    this.refreshCounts();
    const instances: DecorInstance[] = this.decorSprites.getChildren().map((child: any) => {
      return {
        userId: parseInt(userId),
        decorId: child.getData('item').id,
        x: child.x,
        y: child.y,
        rotation: child.getData('rotation')
      };
    });

    this.isSavingRoom = true;
    this.decorService.saveDecor(parseInt(userId), instances).subscribe({
      next: () => {
        setTimeout(() => this.isSavingRoom = false, 800); // Keep visible briefly for feedback
      },
      error: (err) => {
        console.error('Failed to save decor:', err);
        this.isSavingRoom = false;
      }
    });
  }

  private isInsideFloor(x: number, y: number): boolean {
    if (!this.game?.scene?.scenes[0]) return true;
    
    // Use our fixed World Center (1000, 1000) for all checks
    const centerX = 1000;
    const centerY = 1000;
    
    const lx = x - centerX;
    const ly = y - centerY;

    // Check all 4 lines of the quadrilateral defined by the user
    // Top-Right: 162x - 290y - 37700 = 0
    if (162 * lx - 290 * ly - 37700 > 0) return false;
    // Right-Bottom: 144x + 290y - 51040 = 0
    if (144 * lx + 290 * ly - 51040 > 0) return false;
    // Bottom-Left: -154x + 285y - 50160 = 0
    if (-154 * lx + 285 * ly - 50160 > 0) return false;
    // Left-Top: -152x - 285y - 37050 = 0
    if (-152 * lx - 285 * ly - 37050 > 0) return false;

    return true;
  }

  private saveUserSettings() {
    // Debounce the save to 5 seconds
    if (this.settingsSaveTimeout) {
      clearTimeout(this.settingsSaveTimeout);
    }

    this.settingsSaveTimeout = setTimeout(() => {
      const userId = localStorage.getItem('userId');
      if (!userId || !this.dog || !this.game?.scene?.scenes[0]) return;
      
      const scene = this.game.scene.scenes[0];

      this.userSettingsService.saveSettings({
        userId: parseInt(userId),
        lastPetX: this.dog.x,
        lastPetY: this.dog.y,
        lastCameraX: scene.cameras.main.midPoint.x,
        lastCameraY: scene.cameras.main.midPoint.y,
        zoomLevel: this.currentZoom,
        isMuted: this.settings?.isMuted || false,
        musicVolume: this.settings?.musicVolume || 0.5,
        soundVolume: this.settings?.soundVolume || 0.5
      }).subscribe();
    }, 5000); // 5 second debounce
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
      this.dog.y += (sc.centerY + 27 - this.dog.y) * 0.1;
    }
  }
}
