import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { auth } from './firebase';
import { ContentService, UserProfile } from './content.service';
import { WorkspaceNav } from './workspace-nav';
import { FirebaseError } from 'firebase/app';
import { AuthFlowError } from './auth.service';

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, WorkspaceNav],
  templateUrl: './profile.page.html',
  styleUrl: './workspace-pages.css'
})
export class ProfilePage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly contentService = inject(ContentService);
  private readonly uid = auth.currentUser?.uid ?? '';

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly maxDob = new Date().toISOString().slice(0, 10);
  readonly profileForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(5), Validators.pattern(USERNAME_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(3)]],
    lastName: ['', [Validators.required, Validators.minLength(3)]],
    dob: [''],
    contactNumber: ['', Validators.pattern(/^\+?[0-9\s().-]{7,20}$/)],
    address: ['', Validators.maxLength(500)]
  });

  constructor() {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    if (!this.uid) {
      this.errorMessage.set('Your session has expired. Sign in again to view your profile.');
      this.loading.set(false);
      return;
    }

    try {
      const profile = await this.contentService.getProfile(this.uid);
      if (!profile) {
        this.errorMessage.set('We could not find your profile.');
        return;
      }
      this.profile.set(profile);
      this.profileForm.patchValue({
        username: profile.username,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        dob: profile.dob,
        contactNumber: profile.contactNumber,
        address: profile.address
      });
    } catch {
      this.errorMessage.set('We could not load your profile. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.profileForm.disable({ emitEvent: false });
    try {
      const changes = this.profileForm.getRawValue();
      await this.contentService.updateProfile(changes);
      const current = this.profile();
      if (current) {
        this.profile.set({ ...current, ...changes });
      }
      this.successMessage.set('Your profile has been updated.');
    } catch (error) {
      this.errorMessage.set(this.getSaveError(error));
    } finally {
      this.profileForm.enable({ emitEvent: false });
      this.saving.set(false);
    }
  }

  private getSaveError(error: unknown): string {
    if (error instanceof AuthFlowError && error.reason === 'username-already-in-use') {
      return 'That username is already taken. Choose another one.';
    }
    if (error instanceof FirebaseError) {
      if (error.code === 'auth/email-already-in-use') {
        return 'That email is already linked to another account.';
      }
      if (error.code === 'auth/requires-recent-login') {
        return 'For security, sign in again before changing your email address.';
      }
      if (error.code === 'auth/invalid-email') {
        return 'Enter a valid email address.';
      }
    }
    return 'We could not save your profile. Check your connection and try again.';
  }
}
