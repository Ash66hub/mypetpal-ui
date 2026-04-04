import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{12,}$/;

export function confirmPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    // If both password and confirmPassword exist and do not match, return an error
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  };
}

export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null | undefined;

    if (!value) {
      return null;
    }

    return PASSWORD_POLICY_REGEX.test(value)
      ? null
      : { weakPassword: true };
  };
}
