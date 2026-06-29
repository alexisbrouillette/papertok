import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, 'papertok.db');
const dbDir = dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let resolveDbReady;
export const dbReady = new Promise((resolve) => {
  resolveDbReady = resolve;
});

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err);
    resolveDbReady(); // Resolve to avoid hanging server
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeSchema();
  }
});

function initializeSchema() {
  db.serialize(() => {
    // 1. Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. User API keys table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_keys (
        user_id INTEGER PRIMARY KEY,
        gemini_key TEXT,
        s2_key TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Reading progress table
    db.run(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        paper_title TEXT NOT NULL,
        category_key TEXT NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, topic, paper_title, category_key)
      )
    `);

    // 4. User streaks table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        user_id INTEGER PRIMARY KEY,
        current_streak INTEGER DEFAULT 0,
        last_read_date TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 5. Global digests cache table
    db.run(`
      CREATE TABLE IF NOT EXISTS cached_digests (
        topic TEXT NOT NULL,
        digest_date TEXT NOT NULL,
        papers_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (topic, digest_date)
      )
    `);

    // 6. Push notifications subscription table
    db.run(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subscription_json TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 7. Background digest generation queue table
    db.run(`
      CREATE TABLE IF NOT EXISTS generation_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        status_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, topic, status)
      )
    `);

    // Safely add columns if table already exists
    db.run(`ALTER TABLE generation_queue ADD COLUMN priority INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE generation_queue ADD COLUMN progress INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE generation_queue ADD COLUMN status_text TEXT`, () => {});

    // Safely add notification tracking columns to user_streaks
    db.run(`ALTER TABLE user_streaks ADD COLUMN last_unlock_alert_sent_at DATETIME`, () => {});
    db.run(`ALTER TABLE user_streaks ADD COLUMN last_reminder_sent_date TEXT`, () => {});

    db.run("SELECT 1", (err) => {
      if (err) console.error('Failed to complete DB initialization:', err);
      else console.log('SQLite database schemas initialized.');
      resolveDbReady();
    });
  });
}

// Promise-based query wrappers for async/await usage
export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
