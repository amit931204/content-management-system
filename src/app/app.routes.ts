import { Routes } from '@angular/router';
import { requireRole } from './auth.guard';

const loadAuthPage = () => import('./auth.page').then((module) => module.AuthPage);
const loadHomePage = () => import('./home.page').then((module) => module.HomePage);
const loadPostListPage = () => import('./post-list.page').then((module) => module.PostListPage);
const loadPostEditorPage = () => import('./post-editor.page').then((module) => module.PostEditorPage);
const loadPostDetailPage = () => import('./post-detail.page').then((module) => module.PostDetailPage);
const loadProfilePage = () => import('./profile.page').then((module) => module.ProfilePage);

export const routes: Routes = [
	{ path: 'login', loadComponent: loadAuthPage, data: { mode: 'login' } },
	{ path: 'signup', loadComponent: loadAuthPage, data: { mode: 'signup' } },
	{ path: 'home', canActivate: [requireRole], data: { allowedRoles: ['user'], mode: 'recent' }, loadComponent: loadPostListPage },
	{ path: 'posts/new', canActivate: [requireRole], data: { allowedRoles: ['user'] }, loadComponent: loadPostEditorPage },
	{ path: 'posts/:postId/edit', canActivate: [requireRole], data: { allowedRoles: ['user'] }, loadComponent: loadPostEditorPage },
	{ path: 'posts/:postId', canActivate: [requireRole], data: { allowedRoles: ['user'] }, loadComponent: loadPostDetailPage },
	{ path: 'posts', canActivate: [requireRole], data: { allowedRoles: ['user'], mode: 'all' }, loadComponent: loadPostListPage },
	{ path: 'my-posts', canActivate: [requireRole], data: { allowedRoles: ['user'], mode: 'mine' }, loadComponent: loadPostListPage },
	{ path: 'profile', canActivate: [requireRole], data: { allowedRoles: ['user'] }, loadComponent: loadProfilePage },
	{ path: 'admin', canActivate: [requireRole], data: { allowedRoles: ['admin', 'super_admin'], title: 'Admin workspace' }, loadComponent: loadHomePage },
	{ path: 'super-admin', canActivate: [requireRole], data: { allowedRoles: ['super_admin'], title: 'Super admin workspace' }, loadComponent: loadHomePage },
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' }
];
