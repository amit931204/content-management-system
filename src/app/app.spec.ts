import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthPage } from './auth.page';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, AuthPage],
      providers: [provideRouter(routes)],
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
});
