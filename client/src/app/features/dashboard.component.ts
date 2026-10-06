import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { UserService } from '../core/user.service';
import { CheckRecord, Role, User } from '../core/models';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="workspace">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">M<span>✓</span></span><span>mploy<span class="brand-accent">chek</span><small>TRUST, VERIFIED.</small></span></div>
        <div class="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation"><button aria-label="Overview" [class.active]="tab() === 'overview'" (click)="tab.set('overview')"><span class="nav-icon">▦</span> Overview <span class="nav-arrow">↗</span></button><button aria-label="My checks" [class.active]="tab() === 'records'" (click)="tab.set('records')"><span class="nav-icon">▤</span> My checks <span class="nav-count">{{ records().length }}</span></button>@if (isAdmin()) { <button aria-label="People" [class.active]="tab() === 'users'" (click)="showUsers()"><span class="nav-icon">♙</span> People <span class="nav-arrow">↗</span></button> }</nav>
        <div class="side-bottom"><div class="side-note"><span class="note-symbol">✳</span><b>Clarity in every check.</b><p>Thoughtful verification for confident decisions.</p></div><button class="side-signout" aria-label="Sign out" (click)="signOut()">↪ <span>Sign out</span></button></div>
      </aside>
      <div class="main-area">
        <header class="topbar"><span>WORKSPACE <span class="crumb">/</span> {{ tab() === 'users' ? 'PEOPLE' : tab() === 'records' ? 'MY CHECKS' : 'OVERVIEW' }}</span><div class="top-right"><span class="live-dot"></span> SYSTEMS OPERATIONAL <span class="top-divider"></span><div class="avatar small">{{ initials() }}</div></div></header>
        <main class="content">
          @if (tab() === 'overview') {
            <div class="page-head"><div><div class="eyebrow">YOUR VERIFICATION SPACE</div><h1>Good {{ greeting() }},<br><em>{{ firstName() }}.</em></h1><p>A clear view of the checks that matter to you.</p></div><div class="date-mark"><span>✦</span> {{ todayLabel() }}</div></div>
            <section class="welcome-band"><div><span class="band-tag">YOUR WORKSPACE AT A GLANCE</span><h2>Every detail, in its place.</h2><p>Track your verifications and stay informed as each check moves forward.</p></div><div class="band-art"><span class="orbit one"></span><span class="orbit two"></span><span class="orbit three"></span><span class="art-center">✓</span></div></section>
            <div class="section-kicker">OVERVIEW <span>01 / 03</span></div>
            <div class="stats-grid"><article class="stat-card"><div class="stat-top">TOTAL CHECKS <span>↗</span></div><strong>{{ records().length }}</strong><p>Across your workspace</p></article><article class="stat-card"><div class="stat-top">VERIFIED <span class="stat-icon teal">✓</span></div><strong>{{ count('Verified') }}</strong><p>Ready to review</p></article><article class="stat-card"><div class="stat-top">IN PROGRESS <span class="stat-icon amber">◷</span></div><strong>{{ count('In review') }}</strong><p>Moving right along</p></article></div>
            <div class="lower-grid"><section class="card profile-card"><div class="card-title-row"><span class="eyebrow">YOUR PROFILE</span><span class="subtle-icon">↗</span></div>@if (profileLoading()) { <div class="skeleton">Loading your details…</div> } @else if (profile()) { <div class="profile-row"><div class="avatar">{{ initials() }}</div><div><h3>{{ profile()!.name }}</h3><p>{{ profile()!.role }}</p></div></div><div class="detail-row"><span>USER ID</span><b>{{ profile()!.id }}</b></div><div class="detail-row"><span>EMAIL</span><b>{{ profile()!.email }}</b></div><div class="detail-row"><span>MEMBER SINCE</span><b>{{ profile()!.joined }}</b></div> } @else { <p class="inline-error">{{ profileError() }}</p> }</section><section class="card activity-card"><div class="card-title-row"><span class="eyebrow">RECENT ACTIVITY</span><button class="text-button" (click)="tab.set('records')">View all ↗</button></div>@if (recordsLoading()) { <div class="skeleton">Loading checks…</div> } @else { @for (record of records().slice(0, 3); track record.id) { <div class="activity-item"><span class="activity-glyph">{{ typeGlyph(record.type) }}</span><div><b>{{ record.subject }}</b><small>{{ record.id }} · {{ record.updated }}</small></div><span class="status-dot" [class.done]="record.status === 'Verified'"></span></div> } @empty { <div class="empty">No checks yet.</div> } }</section></div>
          }
          @if (tab() === 'records') {
            <div class="page-head compact"><div><div class="eyebrow">VERIFICATION ACTIVITY</div><h1>My <em>checks.</em></h1><p>{{ isAdmin() ? 'An overview of all verification records.' : 'Your checks, clearly tracked from start to finish.' }}</p></div><span class="head-number">{{ records().length.toString().padStart(2, '0') }}</span></div>
            <section class="card delay-panel"><div><div class="eyebrow">ASYNC EXPERIENCE LAB</div><h3>See loading in action</h3><p>Set an API delay and refresh. Profile and checks load independently, so the page remains responsive.</p></div><div class="delay-control"><label for="delay">API delay <b>{{ delayMs }} ms</b></label><input id="delay" type="range" min="0" max="5000" step="500" [(ngModel)]="delayMs"><button class="outline-btn" (click)="loadDashboard()">Refresh data ↻</button></div></section>
            <div class="section-kicker">CHECK RECORDS <span>{{ recordsLoading() ? 'LOADING…' : records().length + ' RECORDS' }}</span></div>
            <section class="card table-card">@if (recordsLoading()) { <div class="table-loading" role="status"><span class="spinner"></span> Fetching verification records…</div> } @else if (recordsError()) { <p class="inline-error" role="alert">{{ recordsError() }}</p> } @else { <div class="table-scroll" tabindex="0" role="region" aria-label="Verification records"><table><thead><tr><th>REFERENCE</th><th>CHECK</th><th>TYPE</th>@if (isAdmin()) { <th>OWNER</th> }<th>UPDATED</th><th>STATUS</th></tr></thead><tbody>@for (record of records(); track record.id) { <tr><td class="mono">{{ record.id }}</td><td><b>{{ record.subject }}</b><small>{{ record.reference }}</small></td><td>{{ record.type }}</td>@if (isAdmin()) { <td>{{ record.ownerId }}</td> }<td>{{ record.updated }}</td><td><span class="badge" [class.verified]="record.status === 'Verified'" [class.review]="record.status === 'In review'" [class.action]="record.status === 'Action needed'"><i></i>{{ record.status }}</span></td></tr> } @empty { <tr><td [attr.colspan]="isAdmin() ? 6 : 5">No records available.</td></tr> }</tbody></table></div> }</section>
          }
          @if (tab() === 'users' && isAdmin()) {
            <div class="page-head compact"><div><div class="eyebrow">ADMINISTRATION</div><h1>People & <em>access.</em></h1><p>Invite members and manage their level of access.</p></div><span class="head-number">{{ users().length.toString().padStart(2, '0') }}</span></div>
            <div class="admin-grid"><section class="card create-card"><div class="eyebrow">ADD A MEMBER</div><h3>Make room for someone new.</h3><form (ngSubmit)="createUser()"><label for="newName">Full name</label><input id="newName" name="newName" [(ngModel)]="newName" placeholder="e.g. Sam Taylor" required minlength="2"><label for="newEmail">Email address</label><input id="newEmail" name="newEmail" [(ngModel)]="newEmail" type="email" placeholder="sam@example.com" required><label for="newRole">Access level</label><select id="newRole" name="newRole" [(ngModel)]="newRole"><option>General User</option><option>Admin</option></select><label for="newPassword">Temporary password</label><input id="newPassword" name="newPassword" [(ngModel)]="newPassword" type="password" placeholder="Minimum 8 characters" required minlength="8">@if (adminError()) { <p class="form-error" role="alert">{{ adminError() }}</p> } @if (adminSuccess()) { <p class="form-success" role="status">{{ adminSuccess() }}</p> }<button class="primary-btn wide" [disabled]="saving()" type="submit">{{ saving() ? 'Adding member…' : 'Add member' }} <span>→</span></button></form></section><section class="card members-card"><div class="card-title-row"><div><div class="eyebrow">MEMBER DIRECTORY</div><h3>People in your workspace</h3></div><span class="member-count">{{ users().length }} TOTAL</span></div>@if (usersLoading()) { <div class="skeleton">Loading members…</div> } @else { @for (member of users(); track member.id) { <div class="member-row"><div class="avatar small" [class.inactive]="!member.active">{{ member.name.slice(0, 1) }}</div><div class="member-info"><b>{{ member.name }}</b><small>{{ member.id }} · {{ member.email }}</small></div><select aria-label="Role for {{ member.name }}" [ngModel]="member.role" (ngModelChange)="changeRole(member, $event)" [disabled]="member.id === auth.user()?.id || saving()"><option>General User</option><option>Admin</option></select><button class="state-btn" [class.off]="!member.active" [disabled]="member.id === auth.user()?.id || saving()" (click)="toggleActive(member)">{{ member.active ? 'Active' : 'Paused' }}</button></div> } @empty { <div class="empty">No members found.</div> } }</section></div>
          }
        </main>
      </div>
    </div>`
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private api = inject(UserService);
  private router = inject(Router);
  private loadGeneration = 0;
  private destroyed = false;
  tab = signal<'overview' | 'records' | 'users'>('overview');
  profile = signal<User | null>(null);
  records = signal<CheckRecord[]>([]);
  users = signal<User[]>([]);
  profileLoading = signal(true);
  recordsLoading = signal(true);
  usersLoading = signal(false);
  profileError = signal('');
  recordsError = signal('');
  adminError = signal('');
  adminSuccess = signal('');
  saving = signal(false);
  delayMs = 1500;
  newName = ''; newEmail = ''; newRole: Role = 'General User'; newPassword = '';
  isAdmin = computed(() => this.auth.user()?.role === 'Admin');
  firstName = computed(() => (this.profile()?.name || this.auth.user()?.name || 'there').split(' ')[0]);
  initials = computed(() => (this.profile()?.name || this.auth.user()?.name || '?').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase());
  greeting() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'; }
  todayLabel() { return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase(); }
  count(status: string) { return this.records().filter(item => item.status === status).length; }
  typeGlyph(type: string) { return type === 'Identity' ? '◇' : type === 'Employment' ? '▣' : type === 'Education' ? '✳' : '⌂'; }
  ngOnInit() { this.loadDashboard(); if (this.isAdmin()) this.loadUsers(); }
  ngOnDestroy() { this.destroyed = true; this.loadGeneration++; }

  loadDashboard() {
    const generation = ++this.loadGeneration;
    const userId = this.auth.user()?.id;
    const current = () => !this.destroyed && generation === this.loadGeneration && this.auth.user()?.id === userId;
    this.profileLoading.set(true); this.recordsLoading.set(true); this.profileError.set(''); this.recordsError.set('');
    firstValueFrom(this.api.profile(this.delayMs)).then(result => { if (current()) { this.profile.set(result.user); this.auth.user.set(result.user); } }).catch(() => { if (current()) { this.profile.set(null); this.profileError.set('Could not load your profile.'); } }).finally(() => { if (current()) this.profileLoading.set(false); });
    firstValueFrom(this.api.records(this.delayMs)).then(result => { if (current()) this.records.set(result.records); }).catch(() => { if (current()) { this.records.set([]); this.recordsError.set('Could not load checks. Try refreshing.'); } }).finally(() => { if (current()) this.recordsLoading.set(false); });
  }
  showUsers() { this.tab.set('users'); this.loadUsers(); }
  loadUsers() { this.usersLoading.set(true); firstValueFrom(this.api.users()).then(result => this.users.set(result.users)).catch(() => this.adminError.set('Could not load members.')).finally(() => this.usersLoading.set(false)); }
  async createUser() {
    if (this.saving()) return;
    if (this.newName.trim().length < 2 || this.newName.trim().length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.newEmail.trim()) || this.newEmail.trim().length > 254 || this.newPassword.length < 8 || this.newPassword.length > 128) {
      this.adminSuccess.set('');
      this.adminError.set('Enter a name (2–120 characters), valid email and password (8–128 characters).');
      return;
    }
    this.adminError.set(''); this.adminSuccess.set(''); this.saving.set(true);
    try { const result = await firstValueFrom(this.api.create({ name: this.newName.trim(), email: this.newEmail.trim(), role: this.newRole, password: this.newPassword })); this.users.update(items => [...items, result.user]); this.newName = ''; this.newEmail = ''; this.newPassword = ''; this.newRole = 'General User'; this.adminSuccess.set('Member added successfully.'); }
    catch (error) { this.adminError.set(this.message(error)); }
    finally { this.saving.set(false); }
  }
  async changeRole(member: User, role: Role) { await this.updateUser(member, { role }); }
  async toggleActive(member: User) { await this.updateUser(member, { active: !member.active }); }
  private async updateUser(member: User, change: { role?: Role; active?: boolean }) {
    if (this.saving()) return;
    this.adminError.set(''); this.adminSuccess.set(''); this.saving.set(true);
    try { const result = await firstValueFrom(this.api.update(member.id, change)); this.users.update(items => items.map(item => item.id === member.id ? result.user : item)); this.adminSuccess.set(`${member.name} updated.`); }
    catch (error) { this.adminError.set(this.message(error)); this.loadUsers(); }
    finally { this.saving.set(false); }
  }
  private message(error: unknown): string { return error instanceof Object && 'error' in error ? (error as { error?: { message?: string } }).error?.message || 'Request failed' : 'Request failed'; }
  async signOut() { const pending = this.auth.logout(); await this.router.navigateByUrl('/login'); await pending; }
}
