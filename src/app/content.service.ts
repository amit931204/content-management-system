import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { updateEmail, updateProfile } from 'firebase/auth';
import { auth, firestore } from './firebase';
import { AuthFlowError } from './auth.service';

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dob: string;
  contactNumber: string;
  address: string;
}

export type EditableProfile = Omit<UserProfile, 'uid'>;

export interface ContentPost {
  id: string;
  title: string;
  details: string;
  userId: string;
  authorName: string;
  approvalId: string | null;
  createdAt: Date;
  likesCount: number;
  commentsCount: number;
}

export interface PostComment {
  id: string;
  userId: string;
  authorName: string;
  text: string;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const snapshot = await getDoc(doc(firestore, 'users', uid));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      uid,
      username: String(data['username'] ?? ''),
      email: String(data['email'] ?? ''),
      firstName: String(data['firstName'] ?? ''),
      lastName: String(data['lastName'] ?? ''),
      dob: String(data['dob'] ?? ''),
      contactNumber: String(data['contactNumber'] ?? ''),
      address: String(data['address'] ?? '')
    };
  }

  async updateProfile(profile: EditableProfile): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to update your profile.');
    }

    const userRef = doc(firestore, 'users', currentUser.uid);
    const currentProfile = await getDoc(userRef);
    if (!currentProfile.exists()) {
      throw new Error('Your profile could not be found.');
    }

    const currentData = currentProfile.data();
    const oldUsername = String(currentData['username'] ?? '');
    const oldEmail = String(currentData['email'] ?? currentUser.email ?? '');
    const username = profile.username.trim().toLowerCase();
    const email = profile.email.trim().toLowerCase();
    const oldUsernameRef = doc(firestore, 'usernames', oldUsername);
    const newUsernameRef = doc(firestore, 'usernames', username);
    const usernameChanged = username !== oldUsername;
    const emailChanged = email !== oldEmail.toLowerCase();

    if (usernameChanged) {
      const existingUsername = await getDoc(newUsernameRef);
      if (existingUsername.exists() && existingUsername.data()?.['uid'] !== currentUser.uid) {
        throw new AuthFlowError('username-already-in-use');
      }
    }

    if (emailChanged) {
      await updateEmail(currentUser, email);
    }

    try {
      await runTransaction(firestore, async (transaction) => {
        const [userSnapshot, oldUsernameSnapshot, newUsernameSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(oldUsernameRef),
          usernameChanged ? transaction.get(newUsernameRef) : transaction.get(oldUsernameRef)
        ]);
        if (!userSnapshot.exists()) {
          throw new Error('Your profile could not be found.');
        }
        if (userSnapshot.data()['username'] !== oldUsername) {
          throw new Error('Your username changed in another session. Reload your profile.');
        }
        if (
          usernameChanged &&
          newUsernameSnapshot.exists() &&
          newUsernameSnapshot.data()?.['uid'] !== currentUser.uid
        ) {
          throw new AuthFlowError('username-already-in-use');
        }

        const usernameData = { uid: currentUser.uid, email };
        if (usernameChanged) {
          transaction.delete(oldUsernameRef);
          transaction.set(newUsernameRef, usernameData);
        } else if (oldUsernameSnapshot.exists()) {
          transaction.update(oldUsernameRef, usernameData);
        } else {
          transaction.set(oldUsernameRef, usernameData);
        }

        transaction.update(userRef, {
          ...profile,
          username,
          email,
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      if (emailChanged) {
        try {
          await updateEmail(currentUser, oldEmail);
        } catch {
          throw new Error('Email changed, but the profile could not sync. Contact support.');
        }
      }
      throw error;
    }

    await updateProfile(currentUser, {
      displayName: `${profile.firstName.trim()} ${profile.lastName.trim()}`
    });
  }

  async createPost(title: string, details: string): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to create a post.');
    }

    const post = await addDoc(collection(firestore, 'posts'), {
      title: title.trim(),
      details: details.trim(),
      userId: currentUser.uid,
      authorName: currentUser.displayName ?? 'Content Desk user',
      approvalId: null,
      createdAt: serverTimestamp(),
      likesCount: 0,
      commentsCount: 0,
      lastCommentId: null
    });
    return post.id;
  }

  async updatePost(postId: string, title: string, details: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to edit a post.');
    }

    const postRef = doc(firestore, 'posts', postId);
    const post = await getDoc(postRef);
    if (!post.exists() || post.data()['userId'] !== currentUser.uid) {
      throw new Error('You can only edit your own posts.');
    }

    await updateDoc(postRef, {
      title: title.trim(),
      details: details.trim(),
      updatedAt: serverTimestamp()
    });
  }

  async getRecentPosts(maxCount = 10): Promise<ContentPost[]> {
    const postsQuery = query(
      collection(firestore, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snapshot = await getDocs(postsQuery);
    return snapshot.docs.map((post) => this.toPost(post.id, post.data()));
  }

  async getAllPosts(): Promise<ContentPost[]> {
    const postsQuery = query(collection(firestore, 'posts'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(postsQuery);
    return snapshot.docs.map((post) => this.toPost(post.id, post.data()));
  }

  async getMyPosts(uid: string): Promise<ContentPost[]> {
    const postsQuery = query(collection(firestore, 'posts'), where('userId', '==', uid));
    const snapshot = await getDocs(postsQuery);
    return snapshot.docs
      .map((post) => this.toPost(post.id, post.data()))
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
  }

  async getPost(postId: string): Promise<ContentPost | null> {
    const snapshot = await getDoc(doc(firestore, 'posts', postId));
    return snapshot.exists() ? this.toPost(snapshot.id, snapshot.data()) : null;
  }

  async hasLiked(postId: string, uid: string): Promise<boolean> {
    const likeSnapshot = await getDoc(doc(firestore, 'posts', postId, 'likes', uid));
    return likeSnapshot.exists();
  }

  async toggleLike(postId: string): Promise<boolean> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to like a post.');
    }

    const postRef = doc(firestore, 'posts', postId);
    const likeRef = doc(firestore, 'posts', postId, 'likes', uid);
    return runTransaction(firestore, async (transaction) => {
      const [postSnapshot, likeSnapshot] = await Promise.all([
        transaction.get(postRef),
        transaction.get(likeRef)
      ]);
      if (!postSnapshot.exists()) {
        throw new Error('This post is no longer available.');
      }

      if (likeSnapshot.exists()) {
        transaction.delete(likeRef);
        transaction.update(postRef, { likesCount: increment(-1) });
        return false;
      }

      transaction.set(likeRef, { userId: uid, createdAt: serverTimestamp() });
      transaction.update(postRef, { likesCount: increment(1) });
      return true;
    });
  }

  async getComments(postId: string): Promise<PostComment[]> {
    const commentsQuery = query(
      collection(firestore, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(commentsQuery);
    return snapshot.docs.map((comment) => {
      const data = comment.data();
      return {
        id: comment.id,
        userId: String(data['userId'] ?? ''),
        authorName: String(data['authorName'] ?? 'Content Desk user'),
        text: String(data['text'] ?? ''),
        createdAt: this.toDate(data['createdAt'])
      };
    });
  }

  async addComment(postId: string, text: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to comment.');
    }

    const postRef = doc(firestore, 'posts', postId);
    const commentRef = doc(collection(firestore, 'posts', postId, 'comments'));
    await runTransaction(firestore, async (transaction) => {
      const postSnapshot = await transaction.get(postRef);
      if (!postSnapshot.exists()) {
        throw new Error('This post is no longer available.');
      }

      transaction.set(commentRef, {
        userId: currentUser.uid,
        authorName: currentUser.displayName ?? 'Content Desk user',
        text: text.trim(),
        createdAt: serverTimestamp()
      });
      transaction.update(postRef, {
        commentsCount: increment(1),
        lastCommentId: commentRef.id
      });
    });
  }

  async getCommentsCount(postId: string): Promise<number> {
    const snapshot = await getCountFromServer(collection(firestore, 'posts', postId, 'comments'));
    return snapshot.data().count;
  }

  private toPost(id: string, data: Record<string, unknown>): ContentPost {
    return {
      id,
      title: String(data['title'] ?? ''),
      details: String(data['details'] ?? ''),
      userId: String(data['userId'] ?? ''),
      authorName: String(data['authorName'] ?? 'Content Desk user'),
      approvalId: typeof data['approvalId'] === 'string' ? data['approvalId'] : null,
      createdAt: this.toDate(data['createdAt']),
      likesCount: Number(data['likesCount'] ?? 0),
      commentsCount: Number(data['commentsCount'] ?? 0)
    };
  }

  private toDate(value: unknown): Date {
    return value instanceof Timestamp ? value.toDate() : new Date();
  }
}
