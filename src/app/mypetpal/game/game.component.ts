import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgZone } from '@angular/core';
import { PetStreamService } from '../feature/pet/pet-service/pet-stream.service';
import { PetService } from '../feature/pet/pet-service/pet.service';
import { DecorService } from '../../core/decor/decor.service';
import { UserSettingsService } from '../../core/user-settings/user-settings.service';
import { ChatService } from './services/chat.service';
import { PetMovementService } from './services/pet-movement.service';
import { DecorManagerService } from './services/decor-manager.service';
import { PlayerLevelService } from './services/player-level.service';
import { RoomMultiplayerService } from './services/room-multiplayer.service';
import { GameSceneService } from './services/game-scene.service';
import { GameTutorialService } from './services/game-tutorial.service';
import { BackgroundMusicService } from '../../core/audio/background-music.service';
import { FriendService } from '../../core/social/friend.service';
import { GameComponentCore } from './game.component.base';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  standalone: false
})
export class GameComponent extends GameComponentCore {
  public activeMinigame: string | null = null;

  constructor(
    petStreamService: PetStreamService,
    petService: PetService,
    router: Router,
    route: ActivatedRoute,
    decorService: DecorService,
    userSettingsService: UserSettingsService,
    playerLevelService: PlayerLevelService,
    chatService: ChatService,
    petMovementService: PetMovementService,
    decorManagerService: DecorManagerService,
    roomMultiplayer: RoomMultiplayerService,
    gameScene: GameSceneService,
    gameTutorialService: GameTutorialService,
    backgroundMusicService: BackgroundMusicService,
    friendService: FriendService,
    ngZone: NgZone
  ) {
    super(
      petStreamService,
      petService,
      router,
      route,
      decorService,
      userSettingsService,
      playerLevelService,
      chatService,
      petMovementService,
      decorManagerService,
      roomMultiplayer,
      gameScene,
      gameTutorialService,
      backgroundMusicService,
      friendService,
      ngZone
    );
  }


  public handleLaunchMinigame(gameName: string): void {
    this.activeMinigame = gameName;
    this.backgroundMusicService.applyPreferences(false, 0); // Stop main music by force-disabling
    if (this.game) {
      this.game.scene.pause('GameScene');
    }
  }

  public handleMinigameClosed(result: { score: number; exp: number }): void {
    this.activeMinigame = null;
    this.syncBackgroundMusic(); // Restore main music based on user settings
    if (this.game) {
      this.game.scene.resume('GameScene');
    }

    if (result && result.exp > 0) {
      this.playerLevelService.awardMiniGameExperience(result.exp);
      this.toastMessage = `Mini Game Over! You\'ve earned ${result.exp} EXP!`;
      setTimeout(() => (this.toastMessage = null), 3000);
    }

  }

  public isMusicEnabled(): boolean {
    return !!this.settings?.musicEnabled && !this.settings?.isMuted;
  }

  public getMusicVolume(): number {
    return this.settings?.musicVolume ?? 0.5;
  }

  public getPetSpriteAsset(): string {
    return this.selectedPetAssetKey + '.png';
  }

}
