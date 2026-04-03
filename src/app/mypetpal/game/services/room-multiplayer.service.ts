import { Injectable, NgZone } from '@angular/core';
import * as Phaser from 'phaser';
import { FriendService } from '../../../core/social/friend.service';
import { GameRealtimeService } from '../../../core/game/game-realtime.service';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/dialogs/confirm-dialog.component';
import { DecorInstance } from '../../../core/decor/decor.service';

@Injectable({
  providedIn: 'root'
})
export class RoomMultiplayerService {
  private remotePetsByUser = new Map<string, Phaser.GameObjects.Sprite>();

  constructor(
    private friendService: FriendService,
    private gameRealtimeService: GameRealtimeService,
    private dialog: MatDialog,
    private ngZone: NgZone
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
      onRemotePetLeft: (userId: string) => void;
      onRemoteStatusChanged: (userId: string, isOnline: boolean) => void;
      onVisitorJoined: (username: string) => void;
      onDecorUpdated: (instances: DecorInstance[]) => void;
    }
  ): Subscription[] {
    const subs: Subscription[] = [];
    this.remotePetsByUser.clear();

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
        scene.tweens.add({
          targets: existingPet,
          x: evt.x,
          y: evt.y,
          duration: 150,
          ease: 'Cubic.easeOut'
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
        this.remotePetsByUser.delete(leftUserId);
        callbacks.onRemotePetLeft(leftUserId);
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

    const remotePet = scene.physics.add.sprite(x, y, 'dog').setScale(0.028);
    remotePet.setTint(0xa855f7);
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
      .text(x, y - 28, visitorName, {
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

    callbacks.onRemotePetSpawned(userId, remotePet);
    return remotePet;
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
  }

  leaveRoom(activeRoomId: string): void {
    this.friendService.leaveRoom(activeRoomId);
  }
}
