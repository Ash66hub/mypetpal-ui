import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { UpperCasePipe } from '@angular/common';
import { LoginStreamService } from '../../../core/login/login-service/login-stream.service';
import { LoginService } from '../../../core/login/login-service/login.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { User } from '../../../shared/user/user';
import { ConfirmDialogComponent } from '../../../shared/dialogs/confirm-dialog.component';
import { SharedModule } from '../../../shared/shared.module';
import { passwordStrengthValidator } from '../../../shared/validators/custom-validators';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [SharedModule, UpperCasePipe]
})
export class ProfileComponent implements OnInit {
  public currentUser: User | null = null;
  public passwordForm!: FormGroup;
  public isLoading = false;
  public isGoogleOnlyAccount = false;
  public hideOldPassword = true;
  public hideNewPassword = true;
  public hideConfirmPassword = true;
  private isGoogleSession = false;
  private hasLocalPassword = false;

  constructor(
    private loginStreamService: LoginStreamService,
    private loginService: LoginService,
    private snackbarService: SnackbarService,
    private fb: FormBuilder,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loginStreamService.currentUserStream.subscribe((user: User) => {
      this.currentUser = user;
      const provider = (
        user?.authProvider ||
        localStorage.getItem('authProvider') ||
        ''
      ).toLowerCase();

      this.isGoogleSession = provider === 'google';

      const storedHasLocal = localStorage.getItem('hasLocalPassword');
      const hasLocalPassword =
        user?.hasLocalPassword ??
        (storedHasLocal !== null
          ? storedHasLocal === 'true'
          : provider !== 'google');

      this.hasLocalPassword = hasLocalPassword;
      this.isGoogleOnlyAccount = this.isGoogleSession && !hasLocalPassword;
      this.updatePasswordFormValidators();
    });

    this.passwordForm = this.fb.group(
      {
        oldPassword: ['', Validators.required],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(12),
            passwordStrengthValidator()
          ]
        ],
        confirmPassword: ['', Validators.required]
      },
      { validators: this.passwordMatchValidator }
    );

    this.updatePasswordFormValidators();
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  public onChangePassword(): void {
    if (this.passwordForm.invalid || !this.currentUser?.userId) return;

    this.isLoading = true;
    const requestData = {
      userId: parseInt(this.currentUser.userId.toString(), 10),
      oldPassword: this.passwordForm.value.oldPassword,
      newPassword: this.passwordForm.value.newPassword
    };

    const requestPromise = this.isGoogleOnlyAccount
      ? this.loginService.setPassword({
          userId: parseInt(this.currentUser.userId.toString(), 10),
          newPassword: this.passwordForm.value.newPassword
        })
      : this.loginService.changePassword(requestData);

    requestPromise
      .then(() => {
        this.snackbarService.openSnackbarWithAction(
          this.isGoogleOnlyAccount
            ? 'Password set successfully!'
            : 'Password updated successfully!'
        );
        this.isGoogleOnlyAccount = false;
        this.hasLocalPassword = true;
        if (this.currentUser) {
          this.currentUser.hasLocalPassword = true;
        }
        localStorage.setItem('hasLocalPassword', 'true');
        this.updatePasswordFormValidators();
        this.passwordForm.reset();
        this.isLoading = false;
      })
      .catch((err: any) => {
        const errorMsg =
          err?.error?.message ||
          err?.error ||
          'Failed to update password. Check your old password.';
        this.snackbarService.openSnackbarWithAction(errorMsg);
        this.isLoading = false;
      });
  }

  private updatePasswordFormValidators(): void {
    if (!this.passwordForm) {
      return;
    }

    const oldPassword = this.passwordForm.get('oldPassword');
    if (!oldPassword) {
      return;
    }

    if (this.isGoogleOnlyAccount) {
      oldPassword.clearValidators();
    } else {
      oldPassword.setValidators([Validators.required]);
    }

    oldPassword.updateValueAndValidity({ emitEvent: false });
  }

  public onDeleteAccount(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Account',
        message:
          'Are you absolutely sure you want to delete your account? This action cannot be undone and you will lose your pet and all pals.',
        confirmText: 'Delete Permanently',
        isDestructive: true
      },
      width: '400px',
      panelClass: 'custom-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.currentUser?.userId) {
        this.isLoading = true;
        this.loginService
          .deleteAccount(parseInt(this.currentUser.userId.toString(), 10))
          .then(() => {
            this.snackbarService.openSnackbarWithAction('Account deleted.');
            this.loginStreamService.logout();
            this.router.navigate(['/login']);
          })
          .catch((err: any) => {
            console.error('Failed to delete account', err);
            this.snackbarService.openSnackbarWithAction(
              'Unable to delete account at this time.'
            );
            this.isLoading = false;
          });
      }
    });
  }

  public goBack(): void {
    this.router.navigate(['/game']);
  }
}
