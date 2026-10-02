import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from './firebase';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css'
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly firstName = auth.currentUser?.displayName?.split(' ')[0] ?? 'there';
  readonly title = this.route.snapshot.data['title'] as string;

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
    await this.router.navigateByUrl('/login');
  }
}
