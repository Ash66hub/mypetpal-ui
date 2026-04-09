import { Component, OnInit, OnDestroy, AfterViewInit, NgZone, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import Phaser from 'phaser';
import { AvoidTheJunkScene } from './avoid-the-junk-scene';
import { MiniGameScoreService } from '../../../../core/services/mini-game-score.service';


@Component({
  selector: 'app-avoid-the-junk',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avoid-the-junk.component.html',
  styleUrls: ['./avoid-the-junk.component.scss']
})
export class AvoidTheJunkComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() petSprite: string = 'GoldenRetriever_spritesheet.png';
  @Input() musicEnabled: boolean = true;
  @Input() musicVolume: number = 0.5;
  @Output() gameClosed = new EventEmitter<{ score: number, exp: number }>();

  private phaserGame: Phaser.Game | null = null;
  public isMuted = false;

  constructor(
    private ngZone: NgZone,
    private miniGameScoreService: MiniGameScoreService
  ) {}

  ngOnInit(): void {
    this.isMuted = !this.musicEnabled;
  }

  ngAfterViewInit(): void {
    const userIdStr = localStorage.getItem('userId');
    const userId = userIdStr ? parseInt(userIdStr, 10) : 0;

    if (userId) {
      this.miniGameScoreService.getScores(userId).subscribe({
        next: (scoreObj) => {
          this.initPhaser(scoreObj?.saveTheJunkHighScore || 0, userId);
        },
        error: () => {
          this.initPhaser(0, userId);
        }
      });
    } else {
      this.initPhaser(0, 0);
    }
  }

  private initPhaser(loadedHighScore: number, userId: number): void {
    this.ngZone.runOutsideAngular(() => {
      const isMobile = window.innerWidth <= 820;
      const gameWidth = isMobile ? 450 : 800;
      const gameHeight = isMobile ? 750 : 600;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'avoid-the-junk-container',
        width: gameWidth,
        height: gameHeight,
        physics: {
          default: 'arcade',
          arcade: {
            debug: false
          }
        },
        backgroundColor: '#1a1a2e',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH
        }
      };

      this.phaserGame = new Phaser.Game(config);
      
      this.phaserGame.events.once('ready', () => {
        // Add scene manually (not via config) to prevent auto-start
        this.phaserGame?.scene.add('AvoidTheJunkScene', AvoidTheJunkScene, false);

        const scene = this.phaserGame?.scene.getScene('AvoidTheJunkScene') as AvoidTheJunkScene;
        if (scene) {
          scene.events.on('game-exit', (data: any) => {
            this.ngZone.run(() => {
              this.gameClosed.emit(data);
            });
          });

          scene.events.on('save-high-score', (data: { score: number }) => {
            if (userId) {
              this.miniGameScoreService.updateSaveTheJunkScore(userId, data.score).subscribe();
            }
          });
        }
        
        // Start with correct audio preferences — this is the ONLY start
        this.phaserGame?.scene.start('AvoidTheJunkScene', { 
          petSprite: this.petSprite,
          musicVolume: this.musicVolume,
          isMuted: this.isMuted,
          highScore: loadedHighScore
        });
      });
    });
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('AvoidTheJunkScene') as any;
      if (scene && typeof scene.toggleMute === 'function') {
        scene.toggleMute(this.isMuted);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.phaserGame) {
      this.phaserGame.destroy(true);
      this.phaserGame = null;
    }
  }
}
