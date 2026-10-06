import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporary = mkdtempSync(join(tmpdir(), 'mploychek-browser-qa-'));
const apiPort = 3002;
const baseUrl = 'http://127.0.0.1:4201';
const api = spawn(process.execPath, ['--experimental-strip-types', resolve('../server/src/server.ts')], { env: { ...process.env, NODE_ENV: 'development', PORT: String(apiPort), MPLOYCHEK_DATA_FILE: join(temporary, 'db.json') }, stdio: 'pipe', windowsHide: true });
const frontend = spawn(process.execPath, [resolve('node_modules/@angular/cli/bin/ng.js'), 'serve', '--host', '127.0.0.1', '--port', '4201'], { stdio: 'pipe', windowsHide: true });
let serverLog = '';
for (const process of [api, frontend]) {
  process.stdout.on('data', chunk => { serverLog += chunk; });
  process.stderr.on('data', chunk => { serverLog += chunk; });
}
let browser;
const errors = [];
const passed = [];
const accessibilityIssues = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function checkAccessibility(page, label) {
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  const results = await page.evaluate(async () => (await window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
  if (results.length) accessibilityIssues.push({ label, results });
}
async function login(page, id, password, role) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('User ID').fill(id);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Your role').selectOption(role);
  await page.getByRole('button', { name: /Enter workspace/ }).click();
  await page.waitForURL('**/dashboard');
}
async function newPage(viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    url.port = String(apiPort);
    const response = await route.fetch({ url: url.toString() });
    await route.fulfill({ response });
  });
  return page;
}
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok) break; } catch {}
    if (attempt >= 150) throw new Error(`QA API did not start: ${serverLog}`);
    await wait(100);
  }
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt >= 150) throw new Error(`QA frontend did not start: ${serverLog}`);
    await wait(100);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--disable-gpu', '--disable-software-rasterizer', '--no-sandbox'] });
  const admin = await newPage();
  await admin.goto(`${baseUrl}/dashboard`);
  await admin.waitForURL('**/login');
  await checkAccessibility(admin, 'Login');
  passed.push('Protected routes redirect unauthenticated visitors');
  await admin.getByLabel('User ID').fill('ADM-001');
  await admin.getByLabel('Password').fill('Admin@123');
  await admin.getByLabel('Your role').selectOption('General User');
  await admin.getByRole('button', { name: /Enter workspace/ }).click();
  await admin.getByRole('alert').getByText(/incorrect/).waitFor();
  assert.ok(admin.url().endsWith('/login'));
  passed.push('Wrong selected role cannot authenticate a valid account');
  await login(admin, 'ADM-001', 'Admin@123', 'Admin');
  await admin.getByRole('button', { name: 'People', exact: true }).click();
  await admin.waitForFunction(() => document.querySelectorAll('.member-row').length === 3);
  await checkAccessibility(admin, 'Admin directory');
  const self = admin.locator('.member-row').filter({ hasText: 'Alex Rivera' });
  assert.equal(await self.locator('select').isDisabled(), true);
  assert.equal(await self.getByRole('button').isDisabled(), true);
  await admin.getByLabel('Full name').fill('x'.repeat(121));
  await admin.getByLabel('Email address').fill('qa@example.com');
  await admin.getByLabel('Temporary password').fill('QApassword9');
  await admin.getByRole('button', { name: 'Add member' }).click();
  await admin.getByRole('alert').getByText(/2–120 characters/).waitFor();
  passed.push('Member form rejects an oversized name before sending a mutation');
  await admin.getByLabel('Full name').fill('QA Member');
  await admin.getByLabel('Email address').fill('qa@example.com');
  await admin.getByLabel('Temporary password').fill('QApassword9');
  await admin.getByRole('button', { name: 'Add member' }).click();
  await admin.getByRole('status').getByText('Member added successfully.').waitFor();
  const member = admin.locator('.member-row').filter({ hasText: 'QA Member' });
  await member.waitFor();
  const id = (await member.locator('small').textContent()).split(' · ')[0];
  await admin.getByLabel('Full name').fill('Duplicate Member');
  await admin.getByLabel('Email address').fill('QA@example.com');
  await admin.getByLabel('Temporary password').fill('QApassword9');
  await admin.getByRole('button', { name: 'Add member' }).click();
  await admin.getByRole('alert').getByText('Email already exists').waitFor();
  await member.getByRole('combobox').selectOption('Admin');
  await admin.getByRole('status').getByText('QA Member updated.').waitFor();
  await member.getByRole('combobox').selectOption('General User');
  await member.getByRole('button', { name: 'Active', exact: true }).click();
  await member.getByRole('button', { name: 'Paused', exact: true }).waitFor();
  await member.getByRole('button', { name: 'Paused', exact: true }).click();
  await member.getByRole('button', { name: 'Active', exact: true }).waitFor();
  passed.push('Admin creation, duplicate email, role updates, pause/reactivation and self-protection');

  const general = await newPage();
  await login(general, id, 'QApassword9', 'General User');
  await general.getByText('QA Member', { exact: true }).waitFor();
  await general.getByRole('button', { name: 'My checks', exact: true }).click();
  await general.getByText('No records available.').waitFor();
  assert.equal(await general.getByRole('button', { name: 'People', exact: true }).count(), 0);
  await general.reload();
  await general.getByText('QA Member', { exact: true }).waitFor();
  passed.push('New member has empty records and session survives reload');
  await member.getByRole('button', { name: 'Active', exact: true }).click();
  await member.getByRole('button', { name: 'Paused', exact: true }).waitFor();
  await general.getByRole('button', { name: 'My checks', exact: true }).click();
  await general.getByRole('button', { name: /Refresh data/ }).click();
  await general.waitForURL('**/login');
  assert.equal(await general.evaluate(() => sessionStorage.getItem('mploychek_token')), null);
  passed.push('Deactivated session is cleared and redirected to login');

  await login(general, 'USR-001', 'User@123', 'General User');
  await general.getByText('Avery Morgan', { exact: true }).waitFor();
  await checkAccessibility(general, 'Overview');
  await general.getByRole('button', { name: 'My checks', exact: true }).click();
  await general.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3);
  const initialDelay = await general.locator('#delay').inputValue();
  assert.equal(initialDelay, '1500');
  assert.equal(await general.locator('.delay-control label b').textContent(), `${initialDelay} ms`);
  await general.getByLabel('API delay').fill('0');
  await general.route('**/api/records?*', route => route.abort());
  await general.getByRole('button', { name: /Refresh data/ }).click();
  await general.getByText('Could not load checks. Try refreshing.').waitFor();
  await general.unroute('**/api/records?*');
  await general.getByRole('button', { name: /Refresh data/ }).click();
  await general.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3);
  passed.push('Network error shows feedback and refresh recovers');
  let count = 0;
  await general.route('**/api/records?*', async route => {
    const order = ++count;
    await wait(order === 1 ? 800 : 40);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: order === 1 ? [{ id: 'STALE', ownerId: 'USR-001', subject: 'Stale response', type: 'Identity', status: 'Verified', updated: '2026-10-06', reference: 'OLD' }] : [] }) });
  });
  await general.getByRole('button', { name: /Refresh data/ }).click();
  await general.getByRole('button', { name: /Refresh data/ }).click();
  await general.getByText('No records available.').waitFor();
  await wait(1000);
  assert.equal(await general.getByText('Stale response').count(), 0);
  passed.push('An older overlapping response cannot overwrite the latest refresh');
  await general.unroute('**/api/records?*');
  await general.evaluate(() => sessionStorage.setItem('mploychek_token', 'invalid-token'));
  await general.reload();
  await general.waitForURL('**/login');
  passed.push('Invalid saved token is cleared during app initialization');

  const mobile = await newPage({ width: 390, height: 844 });
  await login(mobile, 'USR-001', 'User@123', 'General User');
  await mobile.getByRole('button', { name: 'My checks', exact: true }).click();
  await mobile.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3);
  await checkAccessibility(mobile, 'Mobile records');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.getByRole('region', { name: 'Verification records' }).focus();
  await mobile.keyboard.press('ArrowRight');
  await mobile.waitForFunction(() => document.querySelector('.table-scroll').scrollLeft > 0);
  await mobile.getByRole('button', { name: 'Sign out', exact: true }).click();
  await mobile.waitForURL('**/login');
  passed.push('Mobile navigation, table containment and sign-out');
  assert.deepEqual(errors, []);
  assert.deepEqual(accessibilityIssues, [], JSON.stringify(accessibilityIssues, null, 2));
  passed.push('WCAG A/AA automated checks across login, overview, admin directory and mobile records');
  for (const result of passed) console.log(`PASS: ${result}`);
  console.log(`QA complete: ${passed.length} browser scenarios; no uncaught page errors.`);
} finally {
  if (browser) await browser.close();
  await Promise.all([api, frontend].map(async process => {
    if (process.exitCode !== null) return;
    const exited = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await exited;
  }));
  rmSync(temporary, { recursive: true, force: true });
}
