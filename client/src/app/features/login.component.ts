import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Role } from '../core/models';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="auth-page">
      <section class="auth-story">
        <div class="brand brand-light"><span class="brand-mark">M<span>✓</span></span><span>mploy<span class="brand-accent">chek</span><small>TRUST, VERIFIED.</small></span></div>
        <div class="story-content"><div class="eyebrow light">A CLEARER WAY TO VERIFY</div><h1>Confidence starts<br>with the <em>right facts.</em></h1><p>One considered space for background checks, people, and decisions that matter.</p><div class="story-foot"><span class="foot-orbit">✦</span><span>Built for clarity.<br>Designed for trust.</span></div></div>
        <div class="story-decoration"><span></span><span></span><span></span></div>
      </section>
      <section class="auth-panel"><div class="auth-top">SECURE MEMBER ACCESS <span>↗</span></div><div class="auth-card"><div class="eyebrow">WELCOME BACK</div><h2>Your workspace<br>is ready.</h2><p class="muted">Sign in to view your verification activity.</p>
        <form (ngSubmit)="submit()">
          <label for="userId">User ID</label><input id="userId" name="userId" [(ngModel)]="userId" placeholder="e.g. USR-001" required autocomplete="username">
          <label for="password">Password</label><input id="password" name="password" [(ngModel)]="password" placeholder="Enter your password" type="password" required autocomplete="current-password">
          <label for="role">Your role</label><select id="role" name="role" [(ngModel)]="role"><option>General User</option><option>Admin</option></select>
          @if (error()) { <div class="form-error" role="alert">{{ error() }}</div> }
          <button class="primary-btn wide" type="submit" [disabled]="loading()">{{ loading() ? 'Signing in…' : 'Enter workspace' }} <span>→</span></button>
        </form><div class="demo"><div class="demo-heading">EXPLORE THE DEMO</div><button type="button" (click)="fillDemo('General User')">General User <span>USR-001 / User&#64;123</span></button><button type="button" (click)="fillDemo('Admin')">Admin <span>ADM-001 / Admin&#64;123</span></button></div>
      </div><div class="auth-bottom">© 2026 MPloyChek <span>Privacy-first verification</span></div></section>
    </main>`
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  userId = '';
  password = '';
  role: Role = 'General User';
  loading = signal(false);
  error = signal('');

  fillDemo(role: Role) { this.role = role; this.userId = role === 'Admin' ? 'ADM-001' : 'USR-001'; this.password = role === 'Admin' ? 'Admin@123' : 'User@123'; this.error.set(''); }
  async submit() {
    if (this.loading()) return;
    if (!this.userId.trim() || !this.password) { this.error.set('Enter your user ID and password.'); return; }
    this.loading.set(true); this.error.set('');
    try { await this.auth.login(this.userId.trim(), this.password, this.role); await this.router.navigateByUrl('/dashboard'); }
    catch (error: unknown) { this.error.set(error instanceof Object && 'error' in error ? (error as { error?: { message?: string } }).error?.message || 'Unable to sign in' : 'Unable to sign in'); }
    finally { this.loading.set(false); }
  }
}
