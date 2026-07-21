import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const DATA_DIR = path.join(__dirname, 'data');
const LEGACY_FILE = path.join(DATA_DIR, 'words.json');

if (!process.env.TURSO_DATABASE_URL) {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(DATA_DIR, 'words.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function init() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      original TEXT NOT NULL,
      translation TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await migrateLegacyFile();
}

// One-time import of words saved back when this app stored everything in data/words.json.
// Safe to run on every startup: INSERT OR IGNORE skips rows already migrated.
async function migrateLegacyFile() {
  let legacyWords;
  try {
    const raw = await fs.readFile(LEGACY_FILE, 'utf-8');
    legacyWords = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  for (const w of legacyWords) {
    const date = w.date || w.createdAt.slice(0, 10);
    await client.execute({
      sql: 'INSERT OR IGNORE INTO words (id, original, translation, date, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [w.id, w.original, w.translation, date, w.createdAt],
    });
  }
}

function rowToWord(row) {
  return {
    id: row.id,
    original: row.original,
    translation: row.translation,
    date: row.date,
    createdAt: row.created_at,
  };
}

export async function getAllWords() {
  const result = await client.execute('SELECT * FROM words ORDER BY created_at DESC');
  return result.rows.map(rowToWord);
}

export async function addWord({ id, original, translation, date, createdAt }) {
  await client.execute({
    sql: 'INSERT INTO words (id, original, translation, date, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, original, translation, date, createdAt],
  });
  return { id, original, translation, date, createdAt };
}

export async function deleteWord(id) {
  const result = await client.execute({ sql: 'DELETE FROM words WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}

await init();
