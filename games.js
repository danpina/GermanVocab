import { client } from './db.js';

export const MIN_WORDS_REQUIRED = 4;

function rowToGameWord(row) {
  return {
    id: row.id,
    original: row.original,
    translation: row.translation,
    inputLang: row.input_lang,
    outputLang: row.output_lang,
  };
}

// Weighted sample-without-replacement: words the user gets wrong more often show up
// more often (weight climbs toward 4). Never-seen words get their own boost (2.5) so
// fresh vocab surfaces before it's mastered; words with a strong correct streak settle
// back down to the baseline (1).
function weightOf(correctCount, incorrectCount) {
  const total = correctCount + incorrectCount;
  if (total === 0) return 2.5;
  return 1 + (3 * incorrectCount) / (total + 1);
}

function weightedSample(items, weights, count) {
  const pool = items.map((item, i) => ({ item, weight: weights[i] }));
  const picked = [];
  const n = Math.min(count, pool.length);

  for (let i = 0; i < n; i++) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return picked;
}

export async function getGameWords(userId, count = 6) {
  const result = await client.execute({
    sql: `
      SELECT w.*, COALESCE(s.correct_count, 0) AS correct_count, COALESCE(s.incorrect_count, 0) AS incorrect_count
      FROM words w
      LEFT JOIN word_stats s ON s.word_id = w.id AND s.user_id = w.user_id
      WHERE w.user_id = ?
    `,
    args: [userId],
  });

  const available = result.rows.length;
  if (available < MIN_WORDS_REQUIRED) {
    return { words: [], available, minRequired: MIN_WORDS_REQUIRED };
  }

  const words = result.rows.map(rowToGameWord);
  const weights = result.rows.map((row) => weightOf(row.correct_count, row.incorrect_count));
  const picked = weightedSample(words, weights, count);

  return { words: picked, available, minRequired: MIN_WORDS_REQUIRED };
}

/// Returns false (and records nothing) if the word isn't one of this user's own.
export async function recordGameResult(userId, wordId, correct) {
  const owned = await client.execute({
    sql: 'SELECT 1 FROM words WHERE id = ? AND user_id = ?',
    args: [wordId, userId],
  });
  if (owned.rows.length === 0) return false;

  const now = new Date().toISOString();
  await client.execute({
    sql: `
      INSERT INTO word_stats (user_id, word_id, correct_count, incorrect_count, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        correct_count = correct_count + excluded.correct_count,
        incorrect_count = incorrect_count + excluded.incorrect_count,
        last_seen_at = excluded.last_seen_at
    `,
    args: [userId, wordId, correct ? 1 : 0, correct ? 0 : 1, now],
  });
  return true;
}
