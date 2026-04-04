import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  template: `
    <div class="confirm-dialog-container">
      <h2 class="dialog-title">{{ data.title }}</h2>
      <div class="dialog-content">
        <p>{{ data.message }}</p>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" (click)="onSecondary()">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button
          class="btn-confirm"
          [class.destructive]="data.isDestructive"
          (click)="onPrimary()">
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .confirm-dialog-container {
        background: linear-gradient(180deg, #242b61 0%, #191f48 100%);
        color: #f8f3dc;
        padding: 24px;
        border-radius: 12px;
        border: 3px solid #4f57a8;
        box-shadow: 0 6px 0 rgba(9, 11, 33, 0.9);
        max-width: 400px;
        font-family: var(--retro-font-body);
      }

      .dialog-title {
        margin: 0 0 16px 0;
        font-size: 12px;
        font-weight: 700;
        color: #ffe9b4;
        font-family: var(--retro-font-display);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .dialog-content {
        margin-bottom: 24px;
        color: rgba(255, 255, 255, 0.7);
        color: #d8d2b8;
        font-size: 14px;
        line-height: 1.5;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;

        button {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid #0c102d;
          font-size: 10px;
          font-family: var(--retro-font-display);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          box-shadow: 0 3px 0 rgba(9, 11, 33, 0.9);
        }

        .btn-cancel {
          background: #1a214d;
          color: #f8f3dc;
          &:hover {
            background: #2a326d;
            color: #fff8e4;
          }
        }

        .btn-confirm {
          background: linear-gradient(180deg, #65ecda 0%, #36cdb8 100%);
          color: #0b1b31;
          &:hover {
            background: linear-gradient(180deg, #78f4e2 0%, #42d6c1 100%);
            transform: translateY(-1px);
          }

          &.destructive {
            background: #ff5667;
            color: #fff6f8;
            &:hover {
              background: #ff6f7e;
            }
          }
        }
      }
    `
  ]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onPrimary(): void {
    this.dialogRef.close(true);
  }

  onSecondary(): void {
    this.dialogRef.close(false);
  }
}
