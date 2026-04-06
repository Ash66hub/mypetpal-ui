import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BackgroundMusicService {
  private readonly trackUrl =
    'https://awntqvnovwpwyxiqexfr.supabase.co/storage/v1/object/public/mypetpal-music/lofi-track-1.ogg';
  private audio: HTMLAudioElement | null = null;
  private enabled = false;
  private volume = 0.5;

  public applyPreferences(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    this.ensureAudio();

    if (!this.audio) {
      return;
    }

    this.audio.volume = this.volume;

    if (!this.enabled) {
      this.audio.pause();
      this.audio.currentTime = 0;
      return;
    }

    void this.play();
  }

  public unlockPlayback(): void {
    if (!this.enabled) {
      return;
    }

    void this.play();
  }

  public pause(): void {
    if (!this.audio) {
      return;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private ensureAudio(): void {
    if (this.audio) {
      return;
    }

    this.audio = new Audio(this.trackUrl);
    this.audio.loop = true;
    this.audio.preload = 'auto';
  }

  private async play(): Promise<void> {
    if (!this.audio || !this.enabled) {
      return;
    }

    this.audio.volume = this.volume;

    try {
      await this.audio.play();
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : '';
      if (errorName !== 'NotAllowedError' && errorName !== 'AbortError') {
        console.warn('Background music could not start:', error);
      }
    }
  }
}
