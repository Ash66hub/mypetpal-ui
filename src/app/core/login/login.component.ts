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

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit {
  public loginForm: FormGroup;
  public signUpForm: FormGroup;
  public hidePassword = true;
  public isSignUpMode = false;

  public loginFailed = false;
  public signUpFailedDueToDuplicate = false;
  public loading = false;
  public googleLoginFailed = false;

  constructor(
    private fb: FormBuilder,
    private loginStreamService: LoginStreamService,
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

    void this.tryCompleteGoogleSignIn();
  }

  public toggleMode(): void {
    this.isSignUpMode = !this.isSignUpMode;
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
}
