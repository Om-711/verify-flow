import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';

const temporary = mkdtempSync(join(tmpdir(), 'mploychek-test-'));
process.env['NODE_ENV'] = 'test';
process.env['MPLOYCHEK_DATA_FILE'] = join(temporary, 'db.json');
const { server } = await import('./server.ts');
let base = '';

before(async () => {
  await new Promise<void>(resolve => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test('QA: concurrent writes preserve every member and duplicate checks remain atomic', async () => {
  const login = await request('/api/login', 'POST', { userId: 'ADM-001', password: 'Admin@123', role: 'Admin' });
  const token = login.data.token as string;
  const responses = await Promise.all(Array.from({ length: 5 }, (_, index) => request('/api/users', 'POST', { name: `QA Member ${index}`, email: `concurrent${index}@example.com`, role: 'General User', password: 'StrongPass9' }, token)));
  assert.ok(responses.every(result => result.status === 201));
  const directory = await request('/api/users', 'GET', undefined, token);
  for (const response of responses) assert.ok(directory.data.users.some((user: { id: string }) => user.id === response.data.user.id), 'Concurrent creation lost a user');
  const duplicates = await Promise.all([0, 1].map(() => request('/api/users', 'POST', { name: 'Duplicate Test', email: 'duplicate@example.com', role: 'General User', password: 'StrongPass9' }, token)));
  assert.deepEqual(duplicates.map(result => result.status).sort(), [201, 409]);
});

test('QA: logout revokes a request that is still waiting on API delay', async () => {
  const login = await request('/api/login', 'POST', { userId: 'USR-001', password: 'User@123', role: 'General User' });
  const token = login.data.token as string;
  const pending = request('/api/records?delayMs=250', 'GET', undefined, token);
  await new Promise(resolve => setTimeout(resolve, 50));
  await request('/api/logout', 'POST', {}, token);
  assert.equal((await pending).status, 401);
});

test('QA: malformed and boundary input receives a client error', async () => {
  const login = await request('/api/login', 'POST', { userId: 'ADM-001', password: 'Admin@123', role: 'Admin' });
  const token = login.data.token as string;
  for (const value of ['', '-1', '0.5', 'NaN', '5001']) assert.equal((await request(`/api/me?delayMs=${value}`, 'GET', undefined, token)).status, 400, `Invalid delay ${value}`);
  const malformed = await fetch(`${base}/api/users`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(malformed.status, 400);
  assert.equal((await request('/api/users/%ZZ', 'PATCH', { active: true }, token)).status, 400);
  assert.equal((await request('/api/users', 'POST', { name: 'x'.repeat(121), email: 'long@example.com', role: 'General User', password: 'StrongPass9' }, token)).status, 400);
  assert.equal((await request('/api/users', 'POST', { name: 'QA Member', email: 'valid@example.com', role: 'Invalid', password: 'short' }, token)).status, 400);
  for (const body of ['null', '[]', JSON.stringify({ name: 'x'.repeat(17000) })]) {
    const response = await fetch(`${base}/api/users`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 400);
  }
  assert.equal((await request('/api/users/ADM-001', 'PATCH', {}, token)).status, 400);
  assert.equal((await request('/api/users/ADM-001', 'PATCH', { unexpected: true }, token)).status, 400);
  assert.equal((await request('/api/users/ADM-001', 'PATCH', { active: 'false' }, token)).status, 400);
  assert.equal((await request('/api/users/MISSING', 'PATCH', { active: false }, token)).status, 404);
  assert.equal((await request('/api/health?delayMs=5000')).status, 200);
  assert.equal((await request('/api/me?delayMs=0', 'GET', undefined, token)).status, 200);
});

test('QA: a slow body cannot overwrite a newer persistent write', async () => {
  const login = await request('/api/login', 'POST', { userId: 'ADM-001', password: 'Admin@123', role: 'Admin' });
  const token = login.data.token as string;
  const payload = JSON.stringify({ name: 'Slow Upload', email: 'slow@example.com', role: 'General User', password: 'StrongPass9' });
  let finish!: () => void;
  const pending = new Promise<number>((resolve, reject) => {
    const upload = httpRequest(`${base}/api/users`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode!)); });
    upload.on('error', reject);
    upload.write(payload.slice(0, 10));
    finish = () => upload.end(payload.slice(10));
  });
  await new Promise(resolve => setTimeout(resolve, 60));
  const newer = await request('/api/users', 'POST', { name: 'Newer Write', email: 'newer@example.com', role: 'General User', password: 'StrongPass9' }, token);
  assert.equal(newer.status, 201);
  finish();
  assert.equal(await pending, 201);
  const directory = await request('/api/users', 'GET', undefined, token);
  assert.ok(directory.data.users.some((user: { email: string }) => user.email === 'newer@example.com'));
  assert.ok(directory.data.users.some((user: { email: string }) => user.email === 'slow@example.com'));
});

test('QA: pending admin read respects a role change and deactivation invalidates sessions', async () => {
  const root = await request('/api/login', 'POST', { userId: 'ADM-001', password: 'Admin@123', role: 'Admin' });
  const rootToken = root.data.token as string;
  const created = await request('/api/users', 'POST', { name: 'Temporary Admin', email: 'temp-admin@example.com', role: 'Admin', password: 'StrongPass9' }, rootToken);
  const id = created.data.user.id;
  const login = await request('/api/login', 'POST', { userId: id, password: 'StrongPass9', role: 'Admin' });
  const token = login.data.token as string;
  const pending = request('/api/users?delayMs=250', 'GET', undefined, token);
  await new Promise(resolve => setTimeout(resolve, 50));
  await request(`/api/users/${id}`, 'PATCH', { role: 'General User' }, rootToken);
  assert.equal((await pending).status, 403);
  assert.equal((await request('/api/records', 'GET', undefined, token)).data.records.length, 0);
  await request(`/api/users/${id}`, 'PATCH', { active: false }, rootToken);
  assert.equal((await request('/api/me', 'GET', undefined, token)).status, 401);
  assert.equal((await request('/api/users', 'POST', { name: 'Forbidden', email: 'forbidden@example.com', role: 'Admin', password: 'StrongPass9' }, token)).status, 401);
});
after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  rmSync(temporary, { recursive: true, force: true });
});

async function request(path: string, method = 'GET', body?: object, token?: string) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() as Record<string, any> };
}

test('login, access boundaries, admin changes, and async delay', async () => {
  const badRole = await request('/api/login', 'POST', { userId: 'USR-001', password: 'User@123', role: 'Admin' });
  assert.equal(badRole.status, 401);
  const badPassword = await request('/api/login', 'POST', { userId: 'USR-001', password: 'wrong', role: 'General User' });
  assert.equal(badPassword.status, 401);
  const general = await request('/api/login', 'POST', { userId: 'USR-001', password: 'User@123', role: 'General User' });
  assert.equal(general.status, 200);
  assert.equal(general.data.user.passwordHash, undefined);
  const userToken = general.data.token as string;
  const mine = await request('/api/records', 'GET', undefined, userToken);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.records.length, 3);
  assert.ok(mine.data.records.every((record: { ownerId: string }) => record.ownerId === 'USR-001'));
  assert.equal((await request('/api/users', 'GET', undefined, userToken)).status, 403);
  assert.equal((await request('/api/records')).status, 401);
  assert.equal((await request('/api/records?delayMs=6000', 'GET', undefined, userToken)).status, 400);
  const started = performance.now();
  assert.equal((await request('/api/me?delayMs=300', 'GET', undefined, userToken)).status, 200);
  assert.ok(performance.now() - started >= 280);

  const admin = await request('/api/login', 'POST', { userId: 'ADM-001', password: 'Admin@123', role: 'Admin' });
  assert.equal(admin.status, 200);
  const adminToken = admin.data.token as string;
  assert.equal((await request('/api/records', 'GET', undefined, adminToken)).data.records.length, 6);
  const created = await request('/api/users', 'POST', { name: 'Sam Taylor', email: 'sam@example.com', role: 'General User', password: 'StrongPass9' }, adminToken);
  assert.equal(created.status, 201);
  const id = created.data.user.id as string;
  assert.equal((await request('/api/users', 'POST', { name: 'Sam Taylor', email: 'sam@example.com', role: 'General User', password: 'StrongPass9' }, adminToken)).status, 409);
  assert.equal((await request(`/api/users/${id}`, 'PATCH', { role: 'Admin' }, adminToken)).data.user.role, 'Admin');
  assert.equal((await request(`/api/users/${id}`, 'PATCH', { active: false }, adminToken)).data.user.active, false);
  assert.equal((await request('/api/login', 'POST', { userId: id, password: 'StrongPass9', role: 'Admin' })).status, 401);
  assert.equal((await request('/api/users/ADM-001', 'PATCH', { active: false }, adminToken)).status, 400);
  assert.equal((await request('/api/logout', 'POST', {}, userToken)).status, 200);
  assert.equal((await request('/api/me', 'GET', undefined, userToken)).status, 401);
});
