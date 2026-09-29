import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthFlowError, AuthService } from './auth.service';

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/;
const minimumTrimmedLength = (requiredLength: number): ValidatorFn =>
  (control: AbstractControl<string>): ValidationErrors | null => {
    const actualLength = control.value.trim().length;
    return actualLength >= requiredLength ? null : { minlength: { requiredLength, actualLength } };
  };

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.css'
})
export class AuthPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isSignup = this.route.snapshot.data['mode'] === 'signup';
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');

  readonly loginForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(5), Validators.pattern(USERNAME_PATTERN)]],
    password: ['', Validators.required]
  });

  readonly signupForm = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required, minimumTrimmedLength(3)]],
    lastName: ['', [Validators.required, minimumTrimmedLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(5), Validators.pattern(USERNAME_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD_PATTERN)]]
  });

  clearFeedback(): void {
    this.errorMessage.set('');
  }

  async submitLogin(): Promise<void> {
    this.clearFeedback();
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.loginForm.disable({ emitEvent: false });
    try {
      const { username, password } = this.loginForm.getRawValue();
      await this.authService.signIn(username, password);
      await this.router.navigateByUrl('/home');
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error));
    } finally {
      this.loginForm.enable({ emitEvent: false });
      this.busy.set(false);
    }
  }

  async submitSignup(): Promise<void> {
    this.clearFeedback();
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.signupForm.disable({ emitEvent: false });
    try {
      await this.authService.signUp(this.signupForm.getRawValue());
      await this.router.navigateByUrl('/home');
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error));
    } finally {
      this.signupForm.enable({ emitEvent: false });
      this.busy.set(false);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof AuthFlowError) {
      return error.reason === 'username-already-in-use'
        ? 'That username is already taken. Try another one.'
        : 'The username or password is incorrect. Please try again.';
    }

    if (error instanceof FirebaseError) {
      if (
        error.code === 'auth/configuration-not-found' ||
        error.message.includes('CONFIGURATION_NOT_FOUND')
      ) {
        return 'Email and password sign-up is not enabled for this Firebase project. Enable it in Firebase Console under Authentication > Sign-in method, then try again.';
      }
      if (error.code === 'auth/email-already-in-use') {
        return 'An account with this email already exists. Sign in or use another email.';
      }
      if (error.code === 'auth/invalid-email') {
        return 'Enter a valid email address.';
      }
      if (error.code === 'auth/weak-password') {
        return 'Choose a stronger password that meets all the listed requirements.';
      }
      if (error.code === 'auth/network-request-failed' || error.code === 'unavailable') {
        return 'We could not reach the service. Check your connection and try again.';
      }
      if (error.code === 'permission-denied') {
        return 'We could not check your username. Please try again or contact support.';
      }
    }

    return 'Something went wrong. Please try again.';
  }
}