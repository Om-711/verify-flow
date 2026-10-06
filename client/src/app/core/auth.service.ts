import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Role, User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly user = signal<User | null>(null);

  clearSession(): void {
    sessionStorage.removeItem('mploychek_token');
    this.user.set(null);
  }

  async restore(): Promise<void> {
    if (!sessionStorage.getItem('mploychek_token')) return;
    try {
      const result = await firstValueFrom(this.http.get<{ user: User }>('/api/me'));
      this.user.set(result.user);
    } catch { this.clearSession(); }
  }

  async login(userId: string, password: string, role: Role): Promise<void> {
    const result = await firstValueFrom(this.http.post<{ token: string; user: User }>('/api/login', { userId, password, role }));
    sessionStorage.setItem('mploychek_token', result.token);
    this.user.set(result.user);
  }

  async logout(): Promise<void> {
    const request = firstValueFrom(this.http.post('/api/logout', {}));
    this.clearSession();
    try { await request; } catch { /* Local session is already cleared. */ }
  }
}
