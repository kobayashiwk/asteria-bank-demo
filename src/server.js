import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, openDatabase, seedDatabase } from './db.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const publicRoot = join(root, 'public');
const db = openDatabase();
initializeDatabase(db);
seedDatabase(db);

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_768) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function actor(req) {
  const raw = req.headers['x-demo-user'] ?? '1';
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) return null;
  return db.prepare('SELECT id, username, display_name AS displayName, email, role, status FROM users WHERE id = ? AND status = ?').get(id, 'active') ?? null;
}

function requireActor(req, res) {
  const user = actor(req);
  if (!user) json(res, 401, { error: 'authentication_required' });
  return user;
}

function parsePositiveInteger(value) {
  const text = String(value);
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function localPath(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

function accountForUser(accountId, userId) {
  return db.prepare('SELECT id, user_id AS userId, label, balance FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
}

function route(method, pattern, handler) {
  return { method, pattern, handler };
}

const routes = [
  route('GET', /^\/api\/me$/, async (req, res) => {
    const user = requireActor(req, res);
    if (user) json(res, 200, user);
  }),
  route('GET', /^\/api\/accounts$/, async (req, res) => {
    const user = requireActor(req, res);
    if (!user) return;
    const rows = db.prepare('SELECT id, label, balance FROM accounts WHERE user_id = ? ORDER BY id').all(user.id);
    json(res, 200, rows);
  }),
  route('GET', /^\/api\/accounts\/(\d+)$/, async (req, res, match) => {
    const user = requireActor(req, res);
    if (!user) return;
    const requestedAccountId = Number(match[1]);
    const account = db.prepare(`
      SELECT id, user_id AS userId, label, balance
      FROM accounts
      WHERE id = ?
    `).get(requestedAccountId);
    if (!account) return json(res, 404, { error: 'account_not_found' });
    json(res, 200, account);
  }),
  route('POST', /^\/api\/transfers$/, async (req, res) => {
    const user = requireActor(req, res);
    if (!user) return;
    const input = await body(req);
    const amount = parsePositiveInteger(input.amount);
    const from = accountForUser(Number(input.fromAccount), user.id);
    const to = db.prepare('SELECT id FROM accounts WHERE id = ?').get(Number(input.toAccount));
    if (!amount || !from || !to || from.id === to.id || amount > from.balance) return json(res, 400, { error: 'invalid_transfer' });

    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ? AND balance >= ?').run(amount, from.id, user.id, amount);
      if (result.changes !== 1) throw new Error('balance_changed');
      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, to.id);
      db.prepare('INSERT INTO transfers (from_account, to_account, amount, memo) VALUES (?, ?, ?, ?)').run(from.id, to.id, amount, String(input.memo ?? '').slice(0, 80));
      db.exec('COMMIT');
      json(res, 201, { ok: true });
    } catch {
      db.exec('ROLLBACK');
      json(res, 409, { error: 'transfer_conflict' });
    }
  }),
  route('POST', /^\/api\/promotions\/redeem$/, async (req, res) => {
    const user = requireActor(req, res);
    if (!user) return;
    const input = await body(req);
    const code = String(input.code ?? '').trim().toUpperCase();
    const promotion = db.prepare('SELECT code, credit FROM promotions WHERE code = ? AND active = 1').get(code);
    const account = db.prepare('SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1').get(user.id);
    if (!promotion || !account) return json(res, 404, { error: 'promotion_not_found' });

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO redemptions (user_id, code) VALUES (?, ?)').run(user.id, code);
      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(promotion.credit, account.id);
      db.exec('COMMIT');
      json(res, 200, { credited: promotion.credit });
    } catch {
      db.exec('ROLLBACK');
      json(res, 409, { error: 'promotion_already_used' });
    }
  }),
  route('GET', /^\/api\/customers$/, async (req, res, _match, url) => {
    const user = requireActor(req, res);
    if (!user || user.role !== 'operator') return user && json(res, 403, { error: 'operator_required' });
    const query = `%${url.searchParams.get('q') ?? ''}%`;
    const rows = db.prepare('SELECT id, username, display_name AS displayName, email, status FROM users WHERE role = ? AND (username LIKE ? OR display_name LIKE ?)').all('customer', query, query);
    json(res, 200, rows);
  }),
  route('PATCH', /^\/api\/profile$/, async (req, res) => {
    const user = requireActor(req, res);
    if (!user) return;
    const input = await body(req);
    const displayName = String(input.displayName ?? '').trim().slice(0, 80);
    const email = String(input.email ?? '').trim().slice(0, 120);
    if (!displayName || !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'invalid_profile' });
    db.prepare('UPDATE users SET display_name = ?, email = ? WHERE id = ?').run(displayName, email, user.id);
    json(res, 200, { ok: true });
  }),
  route('POST', /^\/api\/messages\/preview$/, async (req, res) => {
    const user = requireActor(req, res);
    if (!user) return;
    const input = await body(req);
    json(res, 200, { preview: String(input.message ?? '').slice(0, 500) });
  }),
  route('GET', /^\/api\/statements\/export$/, async (req, res) => {
    const user = requireActor(req, res);
    if (!user) return;
    const rows = db.prepare(`SELECT created_at, amount, memo FROM transfers WHERE from_account IN (SELECT id FROM accounts WHERE user_id = ?) ORDER BY id DESC`).all(user.id);
    const cell = value => {
      const text = String(value ?? '');
      const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${guarded.replaceAll('"', '""')}"`;
    };
    const csv = ['date,amount,memo', ...rows.map(row => [row.created_at, row.amount, row.memo].map(cell).join(','))].join('\r\n');
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="statement.csv"' });
    res.end(csv);
  }),
  route('GET', /^\/go$/, async (_req, res, _match, url) => {
    res.writeHead(302, { location: localPath(url.searchParams.get('next'), '/') });
    res.end();
  })
];

async function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const clean = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const path = join(publicRoot, clean);
  if (!path.startsWith(publicRoot)) return json(res, 404, { error: 'not_found' });
  try {
    const data = await readFile(path);
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(path)] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff' });
    res.end(data);
  } catch {
    json(res, 404, { error: 'not_found' });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      for (const item of routes) {
        const match = url.pathname.match(item.pattern);
        if (req.method === item.method && match) return await item.handler(req, res, match, url);
      }
      if (req.method === 'GET') return await serveStatic(req, res, url);
      json(res, 404, { error: 'not_found' });
    } catch (error) {
      const status = error.message === 'request_too_large' ? 413 : 400;
      json(res, status, { error: status === 413 ? 'request_too_large' : 'invalid_request' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`Asteria Bank: http://localhost:${port}`));
}
