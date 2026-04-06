import {
  Directive,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
  AfterViewInit,
  NgZone
} from '@angular/core';
import * as Phaser from 'phaser';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { PetStreamService } from '../feature/pet/pet-service/pet-stream.service';
import { PetService } from '../feature/pet/pet-service/pet.service';
import { Pet, RoomKey } from '../feature/pet/pet';
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
import { GameSidePanelsComponent } from './components/game-side-panels/game-side-panels.component';
import { GameTutorialService } from './services/game-tutorial.service';

@Directive()
export class GameComponentCore implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sidePanels') sidePanels?: GameSidePanelsComponent;

  private game!: Phaser.Game;
  private dog: any;
  private scene: Phaser.Scene | null = null;
  private isMoving = false;
  private roomSubs: Subscription[] = [];
  private settingsSaveTimeout: any;
  private lastActivityPingAt = 0;
  private lastLocalInteractionAt = 0;
  private isSleeping = false;

  public isGameLoading = true;
  public isSavingRoom = false;
  public toastMessage: string | null = null;
  private toastTimeout: any;

  public currentPlayerLevel = 1;
  public currentPlayerExp = 0;
  public showTutorial = false;
  public tutorialStepIndex = 0;
  public readonly totalTutorialSteps: number;
  public tutorialSpotStyles: Record<string, Record<string, string>> = {
    pet: { display: 'none' },
    decor: { display: 'none' },
    friends: { display: 'none' }
  };

  private currentZoom = 1.0;
  private settings: UserSettings | null = null;
  private currentPet: Pet | null = null;
  private selectedPetAssetKey: string = 'GoldenRetriever_spritesheet';
  private selectedRoomKey: RoomKey = 'room1';

  public roomOwnerId: string | null = null;
  public roomOwnerUsername: string | null = null;
  public isHomeViewMode = false;
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
  private readonly gameRouteContextStorageKey = 'mpp_game_route_context';
  private snapshotRoamTimer: Phaser.Time.TimerEvent | null = null;
  private snapshotRoamTween: Phaser.Tweens.Tween | null = null;

  // Zzzz icon offset.
  private readonly restIconOffsetX = 8;
  private readonly restIconOffsetY = 15;
  private readonly restIconScale = 0.03;
  private readonly depthScale = 0.01;
  private readonly shadowDepthOffset = 0.2;
  private readonly spriteFootOffsetFactor = 0.35;
  private readonly minZoomLevel = 2;
  private readonly maxZoomLevel = 12;
  private readonly defaultZoomLevel = 6.0;
  private isPinchZooming = false;
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;

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

  get isRealtimeVisit(): boolean {
    return !!this.roomOwnerId && !this.isHomeViewMode;
  }

  get isHosting(): boolean {
    return !this.roomOwnerId && this.remotePets.size > 0;
  }

  get visitingUsername(): string {
    if (!this.roomOwnerId) return '';
    const ownerName = this.roomOwnerUsername?.trim() || 'User';
    return `${this.isHomeViewMode ? 'Viewing' : 'Visiting'} ${ownerName}'s pet home`;
  }

  get hostingCount(): number {
    return this.remotePets.size;
  }

  get currentVisitorIds(): number[] {
    return Array.from(this.remotePets.keys())
      .map(id => parseInt(id, 10))
      .filter(id => !Number.isNaN(id));
  }

  get currentTutorialStep() {
    return this.gameTutorialService.getStep(this.tutorialStepIndex);
  }

  get isTutorialLastStep(): boolean {
    return this.gameTutorialService.isLastStep(this.tutorialStepIndex);
  }

  constructor(
    private petStreamService: PetStreamService,
    private petService: PetService,
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
    private gameTutorialService: GameTutorialService,
    private ngZone: NgZone
  ) {
    this.totalTutorialSteps = this.gameTutorialService.getStepCount();
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initialize();
  }

  ngOnDestroy(): void {
    this.stopSnapshotRoaming();

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
    this.markLocalActivity();
  }

  @HostListener('window:mousedown', ['$event'])
  onWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const clickedInsideChatControls = !!target.closest(
      'app-game-chat-controls'
    );
    const isButton = (event.target as HTMLElement).tagName === 'BUTTON';

    if (!clickedInsideChatControls && !isButton) {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.tagName === 'INPUT') {
        activeElement.blur();
      }
      this.deselectDecor();
      this.hideKickToolbox();
    }
  }

  @HostListener('window:replay-tutorial')
  onReplayTutorialRequested(): void {
    const currentUserId =
      localStorage.getItem('id') || localStorage.getItem('userId');

    if (currentUserId) {
      localStorage.setItem('firstTimeTutorialPendingFor', currentUserId);
      localStorage.removeItem(`firstTimeTutorialCompleted:${currentUserId}`);
    }

    if (this.isGameLoading || this.isVisiting) {
      return;
    }

    this.collapsePanelsForTutorial();
    this.tutorialStepIndex = 0;
    this.showTutorial = true;
    this.applyTutorialStepFocus();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.showTutorial) {
      this.updateTutorialSpotStyles();
    }
  }

  @HostListener('window:mpp-switch-view-home', ['$event'])
  onSwitchViewHome(event: Event): void {
    const customEvent = event as CustomEvent<{
      mode?: string;
      roomOwnerId?: string | number;
      roomOwnerUsername?: string;
    }>;

    const mode = customEvent.detail?.mode;
    const roomOwnerId = customEvent.detail?.roomOwnerId;

    if (mode !== 'viewMode' || roomOwnerId == null) {
      return;
    }

    const nextRoomOwnerId = String(roomOwnerId);
    const nextRoomOwnerUsername = customEvent.detail?.roomOwnerUsername || null;

    if (
      this.isHomeViewMode &&
      this.roomOwnerId === nextRoomOwnerId &&
      this.roomOwnerUsername === nextRoomOwnerUsername
    ) {
      return;
    }

    void this.rebuildSceneForHomeViewTarget(
      nextRoomOwnerId,
      nextRoomOwnerUsername
    );
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
    if (this.isHomeViewMode) return;
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

  private movePetToPoint(targetX: number, targetY: number): void {
    if (!this.dog || !this.scene) {
      return;
    }

    const startX = this.dog.x;
    const startY = this.dog.y;

    const wasMoving = this.isMoving;
    if (wasMoving) {
      this.cancelCurrentMovement();
    }

    const safeTarget = this.resolveSafeTouchTarget(
      startX,
      startY,
      targetX,
      targetY
    );
    const travelDistance = Phaser.Math.Distance.Between(
      startX,
      startY,
      safeTarget.x,
      safeTarget.y
    );

    if (travelDistance < 0.5) {
      if (wasMoving) {
        this.dog.play('idle');
        this.saveUserSettings();
      }
      return;
    }

    const deltaX = safeTarget.x - this.dog.x;
    const deltaY = safeTarget.y - this.dog.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    let direction = 'down';
    if (absX > absY) {
      direction = deltaX < 0 ? 'left' : 'right';
    } else {
      direction = deltaY < 0 ? 'up' : 'down';
    }

    this.markLocalActivity();
    this.isMoving = true;
    this.dog.play(this.getMovementAnimationKey(direction));

    const distance = Phaser.Math.Distance.Between(
      this.dog.x,
      this.dog.y,
      safeTarget.x,
      safeTarget.y
    );
    const duration = Math.max(180, distance * 45);

    const fastPhaseRatio = 0.88;
    const midX = this.dog.x + (safeTarget.x - this.dog.x) * fastPhaseRatio;
    const midY = this.dog.y + (safeTarget.y - this.dog.y) * fastPhaseRatio;
    const fastDuration = Math.max(120, Math.floor(duration * fastPhaseRatio));
    const settleDuration = Math.max(70, duration - fastDuration);

    this.scene.tweens.add({
      targets: this.dog,
      x: midX,
      y: midY,
      duration: fastDuration,
      ease: 'Linear',
      onComplete: () => {
        this.scene?.tweens.add({
          targets: this.dog,
          x: safeTarget.x,
          y: safeTarget.y,
          duration: settleDuration,
          ease: 'Sine.easeOut',
          onComplete: () => this.onMoveComplete()
        });
      }
    });
  }

  private resolveSafeTouchTarget(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): { x: number; y: number } {
    if (!this.dog || !this.scene) {
      return { x: startX, y: startY };
    }

    const totalDistance = Phaser.Math.Distance.Between(
      startX,
      startY,
      targetX,
      targetY
    );

    if (totalDistance < 0.001) {
      return { x: startX, y: startY };
    }

    // Sample the path to avoid tunneling through decor when the touch target is far away.
    const sampleStep = 2;
    let lastSafeX = startX;
    let lastSafeY = startY;

    for (
      let distance = sampleStep;
      distance <= totalDistance;
      distance += sampleStep
    ) {
      const t = Math.min(1, distance / totalDistance);
      const sampleX = startX + (targetX - startX) * t;
      const sampleY = startY + (targetY - startY) * t;

      const blocked =
        !this.isInsideFloor(sampleX, sampleY) ||
        this.petMovementService.isCollidingWithDecor(
          sampleX,
          sampleY,
          this.dog,
          this.decorSprites,
          this.scene
        ) ||
        this.petMovementService.isCollidingWithRemotePets(
          sampleX,
          sampleY,
          this.remotePets
        );

      if (blocked) {
        break;
      }

      lastSafeX = sampleX;
      lastSafeY = sampleY;
    }

    return { x: lastSafeX, y: lastSafeY };
  }

  private cancelCurrentMovement(): void {
    if (!this.scene || !this.dog) {
      return;
    }

    this.scene.tweens.killTweensOf(this.dog);
    this.isMoving = false;
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
    if (this.isHomeViewMode) return;
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
    this.placeDecorAtClientPosition(item, event.clientX, event.clientY);
  }

  public nextTutorialStep(): void {
    if (this.isTutorialLastStep) {
      this.completeTutorial();
      return;
    }

    this.tutorialStepIndex += 1;
    this.applyTutorialStepFocus();
  }

  public skipTutorial(): void {
    this.completeTutorial();
  }

  public getTutorialMessage(): string {
    const step = this.currentTutorialStep;
    if (!step) {
      return '';
    }

    return this.gameTutorialService.getStepMessage(
      step,
      this.isMobileViewport()
    );
  }

  @HostListener('window:decor-touch-drop', ['$event'])
  public onTouchDrop(event: Event): void {
    const customEvent = event as CustomEvent<{
      item?: DecorItem;
      clientX?: number;
      clientY?: number;
    }>;

    const item = customEvent.detail?.item;
    const clientX = customEvent.detail?.clientX;
    const clientY = customEvent.detail?.clientY;

    if (!item || clientX === undefined || clientY === undefined) {
      return;
    }

    this.placeDecorAtClientPosition(item, clientX, clientY);
  }

  private placeDecorAtClientPosition(
    item: DecorItem,
    clientX: number,
    clientY: number
  ): void {
    if (!this.scene) {
      return;
    }

    const container = document.getElementById('game-container');
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

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
    this.stopSnapshotRoaming();
    sessionStorage.removeItem(this.gameRouteContextStorageKey);
    this.router.navigate(['/game']);
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

    if (this.isHomeViewMode && this.roomOwnerId === userId) {
      if (existing) {
        existing.destroy();
        this.remoteRestIcons.delete(userId);
      }
      return;
    }

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
    const { isHomeViewMode, roomOwnerId, roomOwnerUsername } =
      this.resolveRouteContext();
    this.isHomeViewMode = isHomeViewMode;
    this.roomOwnerId = roomOwnerId;
    this.roomOwnerUsername = roomOwnerUsername;
    const myId = localStorage.getItem('userId');
    this.activeRoomId = this.isHomeViewMode ? null : this.roomOwnerId || myId;

    if (!this.isHomeViewMode) {
      if (!(await this.getPetDetails())) {
        return;
      }

      await this.loadSelectionContext();
    } else {
      await this.loadRoomOwnerSelectionContext();
    }

    if (myId) {
      try {
        const s = await this.userSettingsService
          .getSettings(parseInt(myId))
          .toPromise();
        if (s) {
          this.settings = s;
          this.currentZoom = Math.max(
            s.zoomLevel ?? this.defaultZoomLevel,
            this.defaultZoomLevel
          );
        }
      } catch (e) {
        console.warn('Settings load failed:', e);
      }

      try {
        const levelData =
          await this.playerLevelService.ensureInitialLevelLoaded(myId);
        this.currentPlayerLevel = levelData.level;
        this.currentPlayerExp = levelData.exp;
        this.decorService.userLevel.set(this.currentPlayerLevel);

        this.playerLevelService.startRealtimeLevelTracking(myId, {
          onLeveledUp: (newLevel, totalExp) => {
            this.currentPlayerLevel =
              this.playerLevelService.calculateLevelFromExpPublic(totalExp);
            this.currentPlayerExp = totalExp;
            this.decorService.userLevel.set(this.currentPlayerLevel);
            if (this.dog && this.scene) {
              this.playerLevelService.playLeveledUpAnimation(
                this.scene,
                this.dog,
                this.currentPlayerLevel
              );
            }
          },
          onExperienceUpdated: totalExp => {
            this.currentPlayerExp = totalExp;
            this.currentPlayerLevel =
              this.playerLevelService.calculateLevelFromExpPublic(totalExp);
            this.decorService.userLevel.set(this.currentPlayerLevel);
          }
        });
      } catch (e) {
        console.warn('Player level load failed:', e);
      }

      this.markLocalActivity();
    }

    setTimeout(() => this.initializeGame(), 100);
  }

  private resolveRouteContext(): {
    isHomeViewMode: boolean;
    roomOwnerId: string | null;
    roomOwnerUsername: string | null;
  } {
    const urlWithoutQuery = this.router.url.split('?')[0] ?? '';
    const isViewModeRoute = urlWithoutQuery.endsWith('/game/viewMode');
    const isVisitModeRoute = urlWithoutQuery.endsWith('/game/visitMode');

    // Backward compatibility for legacy deep links.
    if (!isViewModeRoute && !isVisitModeRoute) {
      const legacyIsViewMode = this.route.snapshot.url.some(
        segment => segment.path === 'view'
      );
      const legacyOwnerId = this.route.snapshot.paramMap.get('roomOwnerId');
      return {
        isHomeViewMode: legacyIsViewMode,
        roomOwnerId: legacyOwnerId,
        roomOwnerUsername: null
      };
    }

    const mode = isViewModeRoute ? 'viewMode' : 'visitMode';
    const state = history.state as
      | {
          roomOwnerId?: string | number;
          roomOwnerUsername?: string;
          mode?: string;
        }
      | undefined;

    if (
      state?.roomOwnerId != null &&
      (state.mode === mode || typeof state.mode === 'undefined')
    ) {
      return {
        isHomeViewMode: isViewModeRoute,
        roomOwnerId: String(state.roomOwnerId),
        roomOwnerUsername: state.roomOwnerUsername || null
      };
    }

    const rawStored = sessionStorage.getItem(this.gameRouteContextStorageKey);
    if (rawStored) {
      try {
        const stored = JSON.parse(rawStored) as {
          mode?: string;
          roomOwnerId?: string | number;
          roomOwnerUsername?: string;
        };

        if (stored.mode === mode && stored.roomOwnerId != null) {
          return {
            isHomeViewMode: isViewModeRoute,
            roomOwnerId: String(stored.roomOwnerId),
            roomOwnerUsername: stored.roomOwnerUsername || null
          };
        }
      } catch {
        // Ignore invalid storage payload and fall through.
      }
    }

    return {
      isHomeViewMode: isViewModeRoute,
      roomOwnerId: null,
      roomOwnerUsername: null
    };
  }

  private async loadRoomOwnerSelectionContext(): Promise<void> {
    if (!this.roomOwnerId) {
      return;
    }

    try {
      const roomOwnerPet = await this.petService.getUserPet(this.roomOwnerId);
      if (roomOwnerPet) {
        this.selectedRoomKey = this.resolveRoomKey(roomOwnerPet);
      }
    } catch (error) {
      console.warn('Failed to load room selection for host:', error);
    }
  }

  private async rebuildSceneForHomeViewTarget(
    roomOwnerId: string,
    roomOwnerUsername: string | null
  ): Promise<void> {
    this.stopSnapshotRoaming();

    if (this.activeRoomId) {
      this.roomMultiplayer.leaveRoom(this.activeRoomId);
      this.activeRoomId = null;
    }

    if (this.roomSubs.length > 0) {
      this.roomMultiplayer.cleanupRoom(this.roomSubs);
      this.roomSubs = [];
    }

    this.playerLevelService.stopRealtimeLevelTracking();

    if (this.localRestIcon) {
      this.localRestIcon.destroy();
      this.localRestIcon = null;
    }

    this.remoteRestIcons.forEach(icon => icon.destroy());
    this.remoteRestIcons.clear();
    this.remoteChatBubbles.forEach(bubbles =>
      bubbles.forEach(b => b.destroy())
    );
    this.remoteChatBubbles.clear();
    this.remotePets.clear();
    this.chatBubbles = [];

    if (this.game) {
      this.game.destroy(true);
    }

    this.scene = null;
    this.dog = null;
    this.decorSprites = null;
    this.selectedDecor = null;
    this.decorToolbox = null;
    this.kickToolbox = null;
    this.arrowGroup = null;
    this.arrowsVisible = false;
    this.isMoving = false;

    this.isGameLoading = true;
    this.isHomeViewMode = true;
    this.roomOwnerId = roomOwnerId;
    this.roomOwnerUsername = roomOwnerUsername;

    await this.loadRoomOwnerSelectionContext();

    setTimeout(() => this.initializeGame(), 100);
  }

  private async getPetDetails(): Promise<boolean> {
    let pet = this.petStreamService.currentPetStream.getValue();
    let petFetchFailed = false;

    if (!pet.petId) {
      const id = localStorage.getItem('id');
      const userId = localStorage.getItem('userId');
      const identifier =
        localStorage.getItem('id') || localStorage.getItem('userId');
      if (identifier) {
        try {
          await this.petStreamService.getUserPets(identifier);
          pet = this.petStreamService.currentPetStream.getValue();
        } catch (error) {
          petFetchFailed = true;
          console.error('Failed to fetch pet on reload:', error);
        }
      }
    }

    if (!pet.petId) {
      if (petFetchFailed) {
        this.toastMessage =
          'Unable to load your pet right now. Please check server connection and try again.';
        return false;
      }

      this.router.navigate(['/petCreation']);
      return false;
    }

    this.currentPet = pet;
    return true;
  }

  private async loadSelectionContext(): Promise<void> {
    const myId = localStorage.getItem('id') || localStorage.getItem('userId');
    if (!myId || !this.currentPet) {
      return;
    }

    this.selectedPetAssetKey = this.resolvePetAssetKey(this.currentPet);
    this.selectedRoomKey = this.resolveRoomKey(this.currentPet);

    if (this.roomOwnerId && this.roomOwnerId !== myId) {
      try {
        const roomOwnerPet = await this.petService.getUserPet(this.roomOwnerId);
        if (roomOwnerPet) {
          this.selectedRoomKey = this.resolveRoomKey(roomOwnerPet);
        }
      } catch (error) {
        console.warn('Failed to load room selection for host:', error);
      }
    }
  }

  private resolvePetAssetKey(pet: Pet): string {
    return (
      pet.petAvatar ||
      pet.selection?.petAssetKey ||
      pet.petType ||
      'GoldenRetriever_spritesheet'
    );
  }

  private resolveRoomKey(pet: Pet): RoomKey {
    const roomKey =
      pet.selection?.roomKey || this.extractRoomKeyFromMetadata(pet.metadata);

    switch (roomKey) {
      case 'room2':
      case 'room3':
        return roomKey;
      default:
        return 'room1';
    }
  }

  private extractRoomKeyFromMetadata(metadata?: string): RoomKey | null {
    if (!metadata) {
      return null;
    }

    try {
      const parsed = JSON.parse(metadata) as { SelectedRoomKey?: string };
      return parsed.SelectedRoomKey === 'room2' ||
        parsed.SelectedRoomKey === 'room3'
        ? (parsed.SelectedRoomKey as RoomKey)
        : 'room1';
    } catch {
      return null;
    }
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
    this.gameScene.preloadAssets(
      scene,
      this.selectedPetAssetKey,
      this.selectedRoomKey
    );
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
      dogX = center.x + 24;
      dogY = center.y + 20;
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
      this.selectedPetAssetKey,
      this.selectedRoomKey,
      () => {
        if (this.isHomeViewMode) {
          this.dog?.setVisible(false);
          const localShadow = (this.dog as any)?.shadow as
            | Phaser.GameObjects.Container
            | undefined;
          localShadow?.setVisible(false);
        }

        this.loadSavedDecor();

        if (this.isRealtimeVisit || !this.roomOwnerId) {
          this.initRoomMultiplayer();
        }

        if (this.roomOwnerId) {
          void this.spawnRoomOwnerSnapshotPet();
        }

        this.isGameLoading = false;
        this.startTutorialIfNeeded();
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
    this.setupPinchZoom(scene);

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

          const pointerAny = pointer as any;
          const isTouchInput =
            pointerAny.pointerType === 'touch' || !!pointerAny.wasTouch;

          if (
            isTouchInput &&
            !this.isHomeViewMode &&
            !this.hasMultipleActiveTouchPointers(scene)
          ) {
            const worldPoint = pointer.positionToCamera(
              scene.cameras.main
            ) as Phaser.Math.Vector2;
            this.movePetToPoint(worldPoint.x, worldPoint.y);
          }
        }
      }
    );
  }

  private setupArrows(scene: Phaser.Scene): void {
    if (this.isHomeViewMode) return;

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

  private startTutorialIfNeeded(): void {
    if (this.roomOwnerId) {
      return;
    }

    const currentUserId =
      localStorage.getItem('id') || localStorage.getItem('userId');
    if (!currentUserId) {
      return;
    }

    const pendingTutorialFor = localStorage.getItem(
      'firstTimeTutorialPendingFor'
    );
    const completedKey = `firstTimeTutorialCompleted:${currentUserId}`;
    const hasCompleted = localStorage.getItem(completedKey) === 'true';

    if (hasCompleted || pendingTutorialFor !== currentUserId) {
      return;
    }

    this.collapsePanelsForTutorial();
    this.tutorialStepIndex = 0;
    this.showTutorial = true;
    this.applyTutorialStepFocus();
  }

  private collapsePanelsForTutorial(): void {
    this.sidePanels?.collapseDecorIfExpanded();
    this.sidePanels?.collapseSocialIfExpanded();
  }

  private completeTutorial(): void {
    const currentUserId =
      localStorage.getItem('id') || localStorage.getItem('userId');

    if (currentUserId) {
      localStorage.setItem(
        `firstTimeTutorialCompleted:${currentUserId}`,
        'true'
      );
    }

    localStorage.removeItem('firstTimeTutorialPendingFor');

    this.sidePanels?.collapseDecorIfExpanded();
    this.sidePanels?.collapseSocialIfExpanded();

    this.showTutorial = false;
    this.tutorialSpotStyles = this.gameTutorialService.getHiddenSpotStyles();
  }

  private applyTutorialStepFocus(): void {
    const step = this.currentTutorialStep;
    if (!step) {
      return;
    }

    if (step.target === 'decor' && !this.isVisiting) {
      this.sidePanels?.expandDecorPanel();
    }

    if (step.target === 'friends') {
      this.sidePanels?.expandSocialPanel();
    }

    // Re-measure immediately and after panel animations for accurate responsive highlights.
    this.updateTutorialSpotStyles();
    window.setTimeout(() => this.updateTutorialSpotStyles(), 80);
    window.setTimeout(() => this.updateTutorialSpotStyles(), 260);
  }

  private updateTutorialSpotStyles(): void {
    const wrapper = document.querySelector(
      '.game-wrapper'
    ) as HTMLElement | null;
    const gameContainer = document.getElementById('game-container');
    const decorContainer = document.querySelector(
      '.decor-panel-container'
    ) as HTMLElement | null;
    const friendsContainer = document.querySelector(
      '.social-panel-container'
    ) as HTMLElement | null;

    this.tutorialSpotStyles = {
      pet: this.gameTutorialService.getPetSpotStyle(wrapper, gameContainer),
      decor: this.gameTutorialService.getElementSpotStyle(
        wrapper,
        decorContainer,
        4
      ),
      friends: this.gameTutorialService.getElementSpotStyle(
        wrapper,
        friendsContainer,
        4
      )
    };
  }

  private isMobileViewport(): boolean {
    return (
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768
    );
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
    if (this.isHomeViewMode) {
      return;
    }

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
            this.decorSprites,
            undefined,
            (a, b) => {
              const sa = a as Phaser.Physics.Arcade.Sprite;
              const sb = b as Phaser.Physics.Arcade.Sprite;

              // Avoid passive Arcade pushback for any pair that involves a wall.
              // Wall interactions are handled by explicit drop resolution logic instead.
              if (this.isWallLikeDecor(sa) || this.isWallLikeDecor(sb)) {
                return false;
              }

              return true;
            },
            this
          );
          if (this.dog) {
            this.scene!.physics.add.collider(
              this.dog,
              this.decorSprites,
              undefined,
              (dogBody, decorBody) => {
                const pet = dogBody as Phaser.Physics.Arcade.Sprite;
                const decor = decorBody as Phaser.Physics.Arcade.Sprite;

                // If pet is visually behind decor, let it pass without physics pushback.
                return pet.depth >= decor.depth;
              },
              this
            );
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
          this.decorManagerService.refreshSelectionFeedback(
            sprite,
            this.scene!
          );
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
      this.decorManagerService.refreshSelectionFeedback(sprite, this.scene!);
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
      const overlay = (this.selectedDecor as any).__selectionOverlay;
      if (overlay) overlay.setVisible(false);
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
    this.decorManagerService.refreshSelectionFeedback(
      this.selectedDecor,
      this.scene
    );
    this.updateToolboxPosition();
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
        let pendingAdds = instances.filter(i =>
          availableIds.has(i.decorId)
        ).length;
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

  private setupPinchZoom(scene: Phaser.Scene): void {
    scene.input.addPointer(2);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isTouchPointer(pointer)) {
        return;
      }

      const pointers = this.getActiveTouchPointers(scene);
      if (pointers.length >= 2) {
        this.beginPinchZoom(pointers);
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isTouchPointer(pointer)) {
        return;
      }

      const pointers = this.getActiveTouchPointers(scene);

      if (pointers.length < 2) {
        this.endPinchZoom();
        return;
      }

      if (!this.isPinchZooming) {
        this.beginPinchZoom(pointers);
        return;
      }

      const currentDistance = Phaser.Math.Distance.Between(
        pointers[0].x,
        pointers[0].y,
        pointers[1].x,
        pointers[1].y
      );

      if (this.pinchStartDistance <= 0) {
        return;
      }

      const scaleRatio = currentDistance / this.pinchStartDistance;
      const nextZoom = Phaser.Math.Clamp(
        this.pinchStartZoom * scaleRatio,
        this.minZoomLevel,
        this.maxZoomLevel
      );

      if (Math.abs(nextZoom - this.currentZoom) < 0.01) {
        return;
      }

      this.currentZoom = nextZoom;
      scene.cameras.main.zoom = nextZoom;
      this.markLocalActivity();
    });

    scene.input.on('pointerup', () => {
      if (!this.hasMultipleActiveTouchPointers(scene)) {
        this.endPinchZoom();
      }
    });

    scene.input.on('pointerupoutside', () => {
      if (!this.hasMultipleActiveTouchPointers(scene)) {
        this.endPinchZoom();
      }
    });
  }

  private beginPinchZoom(pointers: Phaser.Input.Pointer[]): void {
    this.isPinchZooming = true;
    this.pinchStartZoom = this.currentZoom;
    this.pinchStartDistance = Phaser.Math.Distance.Between(
      pointers[0].x,
      pointers[0].y,
      pointers[1].x,
      pointers[1].y
    );
  }

  private endPinchZoom(): void {
    if (!this.isPinchZooming) {
      return;
    }

    this.isPinchZooming = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoom = this.currentZoom;
    this.saveUserSettings();
  }

  private hasMultipleActiveTouchPointers(scene: Phaser.Scene): boolean {
    return this.getActiveTouchPointers(scene).length >= 2;
  }

  private getActiveTouchPointers(scene: Phaser.Scene): Phaser.Input.Pointer[] {
    return scene.input.manager.pointers.filter(
      pointer => pointer.isDown && this.isTouchPointer(pointer)
    );
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    const pointerAny = pointer as any;
    return pointerAny.pointerType === 'touch' || !!pointerAny.wasTouch;
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
    if (this.isHomeViewMode) return;

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
        onRemotePetLeft: (userId, username) => {
          if (userId !== this.currentlyKickingUserId) {
            this.showToast(`${username} has left your space`);
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

  private async spawnRoomOwnerSnapshotPet(): Promise<void> {
    if (!this.scene || !this.roomOwnerId) {
      return;
    }

    const ownerId = this.roomOwnerId;
    if (this.remotePets.has(ownerId)) {
      return;
    }

    const center = this.gameScene.getWorldCenter();
    let petX = center.x + 24;
    let petY = center.y + 20;

    const roomOwnerNumericId = parseInt(ownerId, 10);
    if (!Number.isNaN(roomOwnerNumericId)) {
      try {
        const settings = await this.userSettingsService
          .getSettings(roomOwnerNumericId)
          .toPromise();

        if (settings) {
          petX = settings.lastPetX ?? petX;
          petY = settings.lastPetY ?? petY;
        }
      } catch {
        // Room owner settings are optional for snapshot view.
      }
    }

    this.roomMultiplayer.spawnRemotePetSnapshot(
      this.scene,
      ownerId,
      petX,
      petY,
      {
        onRemotePetSpawned: (userId, sprite) => {
          this.remotePets.set(userId, sprite);
          this.remoteChatBubbles.set(userId, []);
        },
        onRemoteStatusChanged: (userId, isOnline) => {
          this.updateRemoteRestIcon(userId, isOnline);
        }
      }
    );

    this.startSnapshotRoaming(ownerId);
  }

  private startSnapshotRoaming(ownerId: string): void {
    if (!this.scene || !this.isHomeViewMode) {
      return;
    }

    this.stopSnapshotRoaming();
    const existingRestIcon = this.remoteRestIcons.get(ownerId);
    if (existingRestIcon) {
      existingRestIcon.destroy();
      this.remoteRestIcons.delete(ownerId);
    }

    this.scheduleNextSnapshotRoam(ownerId, Phaser.Math.Between(400, 900));
  }

  private scheduleNextSnapshotRoam(ownerId: string, delayMs: number): void {
    if (!this.scene || !this.isHomeViewMode) {
      return;
    }

    this.snapshotRoamTimer = this.scene.time.delayedCall(delayMs, () => {
      this.tryMoveSnapshotPet(ownerId);
      this.scheduleNextSnapshotRoam(ownerId, Phaser.Math.Between(1050, 1700));
    });
  }

  private stopSnapshotRoaming(): void {
    if (this.snapshotRoamTimer) {
      this.snapshotRoamTimer.remove(false);
      this.snapshotRoamTimer = null;
    }

    if (this.snapshotRoamTween) {
      this.snapshotRoamTween.stop();
      this.snapshotRoamTween = null;
    }
  }

  private tryMoveSnapshotPet(ownerId: string): void {
    if (!this.scene || !this.isHomeViewMode) {
      return;
    }

    const pet = this.remotePets.get(ownerId);
    if (!pet || !pet.active) {
      return;
    }

    if (this.snapshotRoamTween?.isPlaying()) {
      return;
    }

    const stepDistance = Phaser.Math.Between(10, 17);
    const directions = this.getShuffledRoamDirections();

    for (const direction of directions) {
      const targetX = pet.x + direction.dx * stepDistance;
      const targetY = pet.y + direction.dy * stepDistance;

      if (!this.canSnapshotPetMoveTo(ownerId, pet, targetX, targetY)) {
        continue;
      }

      const movementAnim = this.resolvePetAnimationKey(
        pet,
        direction.animSuffix
      );
      if (
        movementAnim &&
        (!pet.anims.isPlaying || pet.anims.currentAnim?.key !== movementAnim)
      ) {
        pet.play(movementAnim, true);
      }

      const existingRestIcon = this.remoteRestIcons.get(ownerId);
      if (existingRestIcon) {
        existingRestIcon.destroy();
        this.remoteRestIcons.delete(ownerId);
      }

      this.snapshotRoamTween = this.scene.tweens.add({
        targets: pet,
        x: targetX,
        y: targetY,
        duration: Phaser.Math.Between(340, 540),
        ease: 'Sine.easeInOut',
        onComplete: () => {
          const idleAnim = this.resolvePetAnimationKey(pet, 'idle');
          if (
            idleAnim &&
            (!pet.anims.isPlaying || pet.anims.currentAnim?.key !== idleAnim)
          ) {
            pet.play(idleAnim, true);
          }
          this.snapshotRoamTween = null;
        }
      });

      return;
    }

    // No valid direction found this cycle; next tick will try another direction.
  }

  private canSnapshotPetMoveTo(
    ownerId: string,
    pet: Phaser.GameObjects.Sprite,
    x: number,
    y: number
  ): boolean {
    if (!this.scene) {
      return false;
    }

    if (!this.isInsideFloor(x, y)) {
      return false;
    }

    const blocksDecor = this.petMovementService.isCollidingWithDecor(
      x,
      y,
      pet as unknown as Phaser.Physics.Arcade.Sprite,
      this.decorSprites,
      this.scene
    );
    if (blocksDecor) {
      return false;
    }

    const localPetDistance = this.dog
      ? Phaser.Math.Distance.Between(x, y, this.dog.x, this.dog.y)
      : Number.POSITIVE_INFINITY;
    if (localPetDistance < 8) {
      return false;
    }

    for (const [remoteUserId, remotePet] of this.remotePets.entries()) {
      if (remoteUserId === ownerId || !remotePet.active) {
        continue;
      }

      if (Phaser.Math.Distance.Between(x, y, remotePet.x, remotePet.y) < 8) {
        return false;
      }
    }

    return true;
  }

  private getShuffledRoamDirections(): Array<{
    dx: number;
    dy: number;
    animSuffix: string;
  }> {
    const base = [
      { dx: 0, dy: -1, animSuffix: 'walk_up' },
      { dx: 1, dy: -1, animSuffix: 'walk_up_right' },
      { dx: 1, dy: 0, animSuffix: 'walk_right' },
      { dx: 1, dy: 1, animSuffix: 'walk_down_right' },
      { dx: 0, dy: 1, animSuffix: 'walk_down' },
      { dx: -1, dy: 1, animSuffix: 'walk_down_left' },
      { dx: -1, dy: 0, animSuffix: 'walk_left' },
      { dx: -1, dy: -1, animSuffix: 'walk_up_left' }
    ];

    return Phaser.Utils.Array.Shuffle(base.slice());
  }

  private resolvePetAnimationKey(
    pet: Phaser.GameObjects.Sprite,
    suffix: string
  ): string | null {
    if (!this.scene) {
      return null;
    }

    const textureKey = pet.texture?.key;
    if (!textureKey) {
      return null;
    }

    const textureSpecificKey = `${textureKey}_${suffix}`;
    if (this.scene.anims.exists(textureSpecificKey)) {
      return textureSpecificKey;
    }

    if (this.scene.anims.exists(suffix)) {
      return suffix;
    }

    return null;
  }

  private update(scene: Phaser.Scene): void {
    if (!this.dog) return;

    this.updateRenderDepths();

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

    let stackY = -28;
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

      let remoteStackY = -28;
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
        hoverText.y = remotePet.y + 24;
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

    if (this.isHomeViewMode) {
      if (this.localRestIcon) {
        this.localRestIcon.destroy();
        this.localRestIcon = null;
      }
    } else {
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
    }

    if (!this.isInsideFloor(this.dog.x, this.dog.y)) {
      this.dog.body.setVelocity(0, 0);
      const sc = scene as any;
      this.dog.x += (sc.centerX - this.dog.x) * 0.1;
      this.dog.y += (sc.centerY + 27 - this.dog.y) * 0.1;
    }
  }

  private calculateLevelFromExp(totalExp: number): number {
    if (totalExp < 10) return 1;
    const normalized = totalExp / 5.0;
    const level = Math.floor((Math.sqrt(1 + 4 * normalized) - 1) / 2);
    return Math.max(1, level + 1);
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

  private isWallLikeDecor(sprite: Phaser.Physics.Arcade.Sprite): boolean {
    const category = (sprite.getData('decorCategory') as string) || '';
    if (category === 'wall') {
      return true;
    }

    const decorId = (sprite.getData('decorId') as string) || '';
    if (decorId.toLowerCase().startsWith('w')) {
      return true;
    }

    const item = sprite.getData('item') as { name?: string } | undefined;
    return (item?.name || '').toLowerCase().includes('wall');
  }

  private updateRenderDepths(): void {
    this.updatePetDepth(this.dog);

    this.remotePets.forEach(remotePet => {
      this.updatePetDepth(remotePet);
    });

    if (this.decorSprites) {
      this.decorSprites.getChildren().forEach(child => {
        const decor = child as Phaser.GameObjects.Sprite;
        this.updateSpriteDepth(decor);
      });
    }

    const selectedOverlay = (this.selectedDecor as any)?.__selectionOverlay as
      | Phaser.GameObjects.Image
      | undefined;
    if (selectedOverlay && this.selectedDecor) {
      selectedOverlay.setDepth(this.selectedDecor.depth + 0.05);
    }

    const selectedBorder = (this.selectedDecor as any)?.__selectionBorder as
      | Phaser.GameObjects.Graphics
      | undefined;
    if (selectedBorder && this.selectedDecor) {
      selectedBorder.setDepth(this.selectedDecor.depth + 0.05);
    }
  }

  private updatePetDepth(pet: Phaser.GameObjects.Sprite | null): void {
    if (!pet) return;

    this.updateSpriteDepth(pet);

    const shadow = (pet as any).shadow as
      | Phaser.GameObjects.Container
      | undefined;
    if (shadow && shadow.active) {
      shadow.setDepth(pet.depth - this.shadowDepthOffset);
    }
  }

  private updateSpriteDepth(sprite: Phaser.GameObjects.Sprite): void {
    const footY = sprite.y + sprite.displayHeight * this.spriteFootOffsetFactor;
    sprite.setDepth(footY * this.depthScale);
  }
}
