import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { AuthPage } from './auth.page';
import { AuthFlowError, AuthService } from './auth.service';
import { EmptyPostsAnimation } from './empty-posts-animation';
import { routes } from './app.routes';

describe('App', () => {
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['signIn', 'signUp', 'sendPasswordReset']);
    await TestBed.configureTestingModule({
      imports: [App, AuthPage, EmptyPostsAnimation],
      providers: [provideRouter(routes), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the routed page outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should validate signup fields with the required rules', () => {
    const fixture = TestBed.createComponent(AuthPage);
    const form = fixture.componentInstance.signupForm;

    form.controls.firstName.setValue('Al');
    form.controls.lastName.setValue('Lee');
    form.controls.email.setValue('not-an-email');
    form.controls.username.setValue('bad name');
    form.controls.password.setValue('password');

    expect(form.controls.firstName.hasError('minlength')).toBeTrue();
    expect(form.controls.lastName.valid).toBeTrue();
    expect(form.controls.email.hasError('email')).toBeTrue();
    expect(form.controls.username.hasError('pattern')).toBeTrue();
    expect(form.controls.password.hasError('minlength')).toBeFalse();
    expect(form.controls.password.hasError('pattern')).toBeTrue();
  });

  it('should show a username-specific error when the username is not found', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.loginForm.setValue({ username: 'known_user', password: 'Valid!Pass123' });
    authService.signIn.and.returnValue(Promise.reject(new AuthFlowError('username-not-found')));

    await page.submitLogin();

    expect(page.errorMessage()).toBe('Username not found. Check your username or create an account.');
  });

  it('should show a password-specific error when the username exists but the password is wrong', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.loginForm.setValue({ username: 'known_user', password: 'Wrong!Pass123' });
    authService.signIn.and.returnValue(Promise.reject(new AuthFlowError('incorrect-password')));

    await page.submitLogin();

    expect(page.errorMessage()).toBe('Password is incorrect. Please try again.');
  });

  it('should route each role to its matching workspace', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.loginForm.setValue({ username: 'known_user', password: 'Valid!Pass123' });
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);

    authService.signIn.and.resolveTo('user');
    await page.submitLogin();
    authService.signIn.and.resolveTo('admin');
    await page.submitLogin();
    authService.signIn.and.resolveTo('super_admin');
    await page.submitLogin();

    expect(navigateSpy).toHaveBeenCalledWith('/home');
    expect(navigateSpy).toHaveBeenCalledWith('/admin');
    expect(navigateSpy).toHaveBeenCalledWith('/super-admin');
  });

  it('should request a password reset with a username and no password', async () => {
    const fixture = TestBed.createComponent(AuthPage);
    const page = fixture.componentInstance;
    page.loginForm.controls.username.setValue('known_user');
    authService.sendPasswordReset.and.resolveTo(undefined);

    await page.requestPasswordReset();

    expect(authService.sendPasswordReset).toHaveBeenCalledWith('known_user');
    expect(page.successMessage()).toContain('If that username is registered');
    expect(page.errorMessage()).toBe('');
  });

  it('should render the empty-feed Lottie animation as SVG', async () => {
    const fixture = TestBed.createComponent(EmptyPostsAnimation);
    fixture.detectChanges();

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
    } finally {
      fixture.destroy();
    }
  });
});
