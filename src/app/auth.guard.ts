import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const requireAuth: CanActivateFn = async () => {
  const router = inject(Router);
  const { auth } = await import('./firebase');
  await auth.authStateReady();
  return auth.currentUser ? true : router.createUrlTree(['/login']);
};
