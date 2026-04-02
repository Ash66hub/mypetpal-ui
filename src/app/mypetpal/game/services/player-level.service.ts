import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import * as Phaser from 'phaser';
import { Subscription } from 'rxjs';
import { GameRealtimeService } from '../../../core/game/game-realtime.service';

interface PlayerLevelRealtimeCallbacks {
  onLeveledUp: (newLevel: number, totalExp: number) => void;
  onExperienceUpdated: (totalExp: number) => void;
}

@Injectable({
  providedIn: 'root'
})
export class PlayerLevelService {
  private realtimeSubs: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private gameRealtimeService: GameRealtimeService
  ) {}

  private getExpForLevel(level: number): number {
    if (level <= 0) return 0;
    return (10 * level * (level + 1)) / 2;
  }

  getExpForNextLevel(currentLevel: number): number {
    const nextLevel = currentLevel + 1;
    const expForNext = this.getExpForLevel(nextLevel);
    const expForCurrent = this.getExpForLevel(currentLevel);
    return expForNext - expForCurrent;
  }

  getCurrentLevelExp(currentLevel: number, totalExp: number): number {
    const expForCurrent = this.getExpForLevel(currentLevel);
    return Math.max(0, totalExp - expForCurrent);
  }

  getExpProgressPercent(currentLevel: number, totalExp: number): number {
    const expForCurrent = this.getExpForLevel(currentLevel);
    const expForNext = this.getExpForLevel(currentLevel + 1);
    const expRange = expForNext - expForCurrent;

    if (expRange <= 0) return 0;

    const progressFromCurrent = totalExp - expForCurrent;
    return Math.min(100, Math.max(0, (progressFromCurrent / expRange) * 100));
  }

  async loadPlayerLevel(
    userId: string
  ): Promise<{ level: number; exp: number }> {
    const apiUrl = (
      localStorage.getItem('apiUrl') ||
      environment.apiUrl ||
      'http://localhost:5050/'
    ).replace(/\/?$/, '/');

    try {
      const response = await this.http
        .get<any>(`${apiUrl}Users/${userId}`)
        .toPromise();

      if (!response) return { level: 0, exp: 0 };

      const expRaw =
        response.totalExperience ??
        response.TotalExperience ??
        response.totalexperience;
      const parsedExp = Number(expRaw);

      if (Number.isFinite(parsedExp) && parsedExp >= 0) {
        const level = this.calculateLevelFromExp(parsedExp);
        return { level, exp: parsedExp };
      }

      return { level: 0, exp: 0 };
    } catch (error) {
      console.warn('Could not load player level from API:', error);
      return { level: 0, exp: 0 };
    }
  }

  async ensureInitialLevelLoaded(
    userId: string
  ): Promise<{ level: number; exp: number }> {
    const maxAttempts = 5;
    const delayMs = 250;
    let lastResult = { level: 0, exp: 0 };

    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.loadPlayerLevel(userId);
      lastResult = result;

      if (result.exp > 0 || result.level > 0) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return lastResult;
  }

  private calculateLevelFromExp(totalExp: number): number {
    if (totalExp < 10) return 0;
    const normalized = totalExp / 5.0;
    const level = Math.floor((Math.sqrt(1 + 4 * normalized) - 1) / 2);
    return Math.max(0, level);
  }

  calculateLevelFromExpPublic(totalExp: number): number {
    return this.calculateLevelFromExp(totalExp);
  }

  startRealtimeLevelTracking(
    userId: string,
    callbacks: PlayerLevelRealtimeCallbacks
  ): void {
    if (!userId) return;

    this.stopRealtimeLevelTracking();
    this.gameRealtimeService.initHub(userId);

    const levelUpSub = this.gameRealtimeService.leveledUpEvents.subscribe(
      evt => {
        if (evt.userId === userId) {
          callbacks.onLeveledUp(evt.newLevel, evt.totalExperience);
        }
      }
    );

    const expUpdatedSub =
      this.gameRealtimeService.experienceUpdatedEvents.subscribe(evt => {
        if (evt.userId === userId) {
          callbacks.onExperienceUpdated(evt.totalExperience);
        }
      });

    this.realtimeSubs.push(levelUpSub, expUpdatedSub);
  }

  stopRealtimeLevelTracking(): void {
    if (this.realtimeSubs.length === 0) return;
    this.realtimeSubs.forEach(s => s.unsubscribe());
    this.realtimeSubs = [];
  }

  playLeveledUpAnimation(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    newLevel: number
  ): void {
    const startX = sprite.x;
    const startY = sprite.y;

    const glow = scene.add
      .circle(startX, startY, 24, 0xfff1a8, 0.45)
      .setDepth((sprite.depth || 5) - 1);

    scene.tweens.add({
      targets: sprite,
      scale: 0.036,
      duration: 400,
      yoyo: true,
      repeat: 1,
      ease: 'Cubic.easeOut'
    });

    scene.tweens.add({
      targets: glow,
      alpha: 0,
      scale: 2,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => glow.destroy()
    });

    const levelText = scene.add
      .text(startX, startY - 30, `LEVEL ${newLevel}!`, {
        fontFamily: "'Quicksand', sans-serif",
        fontSize: '32px',
        color: '#fff6c7',
        stroke: '#7a5b00',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0.32);

    scene.tweens.add({
      targets: levelText,
      y: levelText.y - 18,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => levelText.destroy()
    });
  }
}
