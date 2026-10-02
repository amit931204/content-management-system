import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

@Component({
  selector: 'app-workspace-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './workspace-nav.html',
  styleUrl: './workspace-nav.css'
})
export class WorkspaceNav {
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await signOut(auth);
    await this.router.navigateByUrl('/login');
  }
}
