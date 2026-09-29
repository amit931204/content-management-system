import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  readonly firstName = auth.currentUser?.displayName?.split(' ')[0] ?? 'there';

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
    await this.router.navigateByUrl('/login');
  }
}
