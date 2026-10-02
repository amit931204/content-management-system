import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { auth } from './firebase';
import { ContentPost, ContentService } from './content.service';
import { EmptyPostsAnimation } from './empty-posts-animation';
import { WorkspaceNav } from './workspace-nav';

type ListMode = 'recent' | 'all' | 'mine';

@Component({
  selector: 'app-post-list-page',
  imports: [DatePipe, EmptyPostsAnimation, RouterLink, WorkspaceNav],
  templateUrl: './post-list.page.html',
  styleUrl: './workspace-pages.css'
})
export class PostListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly contentService = inject(ContentService);

  readonly mode = this.route.snapshot.data['mode'] as ListMode;
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly searchText = signal('');
  readonly posts = signal<ContentPost[]>([]);
  readonly filteredPosts = computed(() => {
    const needle = this.searchText().trim().toLocaleLowerCase();
    if (!needle) {
      return this.posts();
    }
    return this.posts().filter((post) =>
      `${post.title}\n${post.details}`.toLocaleLowerCase().includes(needle)
    );
  });

  constructor() {
    void this.loadPosts();
  }

  onSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  async loadPosts(): Promise<void> {
    try {
      if (this.mode === 'recent') {
        this.posts.set(await this.contentService.getRecentPosts());
      } else if (this.mode === 'mine') {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          throw new Error('Your session has expired. Sign in again.');
        }
        this.posts.set(await this.contentService.getMyPosts(uid));
      } else {
        this.posts.set(await this.contentService.getAllPosts());
      }
    } catch {
      this.errorMessage.set('We could not load posts. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
