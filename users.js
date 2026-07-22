import { client, newId } from './db.js';

function rowToUser(row) {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    isAdmin: !!row.is_admin,
    inputLang: row.input_lang,
    outputLang: row.output_lang,
    createdAt: row.created_at,
  };
}

export async function getUserByEmail(email) {
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email],
  });
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function getUserById(id) {
  const result = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function getAllUsers() {
  const result = await client.execute('SELECT * FROM users ORDER BY created_at ASC');
  return result.rows.map(rowToUser);
}

export async function createUser({ email, passwordHash, isAdmin = false, inputLang = 'DE', outputLang = 'EN' }) {
  const id = newId();
  const createdAt = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO users (id, email, password_hash, is_admin, input_lang, output_lang, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, email, passwordHash, isAdmin ? 1 : 0, inputLang, outputLang, createdAt],
  });
  return getUserById(id);
}

export async function updateUser(id, fields) {
  const columns = {
    email: 'email',
    passwordHash: 'password_hash',
    isAdmin: 'is_admin',
    inputLang: 'input_lang',
    outputLang: 'output_lang',
  };

  const sets = [];
  const args = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = ?`);
    args.push(key === 'isAdmin' ? (fields[key] ? 1 : 0) : fields[key]);
  }
  if (sets.length === 0) return getUserById(id);

  args.push(id);
  await client.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args });
  return getUserById(id);
}

export async function deleteUser(id) {
  await client.execute({ sql: 'DELETE FROM word_stats WHERE user_id = ?', args: [id] });
  await client.execute({ sql: 'DELETE FROM words WHERE user_id = ?', args: [id] });
  const result = await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}
