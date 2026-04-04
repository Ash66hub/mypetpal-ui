import { Injectable } from '@angular/core';
import { IndividualConfig, ToastrService } from 'ngx-toastr';
import { SnackbarToastComponent } from './snackbar-toast.component';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {
  constructor(private toastrService: ToastrService) {}

  openSnackbarWithAction(
    message: string,
    action: string = 'Close',
    duration: number = 5000
  ): void {
    const options: Partial<IndividualConfig> = {
      timeOut: duration,
      toastComponent: SnackbarToastComponent,
      closeButton: false,
      tapToDismiss: false,
      positionClass: 'toast-top-right',
      payload: { action }
    };

    this.toastrService.show(message, '', options, 'snackbar');
  }
}
