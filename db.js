import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const DATA_DIR = path.join(__dirname, 'data');

if (!process.env.TURSO_DATABASE_URL) {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(DATA_DIR, 'words.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function columnExists(table, column) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function init() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      input_lang TEXT NOT NULL DEFAULT 'DE',
      output_lang TEXT NOT NULL DEFAULT 'EN',
      created_at TEXT NOT NULL
    )
  `);

  if (!(await columnExists('users', 'words_per_game'))) {
    await client.execute('ALTER TABLE users ADD COLUMN words_per_game INTEGER NOT NULL DEFAULT 6');
  }

  // Stable Apple user identifier for accounts created via Sign in with Apple.
  // Nullable — most accounts (email/password, admin-created) never set it.
  if (!(await columnExists('users', 'apple_sub'))) {
    await client.execute('ALTER TABLE users ADD COLUMN apple_sub TEXT');
    await client.execute(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub) WHERE apple_sub IS NOT NULL'
    );
  }

  // Kept so the Apple token can be revoked if the account is deleted.
  if (!(await columnExists('users', 'apple_refresh_token'))) {
    await client.execute('ALTER TABLE users ADD COLUMN apple_refresh_token TEXT');
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      original TEXT NOT NULL,
      translation TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  if (!(await columnExists('words', 'user_id'))) {
    await client.execute('ALTER TABLE words ADD COLUMN user_id TEXT');
  }
  // Each word remembers the language pair it was saved under, so switching your
  // own language settings later doesn't change how older saved words are read aloud.
  if (!(await columnExists('words', 'input_lang'))) {
    await client.execute("ALTER TABLE words ADD COLUMN input_lang TEXT NOT NULL DEFAULT 'DE'");
  }
  if (!(await columnExists('words', 'output_lang'))) {
    await client.execute("ALTER TABLE words ADD COLUMN output_lang TEXT NOT NULL DEFAULT 'EN'");
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS word_stats (
      user_id TEXT NOT NULL,
      word_id TEXT NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      incorrect_count INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT,
      PRIMARY KEY (user_id, word_id)
    )
  `);
}

await init();
