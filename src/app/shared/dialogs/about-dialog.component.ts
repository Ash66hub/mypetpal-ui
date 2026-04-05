import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-about-dialog',
  standalone: false,
  template: `
    <div class="about-dialog-container">
      <h2 class="dialog-title">About</h2>
      <div class="dialog-content">
        <p>
          MyPetPal is developed and maintained solely by me. Drop me a message
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
            Pet sprites: <a href="https://netherzapdos.itch.io" target="_blank" rel="noreferrer noopener">netherzapdos.itch.io</a>
          </p>
          <p>
            Building assets: <a href="https://kenney.nl" target="_blank" rel="noreferrer noopener">Kenney</a> and Nano banana
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
  constructor(private dialogRef: MatDialogRef<AboutDialogComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}
