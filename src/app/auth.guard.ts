import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import type { UserRole } from './auth.service';

export const requireRole: CanActivateFn = async (route): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const [{ auth, firestore }, { doc, getDoc }] = await Promise.all([
    import('./firebase'),
    import('firebase/firestore')
  ]);
  await auth.authStateReady();

  if (!auth.currentUser) {
    return router.createUrlTree(['/login']);
  }

  // Check cryptographically signed token claims first (avoids unnecessary DB read & latency)
  const tokenResult = await auth.currentUser.getIdTokenResult();
  const tokenRole = tokenResult.claims['role'] as string | undefined;

  let role: UserRole = 'user';
  if (tokenRole === 'admin' || tokenRole === 'super_admin') {
    role = tokenRole;
  } else {
    const profile = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
    const storedRole = profile.data()?.['role'];
    role = storedRole === 'admin' || storedRole === 'super_admin' ? storedRole : 'user';
  }
  const allowedRoles = route.data['allowedRoles'] as UserRole[];

  if (allowedRoles.includes(role)) {
    return true;
  }

  const roleHomePath = role === 'super_admin' ? '/super-admin' : role === 'admin' ? '/admin' : '/home';
  return router.createUrlTree([roleHomePath]);
};
