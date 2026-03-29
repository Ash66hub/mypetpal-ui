import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Phaser from 'phaser';
import { PetStreamService } from '../pet/pet-service/pet-stream.service';
import { Router, ActivatedRoute } from '@angular/router';
import { DecorItem, DecorService, DecorInstance } from '../../core/decor/decor.service';
import { UserSettingsService, UserSettings } from '../../core/user-settings/user-settings.service';
import { FriendService } from '../../core/social/friend.service';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../shared/dialogs/confirm-dialog.component';

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

  // Multiplayer / room-visit state
  public roomOwnerId: string | null = null;  // set ONLY when visiting someone else's room
  public activeRoomId: string | null = null; // the room we are physically in (own or visiting)
  private remotePets: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private remoteChatBubbles: Map<string, Phaser.GameObjects.Container[]> = new Map();
  private roomSubs: Subscription[] = [];

  get isVisiting(): boolean {
    return !!this.roomOwnerId;
  }

  get isHosting(): boolean {
    return !this.roomOwnerId && this.remotePets.size > 0;
  }

  get visitingUsername(): string {
    if (!this.roomOwnerId) return '';
    const pal = this.friendService.friends().find(f => f.userId.toString() === this.roomOwnerId);
    return pal ? pal.username : 'a Pal';
  }

  get hostingCount(): number {
    return this.remotePets.size;
  }

  constructor(
    private petStreamService: PetStreamService,
    private router: Router,
    private route: ActivatedRoute,
    private decorService: DecorService,
    private userSettingsService: UserSettingsService,
    private friendService: FriendService,
    private dialog: MatDialog,
    private ngZone: NgZone
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
    // Leave the active room on destroy
    if (this.activeRoomId) {
      this.friendService.leaveRoom(this.activeRoomId);
    }
    this.roomSubs.forEach(s => s.unsubscribe());
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
    // Check if we are visiting someone else's room
    this.roomOwnerId = this.route.snapshot.paramMap.get('roomOwnerId');
    const myId = localStorage.getItem('userId');
    this.activeRoomId = this.roomOwnerId || myId;

    if (myId) {
      this.friendService.initHub(myId);
    }

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
    if (this.isInsideFloor(targetX, targetY) && 
        !this.isCollidingWithDecor(targetX, targetY) && 
        !this.isCollidingWithRemotePets(targetX, targetY)) {
      this.isMoving = true;
      const scene = this.game.scene.scenes[0];
      scene.tweens.add({
        targets: this.dog,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.isMoving = false;
          this.saveUserSettings();
          // Broadcast new position to the room so visitors/host see it
          const uid = localStorage.getItem('userId');
          if (this.activeRoomId && uid) {
            this.friendService.syncPetPosition(this.activeRoomId, targetX, targetY, uid);
          }
        }
      });
    }
  }

  private isCollidingWithRemotePets(x: number, y: number): boolean {
    if (!this.remotePets || this.remotePets.size === 0) return false;
    
    for (const remotePet of Array.from(this.remotePets.values())) {
      // Use simple distance calculation to form a bounding circle around pets
      const dist = Phaser.Math.Distance.Between(x, y, remotePet.x, remotePet.y);
      // Keep collision soft enough to avoid lockups when two pets start overlapped.
      if (dist < 4) {
        return true;
      }
    }
    return false;
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
    
    // Broadcast via SignalR to anyone in current room (including host broadcasting to visitors)
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username') || 'You';
    if (this.activeRoomId && userId) {
      this.friendService.sendRoomMessage(this.activeRoomId, text, userId, username);
    }

    // Sync position on talk so others properly anchor your new chat bubble
    if (this.activeRoomId && userId && this.dog) {
      this.friendService.syncPetPosition(this.activeRoomId, this.dog.x, this.dog.y, userId);
    }

    this._renderChatBubble(text, this.dog, this.chatBubbles);
  }

  private _renderChatBubble(text: string, anchor: any, bubblesArr: Phaser.GameObjects.Container[]) {
    const charLimit = 100;
    let filteredText = text.substring(0, charLimit);
    
    // Force break long words to prevent horizontal overflow (like in screenshot)
    const words = filteredText.split(' ');
    filteredText = words.map(word => {
      if (word.length > 20) {
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
    bubblesArr.forEach(b => {
      const pointer = b.getByName('pointer');
      if (pointer) (pointer as any).alpha = 0;
    });

    const txt = scene.add.text(0, 0, filteredText, {
      fontFamily: "'Quicksand', sans-serif",
      fontStyle: 'bold',
      fontSize: '32px',
      color: '#1a1a2e',
      align: 'center',
      resolution: 4,
      wordWrap: { width: (maxBubbleWidth - (paddingX * 2)) * 4 }
    }).setOrigin(0.5);

    txt.setScale(0.25);
    txt.setAlpha(1.0);

    const bubbleWidth = Math.max(40, Math.min((txt.width * 0.25) + (paddingX * 2), maxBubbleWidth));
    const bubbleHeight = (txt.height * 0.25) + (paddingY * 2);
    
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.75);
    bg.fillRoundedRect(-bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 6);
    bg.lineStyle(1.0, 0xffffff, 0.9); 
    bg.strokeRoundedRect(-bubbleWidth/2, -bubbleHeight/2, bubbleWidth, bubbleHeight, 6);
    
    const pointer = scene.add.graphics();
    pointer.setName('pointer');
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

    const container = scene.add.container(anchor.x, anchor.y - 28, [pointer, bg, txt]);
    container.setDepth(20);
    container.setAlpha(0);
    (container as any).originalHeight = bubbleHeight;
    (container as any).anchorRef = anchor; // track which sprite this bubble belongs to

    scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
      ease: 'Power1'
    });

    bubblesArr.push(container);

    scene.time.delayedCall(5000, () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        y: container.y - 20,
        duration: 400,
        onComplete: () => {
          const idx = bubblesArr.indexOf(container);
          if (idx !== -1) bubblesArr.splice(idx, 1);
          container.destroy();
        }
      });
    });
  }

  // Keep old call signature working (was: full inline body)
  private _oldTalkEnd() {}

  private kickToolbox: Phaser.GameObjects.Container | null = null;
  private selectedVisitor: string | null = null;
  private currentlyKickingUserId: string | null = null;

  public openKickToolbox(scene: Phaser.Scene, userId: string, visitorName: string, sprite: Phaser.GameObjects.Sprite) {
    this.selectedVisitor = userId;
    if (!this.kickToolbox) {
      const kickText = scene.add.text(0, 0, 'Kick out', {
          fontFamily: "'Quicksand', sans-serif",
          fontSize: '32px',
          color: '#ffffff',
          backgroundColor: '#ef4444',
          padding: { x: 8, y: 4 }
      }).setOrigin(0.5);

      this.kickToolbox = scene.add.container(0, 0, [kickText]);
      this.kickToolbox.setDepth(30);
      this.kickToolbox.setScale(0.25); // Minimalist scale like decorToolbox
      
      kickText.setInteractive({ useHandCursor: true });
      kickText.on('pointerdown', (pointer: Phaser.Input.Pointer, lx: any, ly: any, event: any) => {
         if (event) event.stopPropagation();
         this.kickSelectedVisitor();
      });
    }

    this.kickToolbox.setVisible(true);
    this.updateKickToolboxPosition();
  }

  private kickSelectedVisitor() {
     if (!this.selectedVisitor) return;
     const visitorId = this.selectedVisitor;
     const matchPal = this.friendService.friends().find(f => f.userId.toString() === visitorId);
     const visitorName = matchPal ? matchPal.username : 'Pal';

     this.ngZone.run(() => {
         const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: {
              title: 'Kick Pal',
              message: `Are you sure you want to kick ${visitorName} out of your room?`,
              confirmText: 'Kick',
              isDestructive: true
            },
            width: '400px',
            panelClass: 'custom-dialog-panel'
          });

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.currentlyKickingUserId = visitorId;
              this.friendService.kickUser(this.activeRoomId!, visitorId);
              this.removeRemotePet(visitorId);
              // Reset after a short delay to allow SignalR messages to mismatch if any, 
              // or just after the local removal.
              setTimeout(() => {
                if (this.currentlyKickingUserId === visitorId) this.currentlyKickingUserId = null;
              }, 1000);
            }
            this.hideKickToolbox(); // hide regardless
          });
     });
  }

  private removeRemotePet(uid: string) {
      if (this.selectedVisitor === uid) {
          this.hideKickToolbox();
      }
      const remotePet = this.remotePets.get(uid);
      if (remotePet) {
          const hoverText = (remotePet as any).hoverText;
          if (hoverText) hoverText.destroy();
          remotePet.destroy();
          this.remotePets.delete(uid);
      }
      const bubbles = this.remoteChatBubbles.get(uid);
      if (bubbles) {
          bubbles.forEach(b => b.destroy());
          this.remoteChatBubbles.delete(uid);
      }
  }

  private hideKickToolbox() {
     if (this.kickToolbox) {
         this.kickToolbox.setVisible(false);
     }
     this.selectedVisitor = null;
  }

  private updateKickToolboxPosition() {
     if (this.selectedVisitor && this.kickToolbox) {
         const remotePet = this.remotePets.get(this.selectedVisitor);
         if (remotePet) {
            this.kickToolbox.setPosition(remotePet.x, remotePet.y - 25); // slightly above pet
         } else {
            this.hideKickToolbox();
         }
     }
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
      this.hideKickToolbox();
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
      if (!this.isVisiting) {
        sprite.setInteractive({ draggable: true });
        scene.input.setDraggable(sprite);
      }
      sprite.setDepth(10);
      sprite.setData('item', item);
      sprite.setData('rotation', initialRotation);

      // Add to list
      this.decorSprites.add(sprite);
      
      this.updateToolboxPosition();
      this.refreshCounts();

      // Force initial separation if dropped on top of something (manual resolver)
      this.resolveDecorOverlap(sprite);

      this.resolveDecorOverlap(sprite);

      // Handle interactions
      if (!this.isVisiting) {
        sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) return;
          this.selectDecor(sprite);
        });

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
      }
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

    // Initial position from settings (home) or center spawn when visiting
    let startX = this.settings?.lastPetX || roomCenterX;
    let startY = this.settings?.lastPetY || (roomCenterY + 27);

    if (this.roomOwnerId) {
      startX = roomCenterX;
      startY = roomCenterY;
    }

    this.dog = scene.physics.add.sprite(startX, startY, 'dog').setScale(0.028);
    // Pet stays at 0 default
    this.dog.setCollideWorldBounds(true);
    this.dog.setBounce(0);

    // Camera setup - restore home camera or default center when visiting
    let camX = this.settings?.lastCameraX || roomCenterX;
    let camY = this.settings?.lastCameraY || roomCenterY;
    if (this.roomOwnerId) {
      camX = roomCenterX;
      camY = roomCenterY;
    }
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
        this._initRoomMultiplayer(scene);
    }, 400);
  }

  /** Join the room SignalR group and wire live pet/chat sync events. */
  private _initRoomMultiplayer(scene: Phaser.Scene) {
    if (!this.activeRoomId) return;

    const userId = localStorage.getItem('userId') || '';

    // Join the room group
    this.friendService.joinRoom(this.activeRoomId, userId);

    // Broadcast our initial position so anyone already here sees us
    if (this.dog && userId) {
        this.friendService.syncPetPosition(this.activeRoomId, this.dog.x, this.dog.y, userId);
    }

    // When someone else joins, re-broadcast our position to them
    const joinSub = this.friendService.userJoinedRoomEvents.subscribe((joinedUserId: string) => {
        if (joinedUserId !== userId && this.dog && this.activeRoomId) {
            this.friendService.syncPetPosition(this.activeRoomId, this.dog.x, this.dog.y, userId);
        }
    });

    // Position sync: render or move a remote pet
    const moveSub = this.friendService.roomMoveEvents.subscribe(evt => {
      if (evt.userId === userId) return; // ignore self echoes

      let remotePet = this.remotePets.get(evt.userId);
      if (!remotePet) {
        // Spawn a new remote pet sprite at the received position
        remotePet = scene.physics.add.sprite(evt.x, evt.y, 'dog').setScale(0.028);
        remotePet.setTint(0xa855f7); // purple tint so guest pet is distinguishable
        remotePet.setDepth(5);
        remotePet.setInteractive({ useHandCursor: true });
        
        const matchPal = this.friendService.friends().find(f => f.userId.toString() === evt.userId);
        const visitorName = matchPal ? matchPal.username : 'Pal';

        const hoverText = scene.add.text(evt.x, evt.y - 28, visitorName, {
             fontFamily: "'Quicksand', sans-serif",
             fontSize: '32px',
             color: '#ffffff',
             backgroundColor: 'rgba(0,0,0,0.5)',
             padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setAlpha(0).setScale(0.25).setDepth(25);
        
        (remotePet as any).hoverText = hoverText;

        remotePet.on('pointerover', () => { hoverText.setAlpha(1); });
        remotePet.on('pointerout', () => { hoverText.setAlpha(0); });

        remotePet.on('pointerup', (pointer: Phaser.Input.Pointer, lx: any, ly: any, event: any) => {
             if (this.isHosting) {
                 if (event) event.stopPropagation();
                 this.openKickToolbox(scene, evt.userId, visitorName, remotePet!);
             }
        });

        (remotePet as any).remoteUserId = evt.userId;
        this.remotePets.set(evt.userId, remotePet);
        this.remoteChatBubbles.set(evt.userId, []);
      } else {
        scene.tweens.add({
          targets: remotePet,
          x: evt.x,
          y: evt.y,
          duration: 150,
          ease: 'Cubic.easeOut'
        });
      }
    });

    // Room chat: show a bubble above the correct remote pet
    const chatSub = this.friendService.roomMessageEvents.subscribe(evt => {
      if (evt.userId === userId) return; // own messages shown locally

      const remotePet = this.remotePets.get(evt.userId);
      if (!remotePet) return;

      const bubbles = this.remoteChatBubbles.get(evt.userId) || [];
      this._renderChatBubble(evt.message, remotePet, bubbles);
      this.remoteChatBubbles.set(evt.userId, bubbles);
    });

    const kickedSub = this.friendService.kickedEvents.subscribe((roomOwnerId: string) => {
        if (this.activeRoomId === roomOwnerId) {
            this.showToast("You were kicked from this room.");
            setTimeout(() => this.returnHome(), 1500);
        }
    });

    const decorSyncSub = this.friendService.roomDecorEvents.subscribe(evt => {
      // Ignore our own echo and only apply live decor updates while visiting another room.
      if (evt.userId === userId || !this.roomOwnerId) return;
      this.applyDecorSnapshot(evt.instances);
    });

    const inviteAcceptedSub = this.friendService.visitAcceptedEvents.subscribe((username: string) => {
        this.showToast(`${username} has joined your space`);
    });

    const leftSub = this.friendService.userLeftRoomEvents.subscribe((leftUserId: string) => {
        if (leftUserId !== this.currentlyKickingUserId) {
            const matchPal = this.friendService.friends().find(f => f.userId.toString() === leftUserId);
            const visitorName = matchPal ? matchPal.username : 'A Pal';
            this.showToast(`${visitorName} has left your space`);
        }
        this.removeRemotePet(leftUserId);
    });

    this.roomSubs.push(moveSub, chatSub, joinSub, kickedSub, leftSub, inviteAcceptedSub, decorSyncSub);
  }

  public returnHome() {
    this.router.navigate(['/game']).then(() => {
        window.location.reload();
    });
  }

  public showToast(message: string) {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastMessage = message;
    this.toastTimeout = setTimeout(() => this.toastMessage = null, 3000);
  }

  private loadSavedDecor() {
    const targetUserId = this.roomOwnerId || localStorage.getItem('userId');
    if (!targetUserId) return;

    this.decorService.getSavedDecor(parseInt(targetUserId)).subscribe({
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
        if (!this.isVisiting && this.activeRoomId) {
          this.friendService.syncRoomDecor(this.activeRoomId, userId, instances);
        }
        setTimeout(() => this.isSavingRoom = false, 800); // Keep visible briefly for feedback
      },
      error: (err) => {
        console.error('Failed to save decor:', err);
        this.isSavingRoom = false;
      }
    });
  }

  private applyDecorSnapshot(instances: DecorInstance[]) {
    if (!this.game?.scene?.scenes[0]) return;

    this.clearAllDecor();

    instances.forEach(instance => {
      const item = this.decorService.items().find(i => i.id === instance.decorId);
      if (item) {
        this.addDecorToGame(item, instance.x, instance.y, instance.rotation);
      }
    });

    this.refreshCounts();
  }

  private clearAllDecor() {
    this.deselectDecor();

    if (!this.decorSprites) {
      this.decorService.activeCounts.set({});
      return;
    }

    this.decorSprites.getChildren().forEach((child: any) => child.destroy());
    this.decorSprites.clear(true, true);
    this.decorService.activeCounts.set({});
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
    if (this.roomOwnerId) return;

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

    // Stack local chat bubbles above own pet (Newest at bottom)
    let stackY = -40;
    for (let i = this.chatBubbles.length - 1; i >= 0; i--) {
        const bubble = this.chatBubbles[i];
        bubble.x = this.dog.x;
        const targetY = this.dog.y + stackY - ((bubble as any).originalHeight / 2);
        bubble.y += (targetY - bubble.y) * 0.25;
        stackY -= ((bubble as any).originalHeight + 6);
    }

    // Keep remote pet chat bubbles above their respective sprites
    this.remoteChatBubbles.forEach((bubbles, uid) => {
      const remotePet = this.remotePets.get(uid);
      if (!remotePet) return;
      let remoteStackY = -40;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        bubble.x = remotePet.x;
        const ty = remotePet.y + remoteStackY - ((bubble as any).originalHeight / 2);
        bubble.y += (ty - bubble.y) * 0.25;
        remoteStackY -= ((bubble as any).originalHeight + 6);
      }
    });

    this.remotePets.forEach((remotePet, uid) => {
       const hoverText = (remotePet as any).hoverText;
       if (hoverText) {
           hoverText.x = remotePet.x;
           hoverText.y = remotePet.y - 28;
       }
    });

    this.updateKickToolboxPosition();

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
