import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DebugService } from '../../core/debug/debug.service';

@Component({
  selector: 'app-about-dialog',
  standalone: false,
  template: `
    <div class="about-dialog-container">
      <h2 class="dialog-title">About</h2>
      <div class="dialog-content">
        <p>
          <span class="secret-tap" (click)="onSecretTap()">MyPetPal</span> is developed and maintained solely by me. Drop me a message
          if you'd like to chat about the game, have suggestions, or just want
          to say hi!
        </p>

        <div class="contact-links">
          <a
            href="https://github.com/Ash66hub"
            target="_blank"
            rel="noreferrer noopener">
            <mat-icon>code</mat-icon>
            <span>GitHub</span>
          </a>
          <a href="mailto:hi@aswanth.net">
            <mat-icon>mail</mat-icon>
            <span>Email</span>
          </a>
          <a
            href="https://www.linkedin.com/in/aswanth-hb/"
            target="_blank"
            rel="noreferrer noopener">
            <mat-icon>work</mat-icon>
            <span>LinkedIn</span>
          </a>
        </div>

        <div class="credits-section">
          <h3>Asset Credits</h3>
          <p>
            Pet sprites:
            <a
              href="https://netherzapdos.itch.io"
              target="_blank"
              rel="noreferrer noopener"
              >netherzapdos.itch.io</a
            >
          </p>
          <p>
            Building assets:
            <a
              href="https://kenney.nl"
              target="_blank"
              rel="noreferrer noopener"
              >Kenney</a
            >
            and Nano banana
          </p>

          <h3 class="privacy-title">Privacy Policy</h3>
          <p>
            Read how MyPetPal collects and uses data:
            <a routerLink="/privacy-policy" (click)="close()"
              >View Privacy Policy</a
            >
          </p>
        </div>
      </div>

      <div class="dialog-actions">
        <button class="btn-close" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styleUrls: ['./about-dialog.component.scss']
})
export class AboutDialogComponent {
  private tapCount = 0;
  private tapTimer: any = null;

  constructor(
    private dialogRef: MatDialogRef<AboutDialogComponent>,
    private debugService: DebugService
  ) {}

  onSecretTap(): void {
    this.tapCount++;

    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
    }

    // Reset counter after 3 seconds of inactivity
    this.tapTimer = setTimeout(() => {
      this.tapCount = 0;
    }, 3000);

    if (this.tapCount >= 5) {
      this.tapCount = 0;
      const isOn = this.debugService.toggle();
      this.dialogRef.close({ debugToggled: true, debugMode: isOn });
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}

