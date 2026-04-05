import { Injectable, NgZone } from '@angular/core';
import * as Phaser from 'phaser';
import { FriendService } from '../../../core/social/friend.service';
import { GameRealtimeService } from '../../../core/game/game-realtime.service';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/dialogs/confirm-dialog.component';
import { DecorInstance } from '../../../core/decor/decor.service';
import { PetService } from '../../feature/pet/pet-service/pet.service';

@Injectable({
  providedIn: 'root'
})
export class RoomMultiplayerService {
  private remotePetsByUser = new Map<string, Phaser.GameObjects.Sprite>();
  private remotePetAssetKeyByUser = new Map<string, string>();
  private remotePetNameByUser = new Map<string, string>();
  private textureLoadPromises = new Map<string, Promise<void>>();

  constructor(
    private friendService: FriendService,
    private gameRealtimeService: GameRealtimeService,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private petService: PetService
  ) {}

  initializeRoom(
    activeRoomId: string,
    userId: string,
    dog: Phaser.GameObjects.Sprite | null,
    scene: Phaser.Scene,
    callbacks: {
      onRemotePetSpawned: (
        userId: string,
        sprite: Phaser.GameObjects.Sprite
      ) => void;
      onRemotePetMoved: (userId: string, x: number, y: number) => void;
      onRemoteChatReceived: (
        userId: string,
        message: string,
        remotePet: Phaser.GameObjects.Sprite
      ) => void;
      onPlayerKicked: () => void;
      onRemotePetLeft: (userId: string, username: string) => void;
      onRemoteStatusChanged: (userId: string, isOnline: boolean) => void;
      onVisitorJoined: (username: string) => void;
      onDecorUpdated: (instances: DecorInstance[]) => void;
    }
  ): Subscription[] {
    const subs: Subscription[] = [];
    this.remotePetsByUser.clear();
    this.remotePetAssetKeyByUser.clear();
    this.remotePetNameByUser.clear();
    this.textureLoadPromises.clear();

    this.friendService.joinRoom(activeRoomId, userId);

    if (dog) {
      this.friendService.syncPetPosition(activeRoomId, dog.x, dog.y, userId);
    }

    const joinSub = this.friendService.userJoinedRoomEvents.subscribe(
      (joinedUserId: string) => {
        if (joinedUserId !== userId && dog) {
          this.friendService.syncPetPosition(
            activeRoomId,
            dog.x,
            dog.y,
            userId
          );
        }
      }
    );

    const moveSub = this.friendService.roomMoveEvents.subscribe(evt => {
      if (evt.userId === userId) return;

      callbacks.onRemotePetMoved(evt.userId, evt.x, evt.y);

      const existingPet = this.getOrCreateRemotePet(
        scene,
        evt.userId,
        evt.x,
        evt.y,
        callbacks
      );
      if (existingPet) {
        this.playRemoteMovementAnimation(scene, existingPet, evt.x, evt.y);
        scene.tweens.add({
          targets: existingPet,
          x: evt.x,
          y: evt.y,
          duration: 150,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.playRemoteIdleAnimation(scene, existingPet);
          }
        });
      }
    });

    const chatSub = this.friendService.roomMessageEvents.subscribe(evt => {
      if (evt.userId === userId) return;
      const remotePet = this.remotePetsByUser.get(evt.userId);
      if (!remotePet) return;
      callbacks.onRemoteChatReceived(evt.userId, evt.message, remotePet);
    });

    const kickedSub = this.friendService.kickedEvents.subscribe(
      (roomOwnerId: string) => {
        if (activeRoomId === roomOwnerId) {
          callbacks.onPlayerKicked();
        }
      }
    );

    const decorSyncSub = this.friendService.roomDecorEvents.subscribe(evt => {
      if (evt.userId === userId) return;
      callbacks.onDecorUpdated(evt.instances);
    });

    const inviteAcceptedSub = this.friendService.visitAcceptedEvents.subscribe(
      (username: string) => {
        callbacks.onVisitorJoined(username);
      }
    );

    const leftSub = this.friendService.userLeftRoomEvents.subscribe(
      (leftUserId: string) => {
        const friend = this.friendService
          .friends()
          .find(f => f.userId.toString() === leftUserId);
        const username = friend?.username || 'A Pal';
        this.remotePetsByUser.delete(leftUserId);
        this.remotePetAssetKeyByUser.delete(leftUserId);
        this.remotePetNameByUser.delete(leftUserId);
        callbacks.onRemotePetLeft(leftUserId, username);
      }
    );

    const statusSub = this.friendService.userStatusChangedEvents.subscribe(
      ({ userId: changedUserId, isOnline }) => {
        if (changedUserId === userId) {
          return;
        }
        callbacks.onRemoteStatusChanged(changedUserId, isOnline);
      }
    );

    subs.push(
      joinSub,
      moveSub,
      chatSub,
      kickedSub,
      decorSyncSub,
      inviteAcceptedSub,
      leftSub,
      statusSub
    );
    return subs;
  }

  private getOrCreateRemotePet(
    scene: Phaser.Scene,
    userId: string,
    x: number,
    y: number,
    callbacks: any
  ): Phaser.GameObjects.Sprite {
    const existing = this.remotePetsByUser.get(userId);
    if (existing && existing.active) {
      return existing;
    }

    const created = this.createRemotePet(scene, userId, x, y, callbacks)!;
    this.remotePetsByUser.set(userId, created);
    const friend = this.friendService
      .friends()
      .find(f => f.userId.toString() === userId);
    if (friend) {
      callbacks.onRemoteStatusChanged(userId, friend.isOnline);
    }
    return created;
  }

  private createRemotePet(
    scene: Phaser.Scene,
    userId: string,
    x: number,
    y: number,
    callbacks: any
  ): Phaser.GameObjects.Sprite | null {
    const matchPal = this.friendService
      .friends()
      .find(f => f.userId.toString() === userId);
    const visitorName = matchPal ? matchPal.username : 'Pal';

    const remotePetTextureKey = this.resolveRemotePetTextureKey(scene);
    const remotePet = scene.physics.add
      .sprite(x, y, remotePetTextureKey)
      .setScale(remotePetTextureKey === 'dog' ? 0.028 : 0.9);

    if (remotePetTextureKey !== 'dog') {
      remotePet.setFrame(0);
    }

    remotePet.setDepth(5);
    remotePet.setInteractive({ useHandCursor: true });

    const shadow = scene.add.container(x - 3, y + 8).setDepth(4);
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
    (remotePet as any).shadow = shadow;

    const hoverText = scene.add
      .text(x, y + 24, this.getRemoteHoverLabelText(userId, visitorName), {
        fontFamily: "'Quicksand', sans-serif",
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: { x: 8, y: 4 }
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.25)
      .setDepth(25);

    (remotePet as any).hoverText = hoverText;
    (remotePet as any).remoteUserId = userId;

    remotePet.on('pointerover', () => hoverText.setAlpha(1));
    remotePet.on('pointerout', () => hoverText.setAlpha(0));

    void this.applyRemotePetAppearance(scene, userId, remotePet);

    callbacks.onRemotePetSpawned(userId, remotePet);
    return remotePet;
  }

  private async applyRemotePetAppearance(
    scene: Phaser.Scene,
    userId: string,
    remotePet: Phaser.GameObjects.Sprite
  ): Promise<void> {
    try {
      const petAssetKey = await this.resolveUserPetAssetKey(userId);
      if (!petAssetKey) {
        return;
      }

      await this.ensurePetTextureLoaded(scene, petAssetKey);

      if (!remotePet.active || !scene.textures.exists(petAssetKey)) {
        return;
      }

      remotePet.setTexture(petAssetKey);
      remotePet.setScale(0.9);
      remotePet.clearTint();
      remotePet.setFrame(0);

      const matchPal = this.friendService
        .friends()
        .find(f => f.userId.toString() === userId);
      const visitorName = matchPal ? matchPal.username : 'Pal';
      const hoverText = (remotePet as any).hoverText as
        | Phaser.GameObjects.Text
        | undefined;
      hoverText?.setText(this.getRemoteHoverLabelText(userId, visitorName));

      this.playRemoteIdleAnimation(scene, remotePet);
    } catch (error) {
      console.warn('Failed to apply remote pet appearance:', error);
    }
  }

  private playRemoteMovementAnimation(
    scene: Phaser.Scene,
    remotePet: Phaser.GameObjects.Sprite,
    targetX: number,
    targetY: number
  ): void {
    const textureKey = remotePet.texture?.key;
    if (!textureKey) {
      return;
    }

    this.ensureAnimationsForTexture(scene, textureKey);

    const deltaX = targetX - remotePet.x;
    const deltaY = targetY - remotePet.y;
    const movementAnimKey = this.getMovementAnimationKeyForDelta(
      textureKey,
      deltaX,
      deltaY
    );

    if (!movementAnimKey) {
      return;
    }

    if (
      !remotePet.anims.isPlaying ||
      remotePet.anims.currentAnim?.key !== movementAnimKey
    ) {
      remotePet.play(movementAnimKey, true);
    }
  }

  private playRemoteIdleAnimation(
    scene: Phaser.Scene,
    remotePet: Phaser.GameObjects.Sprite
  ): void {
    const textureKey = remotePet.texture?.key;
    if (!textureKey) {
      return;
    }

    this.ensureAnimationsForTexture(scene, textureKey);
    const idleKey = this.getIdleAnimationKey(textureKey);

    if (!scene.anims.exists(idleKey)) {
      return;
    }

    if (
      !remotePet.anims.isPlaying ||
      remotePet.anims.currentAnim?.key !== idleKey
    ) {
      remotePet.play(idleKey, true);
    }
  }

  private ensureAnimationsForTexture(
    scene: Phaser.Scene,
    textureKey: string
  ): void {
    if (!scene.textures.exists(textureKey)) {
      return;
    }

    const anims = scene.anims;
    const idleKey = this.getIdleAnimationKey(textureKey);

    if (!anims.exists(idleKey)) {
      anims.create({
        key: idleKey,
        frames: anims.generateFrameNumbers(textureKey, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1
      });
    }

    const walkAnimations: Array<{
      suffix: string;
      start: number;
      end: number;
    }> = [
      { suffix: 'walk_down', start: 32, end: 35 },
      { suffix: 'walk_down_right', start: 36, end: 39 },
      { suffix: 'walk_right', start: 40, end: 43 },
      { suffix: 'walk_up_right', start: 44, end: 47 },
      { suffix: 'walk_up', start: 48, end: 51 },
      { suffix: 'walk_up_left', start: 52, end: 55 },
      { suffix: 'walk_left', start: 56, end: 59 },
      { suffix: 'walk_down_left', start: 60, end: 62 }
    ];

    walkAnimations.forEach(animation => {
      const key = this.getAnimationKey(textureKey, animation.suffix);
      if (!anims.exists(key)) {
        anims.create({
          key,
          frames: anims.generateFrameNumbers(textureKey, {
            start: animation.start,
            end: animation.end
          }),
          frameRate: 12,
          repeat: -1
        });
      }
    });
  }

  private getMovementAnimationKeyForDelta(
    textureKey: string,
    deltaX: number,
    deltaY: number
  ): string | null {
    const horizontal = Math.abs(deltaX) > 0.1;
    const vertical = Math.abs(deltaY) > 0.1;

    if (horizontal && vertical) {
      if (deltaX > 0 && deltaY < 0) {
        return this.getAnimationKey(textureKey, 'walk_up_right');
      }
      if (deltaX > 0 && deltaY > 0) {
        return this.getAnimationKey(textureKey, 'walk_down_right');
      }
      if (deltaX < 0 && deltaY < 0) {
        return this.getAnimationKey(textureKey, 'walk_up_left');
      }
      return this.getAnimationKey(textureKey, 'walk_down_left');
    }

    if (vertical) {
      return deltaY < 0
        ? this.getAnimationKey(textureKey, 'walk_up')
        : this.getAnimationKey(textureKey, 'walk_down');
    }

    if (horizontal) {
      return deltaX < 0
        ? this.getAnimationKey(textureKey, 'walk_left')
        : this.getAnimationKey(textureKey, 'walk_right');
    }

    return null;
  }

  private getIdleAnimationKey(textureKey: string): string {
    return this.getAnimationKey(textureKey, 'idle');
  }

  private getAnimationKey(textureKey: string, suffix: string): string {
    return `${textureKey}_${suffix}`;
  }

  private async resolveUserPetAssetKey(userId: string): Promise<string> {
    const cached = this.remotePetAssetKeyByUser.get(userId);
    if (cached) {
      return cached;
    }

    try {
      const pet = await this.petService.getUserPet(userId);
      const resolvedPetName = pet?.petName?.trim();
      if (resolvedPetName) {
        this.remotePetNameByUser.set(userId, resolvedPetName);
      }
      const petAssetKey =
        pet?.petAvatar ||
        pet?.selection?.petAssetKey ||
        pet?.petType ||
        'GoldenRetriever_spritesheet';

      this.remotePetAssetKeyByUser.set(userId, petAssetKey);
      return petAssetKey;
    } catch {
      const fallback = 'GoldenRetriever_spritesheet';
      this.remotePetAssetKeyByUser.set(userId, fallback);
      return fallback;
    }
  }

  private getRemoteHoverLabelText(userId: string, visitorName: string): string {
    const petName = this.remotePetNameByUser.get(userId) || 'Pet';
    return `${petName} (${visitorName})`;
  }

  private ensurePetTextureLoaded(
    scene: Phaser.Scene,
    petAssetKey: string
  ): Promise<void> {
    if (scene.textures.exists(petAssetKey)) {
      return Promise.resolve();
    }

    const inFlight = this.textureLoadPromises.get(petAssetKey);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = new Promise<void>(resolve => {
      scene.load.spritesheet(petAssetKey, `/assets/${petAssetKey}.png`, {
        frameWidth: 32,
        frameHeight: 32
      });

      scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        resolve();
      });

      scene.load.start();
    });

    this.textureLoadPromises.set(petAssetKey, loadPromise);

    return loadPromise.finally(() => {
      this.textureLoadPromises.delete(petAssetKey);
    });
  }

  private resolveRemotePetTextureKey(scene: Phaser.Scene): string {
    const preferredTextureKeys = [
      'GoldenRetriever_spritesheet',
      'Cat_spritesheet',
      'dog'
    ];

    for (const key of preferredTextureKeys) {
      if (scene.textures.exists(key)) {
        return key;
      }
    }

    return '__DEFAULT';
  }

  syncPetPosition(
    activeRoomId: string,
    x: number,
    y: number,
    userId: string
  ): void {
    this.friendService.syncPetPosition(activeRoomId, x, y, userId);
  }

  sendChatMessage(
    activeRoomId: string,
    text: string,
    userId: string,
    username: string
  ): void {
    this.friendService.sendRoomMessage(activeRoomId, text, userId, username);
  }

  syncDecorChanges(
    activeRoomId: string,
    userId: string,
    instances: DecorInstance[]
  ): void {
    this.friendService.syncRoomDecor(activeRoomId, userId, instances);
  }

  reportActivity(userId: string): Promise<void> {
    return this.gameRealtimeService.updateLastActive(userId);
  }

  kickUserFromRoom(
    activeRoomId: string,
    userId: string,
    onConfirm: () => void
  ): void {
    const matchPal = this.friendService
      .friends()
      .find(f => f.userId.toString() === userId);
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
          this.friendService.kickUser(activeRoomId, userId);
          onConfirm();
        }
      });
    });
  }

  cleanupRoom(subs: Subscription[]): void {
    subs.forEach(s => s.unsubscribe());
    this.remotePetsByUser.clear();
    this.remotePetAssetKeyByUser.clear();
    this.remotePetNameByUser.clear();
    this.textureLoadPromises.clear();
  }

  leaveRoom(activeRoomId: string): void {
    this.friendService.leaveRoom(activeRoomId);
  }

  spawnRemotePetSnapshot(
    scene: Phaser.Scene,
    userId: string,
    x: number,
    y: number,
    callbacks: {
      onRemotePetSpawned: (
        userId: string,
        sprite: Phaser.GameObjects.Sprite
      ) => void;
      onRemoteStatusChanged: (userId: string, isOnline: boolean) => void;
    }
  ): Phaser.GameObjects.Sprite | null {
    return this.getOrCreateRemotePet(scene, userId, x, y, callbacks);
  }
}
