import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { LoginComponent } from './features/login.component';
import { DashboardComponent } from './features/dashboard.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [() => inject(AuthService).user() ? inject(Router).parseUrl('/dashboard') : true] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [() => inject(AuthService).user() ? true : inject(Router).parseUrl('/login')] },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' }
];
