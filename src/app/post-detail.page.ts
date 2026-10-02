import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { auth } from './firebase';
import { ContentPost, ContentService, PostComment } from './content.service';
import { WorkspaceNav } from './workspace-nav';

@Component({
  selector: 'app-post-detail-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, WorkspaceNav],
  templateUrl: './post-detail.page.html',
  styleUrl: './workspace-pages.css'
})
export class PostDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly contentService = inject(ContentService);
  private readonly postId = this.route.snapshot.paramMap.get('postId') ?? '';

  readonly currentUserId = auth.currentUser?.uid ?? '';
  readonly loading = signal(true);
  readonly post = signal<ContentPost | null>(null);
  readonly comments = signal<PostComment[]>([]);
  readonly liked = signal(false);
  readonly liking = signal(false);
  readonly commenting = signal(false);
  readonly copied = signal(false);
  readonly errorMessage = signal('');
  readonly commentForm = this.formBuilder.nonNullable.group({
    text: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  constructor() {
    void this.loadPost();
  }

  async loadPost(): Promise<void> {
    try {
      const [post, comments, liked] = await Promise.all([
        this.contentService.getPost(this.postId),
        this.contentService.getComments(this.postId),
        this.currentUserId ? this.contentService.hasLiked(this.postId, this.currentUserId) : false
      ]);
      this.post.set(post);
      this.comments.set(comments);
      this.liked.set(liked);
      if (!post) {
        this.errorMessage.set('This post could not be found.');
      }
    } catch {
      this.errorMessage.set('We could not load this post. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleLike(): Promise<void> {
    if (this.liking()) {
      return;
    }
    this.liking.set(true);
    this.errorMessage.set('');
    try {
      const liked = await this.contentService.toggleLike(this.postId);
      this.liked.set(liked);
      this.post.update((post) =>
        post ? { ...post, likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)) } : post
      );
    } catch {
      this.errorMessage.set('We could not update your like. Please try again.');
    } finally {
      this.liking.set(false);
    }
  }

  async addComment(): Promise<void> {
    this.errorMessage.set('');
    if (this.commentForm.invalid) {
      this.commentForm.markAllAsTouched();
      return;
    }

    this.commenting.set(true);
    this.commentForm.disable({ emitEvent: false });
    try {
      const text = this.commentForm.controls.text.value.trim();
      await this.contentService.addComment(this.postId, text);
      this.commentForm.reset({ text: '' }, { emitEvent: false });
      const [comments, post] = await Promise.all([
        this.contentService.getComments(this.postId),
        this.contentService.getPost(this.postId)
      ]);
      this.comments.set(comments);
      this.post.set(post);
    } catch {
      this.errorMessage.set('We could not add your comment. Please try again.');
    } finally {
      this.commentForm.enable({ emitEvent: false });
      this.commenting.set(false);
    }
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.copied.set(true);
    } catch {
      this.errorMessage.set('Your browser could not copy the link. Copy it from the address bar instead.');
    }
  }
}
