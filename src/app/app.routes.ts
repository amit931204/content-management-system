import { Routes } from '@angular/router';
import { requireAuth } from './auth.guard';

const loadAuthPage = () => import('./auth.page').then((module) => module.AuthPage);
const loadHomePage = () => import('./home.page').then((module) => module.HomePage);

export const routes: Routes = [
	{ path: 'login', loadComponent: loadAuthPage, data: { mode: 'login' } },
	{ path: 'signup', loadComponent: loadAuthPage, data: { mode: 'signup' } },
	{ path: 'home', canActivate: [requireAuth], loadComponent: loadHomePage },
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: '**', redirectTo: 'login' }
];
