import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { UpperCasePipe } from '@angular/common';
import { LoginStreamService } from '../../../core/login/login-service/login-stream.service';
import { LoginService } from '../../../core/login/login-service/login.service';
import {
  UserSettingsService,
  UserSettings
} from '../../../core/user-settings/user-settings.service';
import { BackgroundMusicService } from '../../../core/audio/background-music.service';
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
  private readonly backgroundMusicService = inject(BackgroundMusicService);
  public currentUser: User | null = null;
  public passwordForm!: FormGroup;
  public isLoading = false;
  public isSavingMusicPreference = false;
  public isMusicPreferenceLoading = false;
  public isGoogleOnlyAccount = false;
  public hideOldPassword = true;
  public hideNewPassword = true;
  public hideConfirmPassword = true;
  public isUploadingProfilePicture = false;
  public musicEnabled = false;
  public musicVolume = 0.5;
  private readonly maxProfilePictureSizeInBytes = 5 * 1024 * 1024;
  private readonly allowedProfilePictureMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  private isGoogleSession = false;
  private hasLocalPassword = false;
  private userSettings: UserSettings | null = null;

  constructor(
    private loginStreamService: LoginStreamService,
    private loginService: LoginService,
    private userSettingsService: UserSettingsService,
    private snackbarService: SnackbarService,
    private fb: FormBuilder,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loginStreamService.currentUserStream.subscribe((user: User) => {
      this.currentUser = user;
      this.userSettings = null;
      this.musicEnabled = false;
      this.musicVolume = 0.5;
      this.isMusicPreferenceLoading = false;
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

      if (user?.userId) {
        this.loadUserSettings(user.userId);
      }
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

  private loadUserSettings(userId: string): void {
    const numericUserId = parseInt(userId, 10);
    if (Number.isNaN(numericUserId)) {
      return;
    }

    this.isMusicPreferenceLoading = true;
    this.userSettingsService.getSettings(numericUserId).subscribe({
      next: settings => {
        this.userSettings = settings;
        this.musicEnabled = settings.musicEnabled ?? false;
        this.musicVolume = settings.musicVolume ?? 0.5;
        this.isMusicPreferenceLoading = false;
      },
      error: err => {
        console.warn('Failed to load user settings', err);
        this.userSettings = null;
        this.musicEnabled = false;
        this.musicVolume = 0.5;
        this.isMusicPreferenceLoading = false;
      }
    });
  }

  public onToggleInGameMusic(enabled: boolean): void {
    if (!this.currentUser?.userId || this.isSavingMusicPreference) {
      return;
    }

    this.musicEnabled = enabled;
    this.backgroundMusicService.applyPreferences(
      this.musicEnabled,
      this.musicVolume
    );
    this.isSavingMusicPreference = true;

    this.persistMusicPreference();
  }

  public onMusicVolumeInput(volume: number): void {
    if (!this.currentUser?.userId || this.isSavingMusicPreference) {
      return;
    }

    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.backgroundMusicService.applyPreferences(
      this.musicEnabled,
      this.musicVolume
    );
  }

  public onMusicVolumeChanged(volume: number): void {
    if (!this.currentUser?.userId || this.isSavingMusicPreference) {
      return;
    }

    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.backgroundMusicService.applyPreferences(
      this.musicEnabled,
      this.musicVolume
    );
    this.isSavingMusicPreference = true;

    this.persistMusicPreference();
  }

  private persistMusicPreference(): void {
    if (!this.currentUser?.userId) {
      this.isSavingMusicPreference = false;
      return;
    }

    const settingsToSave: UserSettings = {
      userId: parseInt(this.currentUser.userId.toString(), 10),
      lastPetX: this.userSettings?.lastPetX ?? 1000,
      lastPetY: this.userSettings?.lastPetY ?? 1027,
      lastCameraX: this.userSettings?.lastCameraX ?? 1000,
      lastCameraY: this.userSettings?.lastCameraY ?? 1000,
      zoomLevel: this.userSettings?.zoomLevel ?? 5,
      isMuted: this.userSettings?.isMuted ?? false,
      musicVolume: this.musicVolume,
      soundVolume: this.userSettings?.soundVolume ?? 0.5,
      musicEnabled: this.musicEnabled,
      neighborhoodPanelCollapsed:
        this.userSettings?.neighborhoodPanelCollapsed ?? false
    };

    this.userSettingsService.saveSettings(settingsToSave).subscribe({
      next: () => {
        this.userSettings = settingsToSave;
        this.backgroundMusicService.applyPreferences(
          this.musicEnabled,
          this.musicVolume
        );
        this.isSavingMusicPreference = false;
      },
      error: err => {
        console.error('Failed to save music preference', err);
        this.musicEnabled = this.userSettings?.musicEnabled ?? false;
        this.musicVolume = this.userSettings?.musicVolume ?? 0.5;
        this.backgroundMusicService.applyPreferences(
          this.musicEnabled,
          this.musicVolume
        );
        this.isSavingMusicPreference = false;
        this.snackbarService.openSnackbarWithAction(
          'Unable to save in-game music preference.'
        );
      }
    });
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
    this.isLoading = true;
    this.router.navigate(['/game']);
  }

  public async onProfilePictureSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.currentUser?.userId) {
      this.snackbarService.openSnackbarWithAction('User session not found.');
      input.value = '';
      return;
    }

    if (!this.allowedProfilePictureMimeTypes.has(file.type)) {
      this.snackbarService.openSnackbarWithAction(
        'Invalid file type. Use JPG, PNG, or WEBP.'
      );
      input.value = '';
      return;
    }

    if (file.size > this.maxProfilePictureSizeInBytes) {
      this.snackbarService.openSnackbarWithAction('File must be 5MB or less.');
      input.value = '';
      return;
    }

    this.isUploadingProfilePicture = true;

    try {
      const userId = this.currentUser.userId;
      const updatedUser = await this.loginService.updateProfilePicture(
        userId,
        file
      );

      const mergedUser: User = {
        ...(this.currentUser || {}),
        ...(updatedUser || {}),
        profilePictureUrl: updatedUser?.profilePictureUrl
      };

      this.currentUser = mergedUser;
      this.loginStreamService.currentUserStream.next(mergedUser);
      this.snackbarService.openSnackbarWithAction('Profile picture updated.');
    } catch (error) {
      console.error('Profile picture upload failed', error);
      this.snackbarService.openSnackbarWithAction(
        'Unable to upload profile picture. Please try again.'
      );
    } finally {
      this.isUploadingProfilePicture = false;
      input.value = '';
    }
  }
}
