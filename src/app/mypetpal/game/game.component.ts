import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
  ElementRef,
  AfterViewInit,
  NgZone
} from '@angular/core';
import * as Phaser from 'phaser';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { PetStreamService } from '../feature/pet/pet-service/pet-stream.service';
import {
  DecorItem,
  DecorService,
  DecorInstance
} from '../../core/decor/decor.service';
import {
  UserSettingsService,
  UserSettings
} from '../../core/user-settings/user-settings.service';
import { ChatService } from './services/chat.service';
import { PetMovementService } from './services/pet-movement.service';
import { DecorManagerService } from './services/decor-manager.service';
import { PlayerLevelService } from './services/player-level.service';
import { RoomMultiplayerService } from './services/room-multiplayer.service';
import { GameSceneService } from './services/game-scene.service';

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
  private scene: Phaser.Scene | null = null;
  private isMoving = false;
  private roomSubs: Subscription[] = [];
  private settingsSaveTimeout: any;
  private lastActivityPingAt = 0;
  private lastLocalInteractionAt = 0;
  private isSleeping = false;

  public isEmojiPickerOpen = false;
  public isGameLoading = true;
  public isSavingRoom = false;
  public toastMessage: string | null = null;
  private toastTimeout: any;

  public currentPlayerLevel = 0;
  public currentPlayerExp = 0;

  private currentZoom = 1.0;
  private settings: UserSettings | null = null;

  public roomOwnerId: string | null = null;
  public activeRoomId: string | null = null;
  private remotePets: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private remoteRestIcons: Map<string, Phaser.GameObjects.Image> = new Map();
  private localRestIcon: Phaser.GameObjects.Image | null = null;
  private remoteChatBubbles: Map<string, Phaser.GameObjects.Container[]> =
    new Map();
  private chatBubbles: Phaser.GameObjects.Container[] = [];

  private decorSprites: Phaser.GameObjects.Group | null = null;
  private selectedDecor: Phaser.GameObjects.Sprite | null = null;
  private decorToolbox: Phaser.GameObjects.Container | null = null;
  private selectionBorder: Phaser.GameObjects.Graphics | null = null;
  private isDraggingDecor = false;

  private arrowGroup: Phaser.GameObjects.Group | null = null;
  private arrowsVisible = false;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private pressedArrowKeys: Set<string> = new Set();
  private arrowHoverSources = 0;
  private arrowHideTimer: ReturnType<typeof setTimeout> | null = null;

  private selectedVisitor: string | null = null;
  private currentlyKickingUserId: string | null = null;
  private kickToolbox: Phaser.GameObjects.Container | null = null;

  // Zzzz icon offset.
  private readonly restIconOffsetX = 8;
  private readonly restIconOffsetY = 15;
  private readonly restIconScale = 0.03;

  readonly emojis = [
    '😂',
    '❤️',
    '😍',
    '👍',
    '😊',
    '🐾',
    '🐶',
    '🐱',
    '✨',
    '🎮',
    '🔥',
    '🎉',
    '😎',
    '🤔',
    '👏',
    '🌟',
    '🎵',
    '😴',
    '😭',
    '😡',
    '🥺',
    '🥳',
    '🙌',
    '👀'
  ];

  get isVisiting(): boolean {
    return !!this.roomOwnerId;
  }

  get isHosting(): boolean {
    return !this.roomOwnerId && this.remotePets.size > 0;
  }

  get visitingUsername(): string {
    if (!this.roomOwnerId) return '';
    return 'a Pal';
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
    private playerLevelService: PlayerLevelService,
    private chatService: ChatService,
    private petMovementService: PetMovementService,
    private decorManagerService: DecorManagerService,
    private roomMultiplayer: RoomMultiplayerService,
    private gameScene: GameSceneService,
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
    this.cancelArrowHide();
    this.playerLevelService.stopRealtimeLevelTracking();
    if (this.settingsSaveTimeout) {
      clearTimeout(this.settingsSaveTimeout);
    }
    if (this.activeRoomId) {
      this.roomMultiplayer.leaveRoom(this.activeRoomId);
    }
    if (this.roomSubs.length > 0) {
      this.roomMultiplayer.cleanupRoom(this.roomSubs);
    }
    if (this.localRestIcon) {
      this.localRestIcon.destroy();
      this.localRestIcon = null;
    }
    const localShadow = (this.dog as any)?.shadow;
    if (localShadow) {
      localShadow.destroy();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.emoji-selector-wrapper')) {
      this.isEmojiPickerOpen = false;
    }
    this.markLocalActivity();
  }

  @HostListener('window:mousedown', ['$event'])
  onWindowClick(event: MouseEvent) {
    if (!this.chatInput) return;

    const clickedInside = this.chatInput.nativeElement.contains(event.target);
    const clickedGame = document
      .getElementById('game-container')
      ?.contains(event.target as Node);
    const isButton = (event.target as HTMLElement).tagName === 'BUTTON';

    if (!clickedInside && !isButton) {
      this.chatInput.nativeElement.blur();
      this.deselectDecor();
      this.hideKickToolbox();
    }
  }

  public toggleEmojiPicker(): void {
    this.isEmojiPickerOpen = !this.isEmojiPickerOpen;
  }

  public addEmoji(emoji: string): void {
    if (this.chatInput?.nativeElement) {
      this.chatService.insertEmojiAtCursor(this.chatInput.nativeElement, emoji);
    }
  }

  public zoomIn(): void {
    this.currentZoom = this.petMovementService.zoomIn(this.currentZoom);
    this.applyZoom();
  }

  public zoomOut(): void {
    this.currentZoom = this.petMovementService.zoomOut(this.currentZoom);
    this.applyZoom();
  }

  public moveStep(direction: string): void {
    if (!this.dog || !this.scene || this.isMoving) return;

    this.markLocalActivity();

    let targetX = this.dog.x;
    let targetY = this.dog.y;
    const stepDist = 4.4;
    const animKey = this.getMovementAnimationKey(direction);

    switch (direction) {
      case 'up':
        targetY -= stepDist;
        break;
      case 'down':
        targetY += stepDist;
        break;
      case 'left':
        targetX -= stepDist;
        break;
      case 'right':
        targetX += stepDist;
        break;
      case 'up-left':
        targetX -= stepDist;
        targetY -= stepDist;
        break;
      case 'up-right':
        targetX += stepDist;
        targetY -= stepDist;
        break;
      case 'down-left':
        targetX -= stepDist;
        targetY += stepDist;
        break;
      case 'down-right':
        targetX += stepDist;
        targetY += stepDist;
        break;
    }

    if (
      this.isInsideFloor(targetX, targetY) &&
      !this.petMovementService.isCollidingWithDecor(
        targetX,
        targetY,
        this.dog,
        this.decorSprites,
        this.scene
      ) &&
      !this.petMovementService.isCollidingWithRemotePets(
        targetX,
        targetY,
        this.remotePets
      )
    ) {
      this.isMoving = true;

      // Only play animation if not already playing it
      if (
        !this.dog.anims.isPlaying ||
        this.dog.anims.currentAnim?.key !== animKey
      ) {
        this.dog.play(animKey);
      }

      this.scene.tweens.add({
        targets: this.dog,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: 'Cubic.easeOut',
        onComplete: () => this.onMoveComplete()
      });
    }
  }

  private getMovementAnimationKey(direction: string): string {
    switch (direction) {
      case 'down':
        return 'walk_down';
      case 'down-right':
        return 'walk_down_right';
      case 'right':
        return 'walk_right';
      case 'up-right':
        return 'walk_up_right';
      case 'up':
        return 'walk_up';
      case 'up-left':
        return 'walk_up_left';
      case 'left':
        return 'walk_left';
      case 'down-left':
        return 'walk_down_left';
      default:
        return 'idle';
    }
  }

  public talk(text: string): void {
    if (!text || !this.dog || !this.scene) return;

    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username') || 'You';

    if (this.activeRoomId && userId) {
      this.roomMultiplayer.sendChatMessage(
        this.activeRoomId,
        text,
        userId,
        username
      );
      this.roomMultiplayer.syncPetPosition(
        this.activeRoomId,
        this.dog.x,
        this.dog.y,
        userId
      );
    }

    this.chatService.renderChatBubble(
      text,
      this.dog,
      this.chatBubbles,
      this.scene!
    );

    this.markLocalActivity();
  }

  public onInputFocus(): void {
    const scene = this.game?.scene?.scenes[0];
    if (scene?.input.keyboard) {
      scene.input.keyboard.enabled = false;
    }
  }

  public onInputBlur(): void {
    const scene = this.game?.scene?.scenes[0];
    if (scene?.input.keyboard) {
      scene.input.keyboard.enabled = true;
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    const data = event.dataTransfer?.getData('decorItem');
    if (!data || !this.scene) return;

    const item: DecorItem = JSON.parse(data);
    const container = document.getElementById('game-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const gameX =
      (x / container.offsetWidth) * (this.scene.game.config.width as number);
    const gameY =
      (y / container.offsetHeight) * (this.scene.game.config.height as number);

    const worldPoint = this.scene.cameras.main.getWorldPoint(gameX, gameY);

    if (!this.isInsideFloor(worldPoint.x, worldPoint.y)) {
      if (this.scene) {
        this.scene.input.activePointer.isDown = false;
        this.scene.input.activePointer.buttons = 0;
        this.scene.input.resetPointers();
      }
      return;
    }

    if (!this.decorManagerService.canAddMoreDecor(item, this.decorSprites)) {
      this.showToast(
        item.category === 'wall'
          ? 'Max 50 walls allowed!'
          : `Max 10 ${item.name} allowed!`
      );
      if (this.scene) {
        this.scene.input.resetPointers();
      }
      return;
    }

    this.addDecor(item, worldPoint.x, worldPoint.y);
    this.saveRoomLayout();

    if (this.scene) {
      this.scene.input.activePointer.isDown = false;
      this.scene.input.activePointer.buttons = 0;
      this.scene.input.resetPointers();
    }
  }

  public stopMove(): void {}

  public returnHome(): void {
    this.router.navigate(['/game']).then(() => {
      window.location.reload();
    });
  }

  public showToast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastMessage = message;
    this.toastTimeout = setTimeout(() => (this.toastMessage = null), 3000);
  }

  public getExpForNextLevel(): number {
    return this.playerLevelService.getExpForNextLevel(this.currentPlayerLevel);
  }

  public getCurrentLevelExp(): number {
    return this.playerLevelService.getCurrentLevelExp(
      this.currentPlayerLevel,
      this.currentPlayerExp
    );
  }

  public getExpProgressPercent(): number {
    return this.playerLevelService.getExpProgressPercent(
      this.currentPlayerLevel,
      this.currentPlayerExp
    );
  }

  public openKickToolbox(
    scene: Phaser.Scene,
    userId: string,
    visitorName: string,
    sprite: Phaser.GameObjects.Sprite
  ): void {
    this.selectedVisitor = userId;
    if (!this.kickToolbox) {
      const kickText = scene.add
        .text(0, 0, 'Kick out', {
          fontFamily: "'Quicksand', sans-serif",
          fontSize: '32px',
          color: '#ffffff',
          backgroundColor: '#ef4444',
          padding: { x: 8, y: 4 }
        })
        .setOrigin(0.5);

      this.kickToolbox = scene.add.container(0, 0, [kickText]);
      this.kickToolbox.setDepth(30);
      this.kickToolbox.setScale(0.25);

      kickText.setInteractive({ useHandCursor: true });
      kickText.on(
        'pointerdown',
        (pointer: Phaser.Input.Pointer, lx: any, ly: any, event: any) => {
          if (event) event.stopPropagation();
          this.kickSelectedVisitor();
        }
      );
    }

    this.kickToolbox.setVisible(true);
    this.updateKickToolboxPosition();
  }

  private kickSelectedVisitor(): void {
    if (!this.selectedVisitor || !this.activeRoomId) return;

    this.roomMultiplayer.kickUserFromRoom(
      this.activeRoomId,
      this.selectedVisitor,
      () => {
        this.currentlyKickingUserId = this.selectedVisitor;
        this.removeRemotePet(this.selectedVisitor!);
        setTimeout(() => {
          if (this.currentlyKickingUserId === this.selectedVisitor)
            this.currentlyKickingUserId = null;
        }, 1000);
      }
    );
  }

  private updateKickToolboxPosition(): void {
    if (this.selectedVisitor && this.kickToolbox) {
      const remotePet = this.remotePets.get(this.selectedVisitor);
      if (remotePet) {
        this.kickToolbox.setPosition(remotePet.x, remotePet.y - 25);
      } else {
        this.hideKickToolbox();
      }
    }
  }

  private hideKickToolbox(): void {
    if (this.kickToolbox) {
      this.kickToolbox.setVisible(false);
    }
    this.selectedVisitor = null;
  }

  private removeRemotePet(userId: string): void {
    if (this.selectedVisitor === userId) {
      this.hideKickToolbox();
    }
    const remotePet = this.remotePets.get(userId);
    if (remotePet) {
      const shadow = (remotePet as any).shadow;
      if (shadow) shadow.destroy();
      const hoverText = (remotePet as any).hoverText;
      if (hoverText) hoverText.destroy();
      remotePet.destroy();
      this.remotePets.delete(userId);
    }
    const restIcon = this.remoteRestIcons.get(userId);
    if (restIcon) {
      restIcon.destroy();
      this.remoteRestIcons.delete(userId);
    }
    const bubbles = this.remoteChatBubbles.get(userId);
    if (bubbles) {
      bubbles.forEach(b => b.destroy());
      this.remoteChatBubbles.delete(userId);
    }
  }

  private updateRemoteRestIcon(userId: string, isOnline: boolean): void {
    const existing = this.remoteRestIcons.get(userId);
    if (isOnline) {
      if (existing) {
        existing.destroy();
        this.remoteRestIcons.delete(userId);
      }
      return;
    }

    const remotePet = this.remotePets.get(userId);
    if (!remotePet || !this.scene) {
      return;
    }

    if (existing && existing.active) {
      return;
    }

    const icon = this.scene.add
      .image(
        remotePet.x + this.restIconOffsetX,
        remotePet.y - this.restIconOffsetY,
        'rest'
      )
      .setScale(this.restIconScale)
      .setDepth(26);
    this.remoteRestIcons.set(userId, icon);
  }

  private async initialize(): Promise<void> {
    this.roomOwnerId = this.route.snapshot.paramMap.get('roomOwnerId');
    const myId = localStorage.getItem('userId');
    this.activeRoomId = this.roomOwnerId || myId;

    if (!(await this.getPetDetails())) {
      return;
    }

    if (myId) {
      try {
        const s = await this.userSettingsService
          .getSettings(parseInt(myId))
          .toPromise();
        if (s) {
          this.settings = s;
          this.currentZoom = s.zoomLevel || 5.0;
        }
      } catch (e) {
        console.warn('Settings load failed:', e);
      }

      try {
        const levelData =
          await this.playerLevelService.ensureInitialLevelLoaded(myId);
        this.currentPlayerLevel = levelData.level;
        this.currentPlayerExp = levelData.exp;

        this.playerLevelService.startRealtimeLevelTracking(myId, {
          onLeveledUp: (newLevel, totalExp) => {
            this.currentPlayerLevel = newLevel;
            this.currentPlayerExp = totalExp;
            if (this.dog && this.scene) {
              this.playerLevelService.playLeveledUpAnimation(
                this.scene,
                this.dog,
                newLevel
              );
            }
          },
          onExperienceUpdated: totalExp => {
            this.currentPlayerExp = totalExp;
            this.currentPlayerLevel =
              this.playerLevelService.calculateLevelFromExpPublic(totalExp);
          }
        });
      } catch (e) {
        console.warn('Player level load failed:', e);
      }

      this.markLocalActivity();
    }

    setTimeout(() => this.initializeGame(), 100);
  }

  private async getPetDetails(): Promise<boolean> {
    let pet = this.petStreamService.currentPetStream.getValue();

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

  private initializeGame(): void {
    const container = document.getElementById('game-container');
    const width = container?.offsetWidth || window.innerWidth;
    const height = container?.offsetHeight || window.innerHeight;

    this.game = new Phaser.Game(
      this.gameScene.createGameConfig('game-container', {
        preload: scene => this.preload(scene),
        create: scene => this.create(scene),
        update: scene => this.update(scene)
      })
    );
    this.game.canvas.style.backgroundColor = 'transparent';
  }

  private preload(scene: Phaser.Scene): void {
    this.gameScene.preloadAssets(scene);
  }

  private create(scene: Phaser.Scene): void {
    this.scene = scene;
    const center = this.gameScene.getWorldCenter();
    const startX = this.settings?.lastPetX || center.x;
    const startY = this.settings?.lastPetY || center.y + 27;

    let dogX = startX;
    let dogY = startY;
    let camX = this.settings?.lastCameraX || center.x;
    let camY = this.settings?.lastCameraY || center.y;

    if (this.roomOwnerId) {
      dogX = center.x;
      dogY = center.y;
      camX = center.x;
      camY = center.y;
    }

    this.dog = this.gameScene.setupScene(
      scene,
      dogX,
      dogY,
      camX,
      camY,
      this.currentZoom,
      () => {
        this.loadSavedDecor();
        this.initRoomMultiplayer();
        this.isGameLoading = false;
      }
    );

    const hoverZone = this.gameScene.setupPetInteractiveZone(
      scene,
      () => this.onArrowHoverStart(scene),
      () => this.onArrowHoverEnd()
    );
    (this as any)._hoverZone = hoverZone;

    this.gameScene.setupCameraPanning(
      scene,
      () => this.saveUserSettings(),
      () => !this.isDraggingDecor
    );
    this.gameScene.setupMouseWheelZoom(scene, dir => {
      if (dir === 'in') this.zoomIn();
      else this.zoomOut();
    });

    const keyboardSetup = this.gameScene.setupKeyboardControls(scene, key =>
      this.moveStep(key)
    );
    this.cursors = keyboardSetup.cursors;
    this.pressedArrowKeys = keyboardSetup.keys;

    scene.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, gameObjects: any[]) => {
        if (gameObjects.length === 0) {
          this.deselectDecor();
        }
      }
    );
  }

  private setupArrows(scene: Phaser.Scene): void {
    if (!this.dog) return;

    if (!this.arrowGroup && this.scene) {
      const arrowOffset = 18;
      const arrowUp = this.createArrow(scene, 'up', 0, -arrowOffset, 0);
      const arrowDown = this.createArrow(scene, 'down', 0, arrowOffset, 180);
      const arrowLeft = this.createArrow(scene, 'left', -arrowOffset, 0, 270);
      const arrowRight = this.createArrow(scene, 'right', arrowOffset, 0, 90);

      this.arrowGroup = scene.add.group([
        arrowUp,
        arrowDown,
        arrowLeft,
        arrowRight
      ]);
    }

    this.cancelArrowHide();
    this.arrowsVisible = true;
    this.arrowGroup?.getChildren().forEach((c: any) => {
      scene.tweens.killTweensOf(c);
      scene.tweens.add({ targets: c, alpha: 0.45, scale: 1, duration: 150 });
    });
  }

  private createArrow(
    scene: Phaser.Scene,
    direction: string,
    offsetX: number,
    offsetY: number,
    angle: number
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

    const container = scene.add.container(0, 0, [graphics]);
    container.setAngle(angle);
    container.setAlpha(0);
    container.setScale(1);
    container.setDepth(15);

    const hitArea = new Phaser.Geom.Circle(0, 0, 18);
    container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
    container.setInteractive({ useHandCursor: true });

    (container as any).offsetX = offsetX;
    (container as any).offsetY = offsetY;

    container.on('pointerover', () => {
      this.onArrowHoverStart(scene);
      scene.tweens.killTweensOf(container);
      scene.tweens.add({
        targets: container,
        scale: 1.35,
        alpha: 0.95,
        duration: 120,
        ease: 'Back.Out'
      });
    });
    container.on('pointerout', () => {
      this.onArrowHoverEnd();
      scene.tweens.killTweensOf(container);
      scene.tweens.add({
        targets: container,
        scale: 1,
        alpha: 0.45,
        duration: 120,
        ease: 'Cubic.Out'
      });
    });
    container.on('pointerdown', () => this.moveStep(direction));

    return container;
  }

  private onArrowHoverStart(scene: Phaser.Scene): void {
    this.arrowHoverSources += 1;
    this.setupArrows(scene);
  }

  private onArrowHoverEnd(): void {
    this.arrowHoverSources = Math.max(0, this.arrowHoverSources - 1);
    this.scheduleArrowHide();
  }

  private scheduleArrowHide(): void {
    this.cancelArrowHide();
    this.arrowHideTimer = setTimeout(() => {
      if (this.arrowHoverSources === 0) {
        this.hideArrows();
      }
    }, 100);
  }

  private cancelArrowHide(): void {
    if (this.arrowHideTimer) {
      clearTimeout(this.arrowHideTimer);
      this.arrowHideTimer = null;
    }
  }

  private hideArrows(): void {
    if (!this.arrowsVisible || !this.scene) return;
    this.arrowsVisible = false;
    this.arrowGroup?.getChildren().forEach((c: any) => {
      this.scene!.tweens.killTweensOf(c);
      this.scene!.tweens.add({
        targets: c,
        alpha: 0,
        scale: 0.9,
        duration: 250
      });
    });
  }

  private addDecor(
    item: DecorItem,
    x: number,
    y: number,
    initialRotation: string = 'SE',
    onAdded?: () => void
  ): void {
    if (!this.scene) return;

    this.decorManagerService.addDecorToGame(
      this.scene,
      item,
      x,
      y,
      initialRotation,
      sprite => {
        if (!this.decorSprites) {
          this.decorSprites = this.scene!.physics.add.group();
          this.scene!.physics.add.collider(
            this.decorSprites,
            this.decorSprites
          );
          if (this.dog) {
            this.scene!.physics.add.collider(this.dog, this.decorSprites);
          }
        }

        this.decorSprites!.add(sprite);
        this.setupDecorInteractions(sprite);
        this.decorManagerService.refreshDecorCounts(this.decorSprites);
        if (onAdded) {
          onAdded();
        }
      }
    );
  }

  private setupDecorInteractions(sprite: Phaser.Physics.Arcade.Sprite): void {
    if (this.isVisiting) return;
    if (!this.scene) return;

    sprite.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(sprite, false);

    sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.selectDecor(sprite);
    });

    sprite.on('dragstart', () => {
      this.isDraggingDecor = true;
      this.selectDecor(sprite);
      sprite.setData('origX', sprite.x);
      sprite.setData('origY', sprite.y);
      sprite.setAlpha(0.6);
      sprite.setImmovable(false);
    });

    sprite.on(
      'drag',
      (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (this.isInsideFloor(dragX, dragY)) {
          sprite.setPosition(dragX, dragY);
          this.updateToolboxPosition();
        }
      }
    );

    sprite.on('dragend', () => {
      this.isDraggingDecor = false;
      sprite.setAlpha(1.0);
      sprite.setImmovable(true);

      this.decorManagerService.resolveDecorOverlap(
        sprite,
        this.scene!,
        this.decorSprites!
      );
      this.updateToolboxPosition();

      const moved =
        Math.abs(sprite.x - sprite.getData('origX')) > 1 ||
        Math.abs(sprite.y - sprite.getData('origY')) > 1;
      if (moved) {
        this.saveRoomLayout();
      }
    });
  }

  private selectDecor(sprite: Phaser.GameObjects.Sprite): void {
    this.deselectDecor();
    this.selectedDecor = sprite;
    this.setActiveDecorForDragging(sprite);
    if (this.scene) {
      this.decorManagerService.selectDecor(sprite, this.scene, () => {});
      if (!this.decorToolbox && !this.isVisiting) {
        this.decorToolbox = this.decorManagerService.setupDecorToolbox(
          this.scene,
          () => this.toggleRotation(),
          () => this.deleteSelectedDecor()
        );
      }
      this.decorToolbox?.setVisible(true);
      this.updateToolboxPosition();
    }
  }

  private deselectDecor(): void {
    if (this.selectedDecor) {
      this.selectedDecor.clearTint();
      const border = (this.selectedDecor as any).__selectionBorder;
      if (border) border.setVisible(false);
      this.selectedDecor = null;
    }
    this.setActiveDecorForDragging(null);
    if (this.decorToolbox) {
      this.decorToolbox.setVisible(false);
    }
  }

  private setActiveDecorForDragging(
    active: Phaser.GameObjects.Sprite | null
  ): void {
    if (!this.scene || !this.decorSprites) return;

    this.decorSprites.getChildren().forEach(child => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      this.scene!.input.setDraggable(sprite, sprite === active);
    });
  }

  private updateToolboxPosition(): void {
    if (this.selectedDecor && this.decorToolbox) {
      const x = this.selectedDecor.x;
      const y = this.selectedDecor.y - this.selectedDecor.displayHeight / 2 - 8;
      this.decorToolbox.setPosition(x, y);
    }
  }

  private deleteSelectedDecor(): void {
    if (!this.selectedDecor || !this.decorSprites) return;

    const sprite = this.selectedDecor;
    this.decorManagerService.deleteDecor(sprite, this.decorSprites);
    this.deselectDecor();
    this.saveRoomLayout();
  }

  private toggleRotation(): void {
    if (!this.selectedDecor || !this.scene) return;

    this.decorManagerService.toggleRotation(this.selectedDecor);
    this.decorManagerService.resolveDecorOverlap(
      this.selectedDecor,
      this.scene,
      this.decorSprites!
    );
    this.saveRoomLayout();
  }

  private loadSavedDecor(): void {
    const targetUserId = this.roomOwnerId || localStorage.getItem('userId');
    if (!targetUserId) return;

    this.decorService.getSavedDecor(parseInt(targetUserId)).subscribe({
      next: instances => {
        if (!instances || instances.length === 0) {
          this.decorManagerService.refreshDecorCounts(this.decorSprites);
          this.decorService.isRoomLoaded.set(true);
          return;
        }

        const availableIds = new Set(this.decorService.items().map(i => i.id));
        let pendingAdds = instances.filter(i => availableIds.has(i.decorId)).length;
        if (pendingAdds === 0) {
          this.decorManagerService.refreshDecorCounts(this.decorSprites);
          this.decorService.isRoomLoaded.set(true);
          return;
        }

        const onDecorAdded = () => {
          pendingAdds -= 1;
          if (pendingAdds === 0) {
            this.decorManagerService.refreshDecorCounts(this.decorSprites);
            this.decorService.isRoomLoaded.set(true);
          }
        };

        this.decorManagerService.restoreDecorSnapshot(
          this.scene!,
          instances,
          (item, x, y, rotation) => {
            this.addDecor(item, x, y, rotation, onDecorAdded);
          }
        );
      },
      error: err => {
        console.error('Failed to load decor:', err);
        this.decorService.isRoomLoaded.set(true);
      }
    });
  }

  private saveRoomLayout(): void {
    const userId = localStorage.getItem('userId');
    if (!userId || !this.decorSprites || this.isVisiting) return;

    this.decorManagerService.refreshDecorCounts(this.decorSprites);
    const instances = this.decorManagerService.getDecorInstances(
      this.decorSprites,
      parseInt(userId)
    );

    this.isSavingRoom = true;
    this.decorService.saveDecor(parseInt(userId), instances).subscribe({
      next: () => {
        if (this.activeRoomId) {
          this.roomMultiplayer.syncDecorChanges(
            this.activeRoomId,
            userId,
            instances
          );
        }
        setTimeout(() => (this.isSavingRoom = false), 800);
      },
      error: err => {
        console.error('Failed to save decor:', err);
        this.isSavingRoom = false;
      }
    });
  }

  private isInsideFloor(x: number, y: number): boolean {
    if (!this.scene) return true;

    const centerX = 1000;
    const centerY = 1000;
    const lx = x - centerX;
    const ly = y - centerY;

    if (162 * lx - 290 * ly - 37700 > 0) return false;
    if (144 * lx + 290 * ly - 51040 > 0) return false;
    if (-154 * lx + 285 * ly - 50160 > 0) return false;
    if (-152 * lx - 285 * ly - 37050 > 0) return false;

    return true;
  }

  private saveUserSettings(): void {
    if (this.roomOwnerId || !this.dog || !this.scene) return;

    if (this.settingsSaveTimeout) {
      clearTimeout(this.settingsSaveTimeout);
    }

    this.settingsSaveTimeout = setTimeout(() => {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      this.userSettingsService
        .saveSettings({
          userId: parseInt(userId),
          lastPetX: this.dog.x,
          lastPetY: this.dog.y,
          lastCameraX: this.scene!.cameras.main.midPoint.x,
          lastCameraY: this.scene!.cameras.main.midPoint.y,
          zoomLevel: this.currentZoom,
          isMuted: this.settings?.isMuted || false,
          musicVolume: this.settings?.musicVolume || 0.5,
          soundVolume: this.settings?.soundVolume || 0.5
        })
        .subscribe();
    }, 5000);
  }

  private applyZoom(): void {
    if (this.scene) {
      this.petMovementService.applyZoom(this.scene, this.currentZoom, () =>
        this.saveUserSettings()
      );
    }
  }

  private onMoveComplete(): void {
    this.isMoving = false;
    if (this.dog) {
      // Delay the idle animation for a smoother transition from walk
      // Only switch to idle if no keys are currently held
      setTimeout(() => {
        if (this.dog && this.pressedArrowKeys.size === 0) {
          this.dog.play('idle');
        }
      }, 200);
    }
    this.saveUserSettings();
    this.markLocalActivity();

    const userId = localStorage.getItem('userId');
    if (this.activeRoomId && userId && this.dog) {
      this.roomMultiplayer.syncPetPosition(
        this.activeRoomId,
        this.dog.x,
        this.dog.y,
        userId
      );
    }
  }

  private reportActivityThrottled(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const now = Date.now();
    const throttleMs = 20000;
    if (now - this.lastActivityPingAt < throttleMs) {
      return;
    }

    this.lastActivityPingAt = now;
    void this.roomMultiplayer.reportActivity(userId).catch(err => {
      console.warn('Failed to report activity heartbeat:', err);
    });
  }

  private markLocalActivity(): void {
    this.lastLocalInteractionAt = Date.now();
    this.wakeDog();
    if (this.localRestIcon) {
      this.localRestIcon.destroy();
      this.localRestIcon = null;
    }
    this.reportActivityThrottled();
  }

  private wakeDog(): void {
    this.isSleeping = false;

    if (!this.dog) return;

    if (this.dog.anims?.currentAnim) {
      this.dog.anims.resume();
    }
  }

  private setDogSleeping(): void {
    if (!this.dog || this.isSleeping) return;

    this.isSleeping = true;
    this.dog.anims.stop();
    this.dog.setFrame(50);
  }

  private initRoomMultiplayer(): void {
    if (!this.activeRoomId || !this.scene) return;

    this.roomSubs = this.roomMultiplayer.initializeRoom(
      this.activeRoomId,
      localStorage.getItem('userId') || '',
      this.dog,
      this.scene,
      {
        onRemotePetSpawned: (userId, sprite) => {
          this.remotePets.set(userId, sprite);
          this.remoteChatBubbles.set(userId, []);
        },
        onRemotePetMoved: (userId, x, y) => {},
        onRemoteChatReceived: (userId, message, remotePet) => {
          const bubbles = this.remoteChatBubbles.get(userId) || [];
          this.chatService.renderChatBubble(
            message,
            remotePet,
            bubbles,
            this.scene!
          );
          this.remoteChatBubbles.set(userId, bubbles);
        },
        onPlayerKicked: () => {
          this.showToast('You were kicked from this room.');
          setTimeout(() => this.returnHome(), 1500);
        },
        onRemotePetLeft: userId => {
          if (userId !== this.currentlyKickingUserId) {
            this.showToast('A Pal has left your space');
          }
          this.removeRemotePet(userId);
        },
        onRemoteStatusChanged: (userId, isOnline) => {
          this.updateRemoteRestIcon(userId, isOnline);
        },
        onVisitorJoined: username => {
          this.showToast(`${username} has joined your space`);
        },
        onDecorUpdated: instances => {
          if (this.roomOwnerId) {
            this.decorManagerService.clearAllDecor(this.decorSprites);
            this.decorManagerService.restoreDecorSnapshot(
              this.scene!,
              instances,
              (item, x, y, rotation) => {
                this.addDecor(item, x, y, rotation);
              }
            );
          }
        }
      }
    );
  }

  private update(scene: Phaser.Scene): void {
    if (!this.dog) return;

    // Handle continuous movement from held arrow keys
    if (!this.isMoving && this.pressedArrowKeys.size > 0) {
      // Check for diagonal movements first
      const hasUp = this.pressedArrowKeys.has('up');
      const hasDown = this.pressedArrowKeys.has('down');
      const hasLeft = this.pressedArrowKeys.has('left');
      const hasRight = this.pressedArrowKeys.has('right');

      // Diagonal movements
      if (hasUp && hasLeft) {
        this.moveStep('up-left');
      } else if (hasUp && hasRight) {
        this.moveStep('up-right');
      } else if (hasDown && hasLeft) {
        this.moveStep('down-left');
      } else if (hasDown && hasRight) {
        this.moveStep('down-right');
      }
      // Single direction movements (with priority)
      else if (hasDown) {
        this.moveStep('down');
      } else if (hasUp) {
        this.moveStep('up');
      } else if (hasRight) {
        this.moveStep('right');
      } else if (hasLeft) {
        this.moveStep('left');
      }
    }

    const hz = (this as any)._hoverZone;
    if (hz) {
      hz.x = this.dog.x;
      hz.y = this.dog.y;
    }

    if (this.arrowGroup) {
      this.arrowGroup.getChildren().forEach((c: any) => {
        c.x = this.dog.x + c.offsetX;
        c.y = this.dog.y + c.offsetY;
      });
    }

    let stackY = -40;
    for (let i = this.chatBubbles.length - 1; i >= 0; i--) {
      const bubble = this.chatBubbles[i];
      bubble.x = this.dog.x;
      const targetY = this.dog.y + stackY - (bubble as any).originalHeight / 2;
      bubble.y += (targetY - bubble.y) * 0.25;
      stackY -= (bubble as any).originalHeight + 6;
    }

    this.remoteChatBubbles.forEach(bubbles => {
      const remotePet = Array.from(this.remotePets.values()).find(
        p => bubbles === this.remoteChatBubbles.get((p as any).remoteUserId)
      );
      if (!remotePet) return;

      let remoteStackY = -40;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        bubble.x = remotePet.x;
        const ty =
          remotePet.y + remoteStackY - (bubble as any).originalHeight / 2;
        bubble.y += (ty - bubble.y) * 0.25;
        remoteStackY -= (bubble as any).originalHeight + 6;
      }
    });

    this.remotePets.forEach(remotePet => {
      const hoverText = (remotePet as any).hoverText;
      if (hoverText) {
        hoverText.x = remotePet.x;
        hoverText.y = remotePet.y - 28;
      }
    });

    this.syncPetShadow(this.dog);
    this.remotePets.forEach(remotePet => this.syncPetShadow(remotePet));

    this.remoteRestIcons.forEach((icon, userId) => {
      const remotePet = this.remotePets.get(userId);
      if (!remotePet || !icon.active) {
        return;
      }
      icon.x = remotePet.x + this.restIconOffsetX;
      icon.y = remotePet.y - this.restIconOffsetY;
    });

    this.updateKickToolboxPosition();

    const isLocalIdle = Date.now() - this.lastLocalInteractionAt >= 60000;
    if (isLocalIdle && this.dog) {
      if (!this.localRestIcon && this.scene) {
        this.setDogSleeping();
        this.localRestIcon = this.scene.add
          .image(
            this.dog.x + this.restIconOffsetX,
            this.dog.y - this.restIconOffsetY,
            'rest'
          )
          .setScale(this.restIconScale)
          .setDepth(26);
      }
    } else if (this.localRestIcon) {
      this.localRestIcon.destroy();
      this.localRestIcon = null;
    }

    if (this.localRestIcon && this.localRestIcon.active && this.dog) {
      this.localRestIcon.x = this.dog.x + this.restIconOffsetX;
      this.localRestIcon.y = this.dog.y - this.restIconOffsetY;
    }

    if (!this.isInsideFloor(this.dog.x, this.dog.y)) {
      this.dog.body.setVelocity(0, 0);
      const sc = scene as any;
      this.dog.x += (sc.centerX - this.dog.x) * 0.1;
      this.dog.y += (sc.centerY + 27 - this.dog.y) * 0.1;
    }
  }

  private calculateLevelFromExp(totalExp: number): number {
    if (totalExp < 10) return 0;
    const normalized = totalExp / 5.0;
    const level = Math.floor((Math.sqrt(1 + 4 * normalized) - 1) / 2);
    return Math.max(0, level);
  }

  private syncPetShadow(pet: Phaser.GameObjects.Sprite | null): void {
    if (!pet) return;

    const shadow = (pet as any).shadow as
      | Phaser.GameObjects.Container
      | undefined;
    if (!shadow || !shadow.active) return;

    shadow.x = pet.x - 3;
    shadow.y = pet.y + 10;
  }
}
