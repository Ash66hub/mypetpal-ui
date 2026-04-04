import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Toast } from 'ngx-toastr';

@Component({
  selector: 'app-snackbar-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './snackbar-toast.component.html',
  styleUrls: ['./snackbar-toast.component.scss']
})
export class SnackbarToastComponent extends Toast {
  public get actionLabel(): string {
    const payload = this.options().payload as
      | { action?: string }
      | undefined;
    return payload?.action || 'Close';
  }

  public onActionClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove();
  }
}
