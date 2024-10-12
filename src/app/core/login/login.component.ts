import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { User } from '../../shared/user/user';
import { LoginStreamService } from './login-service/login-stream.service';
import { confirmPasswordValidator } from '../../shared/validators/custom-validators';
import { HttpErrorResponse } from '@angular/common/http';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';
import { Router } from '@angular/router';
import { PetStreamService } from '../../mypetpal/pet/pet-service/pet-stream.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  public loginForm: FormGroup;
  public signUpForm: FormGroup;
  public hidePassword = true;
  public isSignUpMode = false;

  public loginFailed = false;
  public signUpFailed = false;
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
        password: ['', [Validators.required, Validators.minLength(8)]],
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

        const currentUser =
          this.loginStreamService.currentUserStream.getValue();
        if (currentUser.userId) {
          this.petStreamService.getUserPets(currentUser.userId);
        }

        this.router.navigate(['/game']);
      } catch (error) {
        this.loginFailed = true;
      } finally {
        this.loading = false;
      }
    }
  }

  public async onSignUp(): Promise<void> {
    this.signUpFailed = false;

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

        this.snackbarService.openSnackbarWithAction(
          'Sign in successful! Use the credentials to log in'
        );
      } catch (error) {
        const httpError = error as HttpErrorResponse;

        if (httpError.status === 409) {
          this.signUpFailed = true;
        }
      } finally {
        if (!this.signUpFailed) {
          this.toggleMode();
        }
        this.loading = false;
      }
    }
  }

  public checkPasswordsMatch(): boolean {
    return (
      this.signUpForm.get('password')?.value ===
      this.signUpForm.get('confirmPassword')?.value
    );
  }
}
