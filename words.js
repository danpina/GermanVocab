import { client, newId } from './db.js';

function rowToWord(row) {
  return {
    id: row.id,
    original: row.original,
    translation: row.translation,
    date: row.date,
    createdAt: row.created_at,
    inputLang: row.input_lang,
    outputLang: row.output_lang,
  };
}

export async function getAllWords(userId) {
  const result = await client.execute({
    sql: 'SELECT * FROM words WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });
  return result.rows.map(rowToWord);
}

export async function addWord(userId, { original, translation, date, createdAt, inputLang, outputLang }) {
  const id = newId();
  await client.execute({
    sql: `INSERT INTO words (id, user_id, original, translation, date, created_at, input_lang, output_lang)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, original, translation, date, createdAt, inputLang, outputLang],
  });
  return { id, original, translation, date, createdAt, inputLang, outputLang };
}

export async function deleteWord(userId, id) {
  await client.execute({ sql: 'DELETE FROM word_stats WHERE user_id = ? AND word_id = ?', args: [userId, id] });
  const result = await client.execute({
    sql: 'DELETE FROM words WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  return result.rowsAffected > 0;
}
