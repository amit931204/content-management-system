import { Injectable } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from './firebase';

export interface SignupDetails {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
}

export class AuthFlowError extends Error {
  constructor(readonly reason: 'username-already-in-use' | 'invalid-credentials') {
    super(reason);
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  async signUp(details: SignupDetails): Promise<void> {
    const username = details.username.trim().toLowerCase();
    const usernameRef = doc(firestore, 'usernames', username);
    const existingUsername = await getDoc(usernameRef);

    if (existingUsername.exists()) {
      throw new AuthFlowError('username-already-in-use');
    }

    const credential = await createUserWithEmailAndPassword(
      auth,
      details.email.trim(),
      details.password
    );

    try {
      await updateProfile(credential.user, {
        displayName: `${details.firstName.trim()} ${details.lastName.trim()}`
      });

      const userRef = doc(firestore, 'users', credential.user.uid);
      await runTransaction(firestore, async (transaction) => {
        const usernameSnapshot = await transaction.get(usernameRef);
        if (usernameSnapshot.exists()) {
          throw new AuthFlowError('username-already-in-use');
        }

        transaction.set(usernameRef, {
          uid: credential.user.uid,
          email: details.email.trim().toLowerCase()
        });
        transaction.set(userRef, {
          firstName: details.firstName.trim(),
          lastName: details.lastName.trim(),
          email: details.email.trim().toLowerCase(),
          username,
          createdAt: serverTimestamp()
        });
      });
    } catch (error) {
      await deleteUser(credential.user);
      throw error;
    }
  }

  async signIn(username: string, password: string): Promise<void> {
    const usernameRef = doc(firestore, 'usernames', username.trim().toLowerCase());
    const usernameSnapshot = await getDoc(usernameRef);
    const email = usernameSnapshot.data()?.['email'];

    if (!usernameSnapshot.exists() || typeof email !== 'string') {
      throw new AuthFlowError('invalid-credentials');
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(
          String(error.code)
        )
      ) {
        throw new AuthFlowError('invalid-credentials');
      }
      throw error;
    }
  }
}