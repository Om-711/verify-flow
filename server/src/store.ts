import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type Role = 'General User' | 'Admin';
export type User = { id: string; name: string; email: string; role: Role; passwordHash: string; active: boolean; joined: string };
export type RecordItem = { id: string; ownerId: string; subject: string; type: string; status: string; updated: string; reference: string };
export type Data = { users: User[]; records: RecordItem[] };

const defaultFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');
export const dataFile = process.env['MPLOYCHEK_DATA_FILE'] || defaultFile;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function seed(): Data {
  const joined = '2026-09-18';
  return {
    users: [
      { id: 'USR-001', name: 'Avery Morgan', email: 'avery@demo.mploychek.com', role: 'General User', passwordHash: hashPassword('User@123'), active: true, joined },
      { id: 'USR-002', name: 'Jordan Lee', email: 'jordan@demo.mploychek.com', role: 'General User', passwordHash: hashPassword('User@123'), active: true, joined },
      { id: 'ADM-001', name: 'Alex Rivera', email: 'alex@demo.mploychek.com', role: 'Admin', passwordHash: hashPassword('Admin@123'), active: true, joined }
    ],
    records: [
      { id: 'CHK-1048', ownerId: 'USR-001', subject: 'Employment history', type: 'Employment', status: 'Verified', updated: '2026-10-04', reference: 'EMP-4821' },
      { id: 'CHK-1042', ownerId: 'USR-001', subject: 'Academic credentials', type: 'Education', status: 'In review', updated: '2026-10-02', reference: 'EDU-2940' },
      { id: 'CHK-1036', ownerId: 'USR-001', subject: 'Identity document', type: 'Identity', status: 'Verified', updated: '2026-09-28', reference: 'ID-8031' },
      { id: 'CHK-1029', ownerId: 'USR-002', subject: 'Address verification', type: 'Address', status: 'Action needed', updated: '2026-10-01', reference: 'ADR-9062' },
      { id: 'CHK-1023', ownerId: 'USR-002', subject: 'Employment history', type: 'Employment', status: 'Verified', updated: '2026-09-26', reference: 'EMP-6641' },
      { id: 'CHK-1015', ownerId: 'ADM-001', subject: 'Admin identity check', type: 'Identity', status: 'Verified', updated: '2026-09-22', reference: 'ID-1124' }
    ]
  };
}

export function readData(): Data {
  if (!existsSync(dataFile)) {
    const initial = seed();
    writeData(initial);
    return initial;
  }
  return JSON.parse(readFileSync(dataFile, 'utf8')) as Data;
}

export function writeData(data: Data): void {
  mkdirSync(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2));
  renameSync(temporary, dataFile);
}

export function publicUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
