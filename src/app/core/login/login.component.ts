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

  constructor(
    private fb: FormBuilder,
    private loginStreamService: LoginStreamService,
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
  }

  public toggleMode(): void {
    this.isSignUpMode = !this.isSignUpMode;
  }

  public async onLogin(): Promise<void> {
    this.loginFailed = false;

    if (this.loginForm.valid) {
      let user = new User();

      user = {
        username: this.loginForm.value.usernameOrEmail,
        password: this.loginForm.value.password
      };
      this.loading = true;

      try {
        await this.loginStreamService.loginUser(user);
        await this.routeAfterAuthentication();
      } catch (error) {
        this.loginFailed = true;
      } finally {
        this.loading = false;
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

      try {
        await this.loginStreamService.signUpUser(user);
        await this.loginStreamService.loginUser({
          username: user.username,
          password: user.password
        });
        await this.routeAfterAuthentication();

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
        this.loading = false;
      }
    }
  }

  private async routeAfterAuthentication(): Promise<void> {
    const currentUser = this.loginStreamService.currentUserStream.getValue();

    if (!currentUser.userId) {
      return;
    }

    await this.petStreamService.getUserPets(currentUser.userId);
    const currentUserPet = this.petStreamService.currentPetStream.getValue();

    if (currentUserPet && currentUserPet.petId) {
      this.router.navigate(['/game']);
      return;
    }

    this.router.navigate(['/petCreation']);
  }

  public checkPasswordsMatch(): boolean {
    return (
      this.signUpForm.get('password')?.value ===
      this.signUpForm.get('confirmPassword')?.value
    );
  }
}
