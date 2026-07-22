import { client } from './db.js';

export async function getWordStats(userId) {
  const result = await client.execute({
    sql: `
      SELECT w.id, w.original, w.translation, w.input_lang, w.output_lang,
             s.correct_count, s.incorrect_count, s.last_seen_at
      FROM word_stats s
      JOIN words w ON w.id = s.word_id
      WHERE s.user_id = ?
    `,
    args: [userId],
  });

  return result.rows
    .map((row) => ({
      id: row.id,
      original: row.original,
      translation: row.translation,
      inputLang: row.input_lang,
      outputLang: row.output_lang,
      correctCount: row.correct_count,
      incorrectCount: row.incorrect_count,
      lastSeenAt: row.last_seen_at,
    }))
    .sort((a, b) => {
      const aTotal = a.correctCount + a.incorrectCount;
      const bTotal = b.correctCount + b.incorrectCount;
      const aRate = a.incorrectCount / aTotal;
      const bRate = b.incorrectCount / bTotal;
      return bRate - aRate || b.incorrectCount - a.incorrectCount;
    });
}

export async function resetWordStats(userId) {
  await client.execute({ sql: 'DELETE FROM word_stats WHERE user_id = ?', args: [userId] });
}
