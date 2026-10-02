import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { auth } from './firebase';
import { ContentService } from './content.service';
import { WorkspaceNav } from './workspace-nav';

@Component({
  selector: 'app-post-editor-page',
  imports: [ReactiveFormsModule, RouterLink, WorkspaceNav],
  templateUrl: './post-editor.page.html',
  styleUrl: './workspace-pages.css'
})
export class PostEditorPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly contentService = inject(ContentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly postId = this.route.snapshot.paramMap.get('postId');
  readonly isEditing = this.postId !== null;
  readonly loading = signal(this.isEditing);
  readonly postReady = signal(!this.isEditing);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly postForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(140)]],
    details: ['', [Validators.required, Validators.maxLength(20000)]]
  });

  constructor() {
    if (this.postId) {
      void this.loadPostForEditing(this.postId);
    }
  }

  async loadPostForEditing(postId: string): Promise<void> {
    try {
      const post = await this.contentService.getPost(postId);
      if (!post || post.userId !== auth.currentUser?.uid) {
        this.errorMessage.set('You can only edit your own posts.');
        return;
      }
      this.postForm.patchValue({ title: post.title, details: post.details });
      this.postReady.set(true);
    } catch {
      this.errorMessage.set('We could not load this post for editing. Try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async publish(): Promise<void> {
    this.errorMessage.set('');
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.postForm.disable({ emitEvent: false });
    try {
      const { title, details } = this.postForm.getRawValue();
      if (this.postId) {
        await this.contentService.updatePost(this.postId, title, details);
        await this.router.navigate(['/posts', this.postId]);
      } else {
        const postId = await this.contentService.createPost(title, details);
        await this.router.navigate(['/posts', postId]);
      }
    } catch {
      this.errorMessage.set('We could not save your post. Check your connection and try again.');
    } finally {
      this.postForm.enable({ emitEvent: false });
      this.saving.set(false);
    }
  }
}
