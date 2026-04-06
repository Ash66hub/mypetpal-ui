import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { User } from '../../shared/user/user';
import { LoginStreamService } from './login-service/login-stream.service';
import {
  confirmPasswordValidator,
  passwordStrengthValidator
} from '../../shared/validators/custom-validators';
import { HttpErrorResponse } from '@angular/common/http';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { Router } from '@angular/router';
import { PetStreamService } from '../../mypetpal/feature/pet/pet-service/pet-stream.service';
import { SocialAuthService } from './login-service/social-auth.service';
import { LoginService } from './login-service/login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit {
  public loginForm!: FormGroup;
  public signUpForm!: FormGroup;
  public forgotPasswordRequestForm!: FormGroup;
  public forgotPasswordResetForm!: FormGroup;
  public hidePassword = true;
  public hideResetPassword = true;
  public isSignUpMode = false;
  public isForgotPasswordMode = false;
  public resetCodeSent = false;

  public loginFailed = false;
  public signUpFailedDueToDuplicate = false;
  public forgotPasswordRequestFailed = false;
  public forgotPasswordRequestErrorMessage = '';
  public resetPasswordFailed = false;
  public resetPasswordErrorMessage = '';
  public loading = false;
  public googleLoginFailed = false;

  constructor(
    private fb: FormBuilder,
    private loginStreamService: LoginStreamService,
    private loginService: LoginService,
    private socialAuthService: SocialAuthService,
    private petStreamService: PetStreamService,
    private snackbarService: SnackbarService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      usernameOrEmail: ['', [Validators.required, Validators.minLength(5)]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.signUpForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        username: ['', [Validators.required, Validators.minLength(5)]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(12),
            passwordStrengthValidator()
          ]
        ],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: confirmPasswordValidator() }
    );

    this.forgotPasswordRequestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.forgotPasswordResetForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(12),
            passwordStrengthValidator()
          ]
        ],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: confirmPasswordValidator() }
    );

    void this.tryCompleteGoogleSignIn();
  }

  public toggleMode(): void {
    this.isSignUpMode = !this.isSignUpMode;
    this.resetForgotPasswordState();
  }

  public openForgotPassword(): void {
    this.isSignUpMode = false;
    this.isForgotPasswordMode = true;
    this.resetCodeSent = false;
    this.forgotPasswordRequestFailed = false;
    this.forgotPasswordRequestErrorMessage = '';
    this.resetPasswordFailed = false;
    this.resetPasswordErrorMessage = '';

    const usernameOrEmail = this.loginForm.get('usernameOrEmail')?.value;
    if (typeof usernameOrEmail === 'string' && usernameOrEmail.includes('@')) {
      this.forgotPasswordRequestForm.patchValue({ email: usernameOrEmail });
    }
  }

  public closeForgotPassword(): void {
    this.resetForgotPasswordState();
    this.isSignUpMode = false;
  }

  public async onRequestResetCode(): Promise<void> {
    this.forgotPasswordRequestFailed = false;
    this.forgotPasswordRequestErrorMessage = '';

    if (this.forgotPasswordRequestForm.invalid) {
      return;
    }

    const email = this.forgotPasswordRequestForm.value.email;
    this.loading = true;

    try {
      await this.loginService.requestPasswordResetCode(email);
      this.resetCodeSent = true;
      this.forgotPasswordResetForm.patchValue({ email });
      this.snackbarService.openSnackbarWithAction(
        'If an account created with the email exists, a reset code has been sent.'
      );
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      this.forgotPasswordRequestFailed = true;
      this.forgotPasswordRequestErrorMessage =
        (typeof httpError.error === 'string' && httpError.error) ||
        'Could not send reset code. Please try again.';
      console.error('Forgot password request failed', httpError);
    } finally {
      this.loading = false;
    }
  }

  public async onResetPasswordWithCode(): Promise<void> {
    this.resetPasswordFailed = false;
    this.resetPasswordErrorMessage = '';

    if (this.forgotPasswordResetForm.invalid) {
      return;
    }

    const payload = {
      email: this.forgotPasswordResetForm.value.email,
      code: this.forgotPasswordResetForm.value.code,
      newPassword: this.forgotPasswordResetForm.value.password
    };

    this.loading = true;

    try {
      await this.loginService.resetPasswordWithCode(payload);
      this.snackbarService.openSnackbarWithAction(
        'Password reset successful. You can log in now.'
      );

      this.loginForm.patchValue({
        usernameOrEmail: payload.email,
        password: ''
      });

      this.closeForgotPassword();
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      this.resetPasswordFailed = true;
      this.resetPasswordErrorMessage =
        (httpError.error as string) ||
        'Failed to reset password. Please check the code and try again.';
    } finally {
      this.loading = false;
    }
  }

  public async onLogin(): Promise<void> {
    this.loginFailed = false;

    if (this.loginForm.valid) {
      let user = new User();
      const usernameOrEmail = this.loginForm.value.usernameOrEmail;
      const isEmail =
        typeof usernameOrEmail === 'string' && usernameOrEmail.includes('@');

      user = {
        username: isEmail ? undefined : usernameOrEmail,
        email: isEmail ? usernameOrEmail : undefined,
        password: this.loginForm.value.password
      };
      this.loading = true;
      let navigationStarted = false;

      try {
        await this.loginStreamService.loginUser(user);
        this.snackbarService.openSnackbarWithAction('Log in successful!');
        navigationStarted = await this.routeAfterAuthentication();
      } catch (error) {
        this.loginFailed = true;
      } finally {
        if (!navigationStarted) {
          this.loading = false;
        }
      }
    }
  }

  public async onSignUp(): Promise<void> {
    this.signUpFailedDueToDuplicate = false;

    if (this.signUpForm.valid && this.checkPasswordsMatch()) {
      let user = new User();
      user = {
        username: this.signUpForm.value.username,
        email: this.signUpForm.value.email,
        password: this.signUpForm.value.password
      };

      this.loading = true;
      let navigationStarted = false;

      try {
        await this.loginStreamService.signUpUser(user);
        await this.loginStreamService.loginUser({
          username: user.username,
          password: user.password
        });
        navigationStarted = await this.routeAfterAuthentication();

        this.snackbarService.openSnackbarWithAction('Sign up successful!');
      } catch (error) {
        const httpError = error as HttpErrorResponse;

        if (httpError.status === 409) {
          this.signUpFailedDueToDuplicate = true;
        } else {
          this.snackbarService.openSnackbarWithAction(
            'Sign up failed. Try again?'
          );
        }
      } finally {
        if (!navigationStarted) {
          this.loading = false;
        }
      }
    }
  }

  public async onGoogleLogin(): Promise<void> {
    this.googleLoginFailed = false;
    this.loading = true;

    try {
      await this.socialAuthService.signInWithGoogle(
        `${window.location.origin}/login`
      );
    } catch (error) {
      this.googleLoginFailed = true;
      this.loading = false;
      this.snackbarService.openSnackbarWithAction(
        'Google sign-in failed. Please try again.'
      );
    }
  }

  private async tryCompleteGoogleSignIn(): Promise<void> {
    const hasLocalToken = localStorage.getItem('token');
    if (hasLocalToken) {
      return;
    }

    const hasOAuthCallback = this.isOAuthCallbackUrl();
    if (!hasOAuthCallback) {
      return;
    }

    this.loading = true;
    let navigationStarted = false;

    try {
      const accessToken =
        await this.socialAuthService.getGoogleAccessTokenFromSession();
      if (!accessToken) {
        this.loading = false;
        return;
      }

      await this.loginStreamService.loginWithGoogle(accessToken);
      this.snackbarService.openSnackbarWithAction('Log in successful!');
      this.cleanUpOAuthCallbackUrl();
      navigationStarted = await this.routeAfterAuthentication();
    } catch {
      this.googleLoginFailed = true;
      this.loading = false;
      this.snackbarService.openSnackbarWithAction(
        'Google sign-in could not be completed.'
      );
    } finally {
      if (!navigationStarted) {
        this.loading = false;
      }
    }
  }

  private isOAuthCallbackUrl(): boolean {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    return (
      query.has('code') ||
      query.has('error') ||
      hash.has('access_token') ||
      hash.has('error')
    );
  }

  private cleanUpOAuthCallbackUrl(): void {
    if (window.location.pathname !== '/login') {
      return;
    }

    window.history.replaceState({}, document.title, '/login');
  }

  private async routeAfterAuthentication(): Promise<boolean> {
    const currentUser = this.loginStreamService.currentUserStream.getValue();

    if (!currentUser.userId) {
      return false;
    }

    await this.petStreamService.getUserPets(currentUser.userId);
    const currentUserPet = this.petStreamService.currentPetStream.getValue();

    if (currentUserPet && currentUserPet.petId) {
      return this.router.navigate(['/game']);
    }

    return this.router.navigate(['/petCreation']);
  }

  public checkPasswordsMatch(): boolean {
    return (
      this.signUpForm.get('password')?.value ===
      this.signUpForm.get('confirmPassword')?.value
    );
  }

  private resetForgotPasswordState(): void {
    this.isForgotPasswordMode = false;
    this.resetCodeSent = false;
    this.forgotPasswordRequestFailed = false;
    this.forgotPasswordRequestErrorMessage = '';
    this.resetPasswordFailed = false;
    this.resetPasswordErrorMessage = '';
    this.forgotPasswordRequestForm?.reset();
    this.forgotPasswordResetForm?.reset();
  }
}
