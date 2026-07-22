import 'dotenv/config';
import { createClient } from '@libsql/client';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In dev (no TURSO_DATABASE_URL), use a local SQLite file via libSQL's file: protocol.
// In production (Render + Turso), use the cloud URL + auth token.
let url = process.env.TURSO_DATABASE_URL;
if (!url) {
  const localDbPath = join(__dirname, 'papertok.db');
  url = `file:${localDbPath}`;
}
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const client = createClient({ url, authToken });

let resolveDbReady;
export const dbReady = new Promise((resolve) => {
  resolveDbReady = resolve;
});

async function initializeSchema() {
  try {
    console.log(`[DB] Connecting to: ${url.startsWith('file:') ? url : url.replace(/\/\/.*@/, '//<credentials>@')}`);

    // 1. Users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. User API keys table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_keys (
        user_id INTEGER PRIMARY KEY,
        gemini_key TEXT,
        s2_key TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Reading progress table
    await client.execute(`
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
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        user_id INTEGER PRIMARY KEY,
        current_streak INTEGER DEFAULT 0,
        last_read_date TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 5. User-specific digests cache table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS cached_digests (
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        digest_date TEXT NOT NULL,
        papers_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, topic, digest_date),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 6. Push notifications subscription table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subscription_json TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 7. Background digest generation queue table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS generation_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        digest_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        status_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, topic, digest_date, status)
      )
    `);

    // Safely add columns that may not exist yet (ignore errors if column already exists)
    const safeAlters = [
      `ALTER TABLE generation_queue ADD COLUMN priority INTEGER DEFAULT 0`,
      `ALTER TABLE generation_queue ADD COLUMN progress INTEGER DEFAULT 0`,
      `ALTER TABLE generation_queue ADD COLUMN status_text TEXT`,
      `ALTER TABLE user_streaks ADD COLUMN last_unlock_alert_sent_at DATETIME`,
      `ALTER TABLE user_streaks ADD COLUMN last_reminder_sent_date TEXT`,
    ];
    for (const stmt of safeAlters) {
      try {
        await client.execute(stmt);
      } catch (_) {
        // Column already exists — ignore
      }
    }

    console.log('[DB] Database schemas initialized.');
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err);
  } finally {
    resolveDbReady();
  }
}

initializeSchema();

// ── Promise-based query helpers (same API surface as before) ─────────────────

/**
 * Execute a write statement (INSERT, UPDATE, DELETE, CREATE, etc.)
 * Returns { lastID, changes } to match the old sqlite3 API.
 */
export async function dbRun(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return { lastID: Number(result.lastInsertRowid ?? 0), changes: result.rowsAffected ?? 0 };
}

/**
 * Fetch a single row. Returns a plain object or undefined.
 */
export async function dbGet(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  const row = result.rows[0];
  if (!row) return undefined;
  // Convert libSQL Row (array-like + named props) to a plain JS object
  return Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
}

/**
 * Fetch all matching rows. Returns an array of plain objects.
 */
export async function dbAll(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.map(row =>
    Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
  );
}
