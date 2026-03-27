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
        <button class="btn-cancel" (click)="onSecondary()">{{ data.cancelText || 'Cancel' }}</button>
        <button 
          class="btn-confirm" 
          [class.destructive]="data.isDestructive"
          (click)="onPrimary()">
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog-container {
      background: #0c0c16;
      color: #fff;
      padding: 24px;
      border-radius: 20px;
      border: 1px solid rgba(124, 58, 237, 0.3);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
      max-width: 400px;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .dialog-title {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 700;
      color: #a78bfa;
    }

    .dialog-content {
      margin-bottom: 24px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 15px;
      line-height: 1.5;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;

      button {
        padding: 10px 20px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-size: 14px;
      }

      .btn-cancel {
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.6);
        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
      }

      .btn-confirm {
        background: #7c3aed;
        color: white;
        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
        &:hover {
          background: #8b5cf6;
          transform: translateY(-1px);
        }

        &.destructive {
          background: #ef4444;
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
          &:hover {
            background: #f87171;
          }
        }
      }
    }
  `]
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
