import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const dbPath = join(root, 'data', 'asteria.db');

export function openDatabase() {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function initializeDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'operator')),
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      label TEXT NOT NULL,
      balance INTEGER NOT NULL CHECK(balance >= 0)
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account INTEGER NOT NULL REFERENCES accounts(id),
      to_account INTEGER NOT NULL REFERENCES accounts(id),
      amount INTEGER NOT NULL CHECK(amount > 0),
      memo TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS promotions (
      code TEXT PRIMARY KEY,
      credit INTEGER NOT NULL CHECK(credit > 0),
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS redemptions (
      user_id INTEGER NOT NULL REFERENCES users(id),
      code TEXT NOT NULL REFERENCES promotions(code),
      redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, code)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      body TEXT NOT NULL
    );
  `);
}

export function seedDatabase(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count > 0) return;

  db.exec('BEGIN');
  try {
    const addUser = db.prepare('INSERT INTO users (id, username, display_name, email, role) VALUES (?, ?, ?, ?, ?)');
    addUser.run(1, 'alice', 'Alice Aoki', 'alice@example.test', 'customer');
    addUser.run(2, 'bob', 'Bob Ban', 'bob@example.test', 'customer');
    addUser.run(99, 'ops', 'Operations', 'ops@example.test', 'operator');

    const addAccount = db.prepare('INSERT INTO accounts (id, user_id, label, balance) VALUES (?, ?, ?, ?)');
    addAccount.run(1001, 1, 'Alice 普通預金', 250000);
    addAccount.run(1002, 1, 'Alice 貯蓄預金', 80000);
    addAccount.run(2001, 2, 'Bob 普通預金', 175000);
    db.prepare('INSERT INTO promotions (code, credit) VALUES (?, ?)').run('WELCOME500', 500);
    db.prepare('INSERT INTO messages (user_id, subject, body) VALUES (?, ?, ?)').run(1, 'ご利用ありがとうございます', 'Asteria Bankへようこそ。');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
