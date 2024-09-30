// src/app/core/login/login.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  signUpForm: FormGroup;
  hide = true;
  isSignUpMode = false;

  constructor(private fb: FormBuilder) {
    this.loginForm = this.fb.group({
      usernameOrEmail: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.signUpForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  toggleMode(): void {
    this.isSignUpMode = !this.isSignUpMode;
  }

  onLogin(): void {
    if (this.loginForm.valid) {
      console.log('Login successful', this.loginForm.value);
    }
  }

  onSignUp(): void {
    if (this.signUpForm.valid && this.checkPasswordsMatch()) {
      console.log('Sign Up successful', this.signUpForm.value);
    }
  }

  checkPasswordsMatch(): boolean {
    return (
      this.signUpForm.get('password')?.value ===
      this.signUpForm.get('confirmPassword')?.value
    );
  }
}
