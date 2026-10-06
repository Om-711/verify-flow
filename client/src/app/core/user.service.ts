import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CheckRecord, Role, User } from './models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  profile(delayMs = 0) { return this.http.get<{ user: User }>('/api/me', { params: new HttpParams().set('delayMs', delayMs) }); }
  records(delayMs = 0) { return this.http.get<{ records: CheckRecord[] }>('/api/records', { params: new HttpParams().set('delayMs', delayMs) }); }
  users() { return this.http.get<{ users: User[] }>('/api/users'); }
  create(input: { name: string; email: string; role: Role; password: string }) { return this.http.post<{ user: User }>('/api/users', input); }
  update(id: string, input: { role?: Role; active?: boolean }) { return this.http.patch<{ user: User }>(`/api/users/${encodeURIComponent(id)}`, input); }
}
