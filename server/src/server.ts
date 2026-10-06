import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readData, writeData, publicUser, verifyPassword, hashPassword, type Role, type User } from './store.ts';

const sessions = new Map<string, string>();
const port = Number(process.env['PORT'] || 3000);
const origin = process.env['CLIENT_ORIGIN'] || 'http://localhost:4200';

function respond(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' });
  res.end(JSON.stringify(body));
}

async function bodyOf(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error('Request body is too large');
  }
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object');
  return parsed as Record<string, unknown>;
}

function delayOf(url: URL): number | null {
  const raw = url.searchParams.get('delayMs');
  if (raw === null) return 0;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5000 ? value : null;
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const validRole = (role: unknown): role is Role => role === 'General User' || role === 'Admin';
const validEmail = (email: unknown): email is string => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return respond(res, 204, {});
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const delayMs = delayOf(url);
    if (delayMs === null) return respond(res, 400, { message: 'delayMs must be an integer from 0 to 5000' });
    if (url.pathname === '/api/health') return respond(res, 200, { status: 'ok' });
    const input = req.method === 'POST' || req.method === 'PATCH' ? await bodyOf(req) : {};
    // Read and authorize after the simulated delay so revoked sessions and role changes take effect.
    await pause(delayMs);
    const data = readData();

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const user = data.users.find(item => item.id.toLowerCase() === String(input['userId'] || '').trim().toLowerCase());
      if (!user || !user.active || !validRole(input['role']) || user.role !== input['role'] || typeof input['password'] !== 'string' || !verifyPassword(input['password'], user.passwordHash)) {
        return respond(res, 401, { message: 'User ID, password or role is incorrect' });
      }
      const token = randomBytes(32).toString('hex');
      sessions.set(token, user.id);
      return respond(res, 200, { token, user: publicUser(user) });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
    const current = data.users.find(item => item.id === sessions.get(token) && item.active);
    if (!current) return respond(res, 401, { message: 'Please sign in again' });
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      sessions.delete(token);
      return respond(res, 200, { message: 'Signed out' });
    }
    if (url.pathname === '/api/me' && req.method === 'GET') {
      return respond(res, 200, { user: publicUser(current) });
    }
    if (url.pathname === '/api/records' && req.method === 'GET') {
      return respond(res, 200, { records: data.records.filter(item => current.role === 'Admin' || item.ownerId === current.id) });
    }
    if (current.role !== 'Admin') return respond(res, 403, { message: 'Admin access required' });
    if (url.pathname === '/api/users' && req.method === 'GET') {
      return respond(res, 200, { users: data.users.map(publicUser) });
    }
    if (url.pathname === '/api/users' && req.method === 'POST') {
      if (typeof input['name'] !== 'string' || input['name'].trim().length < 2 || input['name'].trim().length > 120 || !validEmail(input['email']) || input['email'].length > 254 || !validRole(input['role']) || typeof input['password'] !== 'string' || input['password'].length < 8 || input['password'].length > 128) {
        return respond(res, 400, { message: 'Enter a name, valid email, role and password of at least 8 characters' });
      }
      if (data.users.some(item => item.email.toLowerCase() === String(input['email']).toLowerCase())) return respond(res, 409, { message: 'Email already exists' });
      const user: User = { id: `USR-${randomBytes(3).toString('hex').toUpperCase()}`, name: input['name'].trim(), email: input['email'].toLowerCase(), role: input['role'], passwordHash: hashPassword(input['password']), active: true, joined: new Date().toISOString().slice(0, 10) };
      data.users.push(user);
      writeData(data);
      return respond(res, 201, { user: publicUser(user) });
    }
    const match = /^\/api\/users\/([^/]+)$/.exec(url.pathname);
    if (match && req.method === 'PATCH') {
      const user = data.users.find(item => item.id === decodeURIComponent(match[1]));
      if (!user) return respond(res, 404, { message: 'User not found' });
      if (Object.keys(input).length === 0 || Object.keys(input).some(key => key !== 'role' && key !== 'active')) return respond(res, 400, { message: 'Provide role or active status only' });
      if (input['role'] !== undefined && !validRole(input['role'])) return respond(res, 400, { message: 'Invalid role' });
      if (input['active'] !== undefined && typeof input['active'] !== 'boolean') return respond(res, 400, { message: 'Invalid status' });
      if (user.id === current.id && (input['active'] === false || input['role'] === 'General User')) return respond(res, 400, { message: 'You cannot remove your own admin access' });
      if (input['role'] !== undefined) user.role = input['role'];
      if (input['active'] !== undefined) user.active = input['active'];
      writeData(data);
      return respond(res, 200, { user: publicUser(user) });
    }
    return respond(res, 404, { message: 'Endpoint not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = error instanceof SyntaxError || error instanceof URIError || message === 'Request body is too large' || message === 'Expected a JSON object' ? 400 : 500;
    return respond(res, status, { message: status === 500 ? 'Internal server error' : message });
  }
});

if (process.env['NODE_ENV'] !== 'test') server.listen(port, () => console.log(`MPloyChek API listening on http://localhost:${port}`));
