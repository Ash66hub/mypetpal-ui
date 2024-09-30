import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';
import { LoginComponent } from './login.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [
        BrowserAnimationsModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Login Form', () => {
    it('should have usernameOrEmail and password controls', () => {
      expect(component.loginForm.contains('usernameOrEmail')).toBeTrue();
      expect(component.loginForm.contains('password')).toBeTrue();
    });

    it('should make the usernameOrEmail control required', () => {
      const control = component.loginForm.get('usernameOrEmail');
      control?.setValue('');
      expect(control?.valid).toBeFalse();
    });

    it('should make the password control required', () => {
      const control = component.loginForm.get('password');
      control?.setValue('');
      expect(control?.valid).toBeFalse();
    });

    it('should call onLogin() when login form is submitted', () => {
      spyOn(component, 'onLogin');
      const form = fixture.debugElement.query(By.css('form'));
      form.triggerEventHandler('ngSubmit', null);
      expect(component.onLogin).toHaveBeenCalled();
    });
  });

  describe('Signup Form', () => {
    beforeEach(() => {
      component.toggleMode();
      fixture.detectChanges();
    });

    it('should have email, username, password, and confirmPassword controls', () => {
      expect(component.signUpForm.contains('email')).toBeTrue();
      expect(component.signUpForm.contains('username')).toBeTrue();
      expect(component.signUpForm.contains('password')).toBeTrue();
      expect(component.signUpForm.contains('confirmPassword')).toBeTrue();
    });

    it('should make email control required and validate email format', () => {
      const control = component.signUpForm.get('email');
      control?.setValue('');
      expect(control?.valid).toBeFalse();

      control?.setValue('invalid-email');
      expect(control?.valid).toBeFalse();

      control?.setValue('test@example.com');
      expect(control?.valid).toBeTrue();
    });

    it('should make password control required and enforce min length', () => {
      const control = component.signUpForm.get('password');
      control?.setValue('');
      expect(control?.valid).toBeFalse();

      control?.setValue('123');
      expect(control?.valid).toBeFalse();

      control?.setValue('password123');
      expect(control?.valid).toBeTrue();
    });

    it('should check if passwords match', () => {
      component.signUpForm.get('password')?.setValue('password123');
      component.signUpForm.get('confirmPassword')?.setValue('password123');
      expect(component.checkPasswordsMatch()).toBeTrue();

      component.signUpForm
        .get('confirmPassword')
        ?.setValue('differentpassword');
      expect(component.checkPasswordsMatch()).toBeFalse();
    });

    it('should call onSignUp() when sign up form is submitted', () => {
      spyOn(component, 'onSignUp');
      const form = fixture.debugElement.query(By.css('form'));
      form.triggerEventHandler('ngSubmit', null);
      expect(component.onSignUp).toHaveBeenCalled();
    });
  });

  describe('UI Behavior', () => {
    it('should switch between login and signup modes when toggling', () => {
      expect(component.isSignUpMode).toBeFalse();
      component.toggleMode();
      expect(component.isSignUpMode).toBeTrue();
      component.toggleMode();
      expect(component.isSignUpMode).toBeFalse();
    });
  });
});
