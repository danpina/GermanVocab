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

export async function addWords(userId, entries) {
  const created = [];
  for (const entry of entries) {
    created.push(await addWord(userId, entry));
  }
  return created;
}

export async function updateWord(userId, id, { original, translation }) {
  const sets = [];
  const args = [];
  if (original !== undefined) {
    sets.push('original = ?');
    args.push(original);
  }
  if (translation !== undefined) {
    sets.push('translation = ?');
    args.push(translation);
  }
  if (sets.length === 0) return null;

  args.push(id, userId);
  const result = await client.execute({
    sql: `UPDATE words SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });
  if (result.rowsAffected === 0) return null;

  const row = await client.execute({ sql: 'SELECT * FROM words WHERE id = ?', args: [id] });
  return row.rows[0] ? rowToWord(row.rows[0]) : null;
}

export async function deleteWord(userId, id) {
  await client.execute({ sql: 'DELETE FROM word_stats WHERE user_id = ? AND word_id = ?', args: [userId, id] });
  const result = await client.execute({
    sql: 'DELETE FROM words WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  return result.rowsAffected > 0;
}

export async function deleteWordsByDate(userId, date) {
  await client.execute({
    sql: `DELETE FROM word_stats WHERE user_id = ? AND word_id IN
          (SELECT id FROM words WHERE user_id = ? AND date = ?)`,
    args: [userId, userId, date],
  });
  const result = await client.execute({
    sql: 'DELETE FROM words WHERE user_id = ? AND date = ?',
    args: [userId, date],
  });
  return result.rowsAffected;
}
