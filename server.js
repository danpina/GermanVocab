import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  hashPassword,
  verifyPassword,
  setAuthCookie,
  clearAuthCookie,
  requireAuthApi,
  requireAuthPage,
  requireAdminApi,
  requireAdminPage,
} from './auth.js';
import { getUserByEmail, getUserByAppleSub, getAllUsers, createUser, updateUser, deleteUser } from './users.js';
import { getAllWords, addWord, addWords, updateWord, deleteWord, deleteWordsByDate } from './words.js';
import { LANGUAGES, getLanguage } from './languages.js';
import { getGameWords, recordGameResult } from './games.js';
import { getWordStats, resetWordStats } from './stats.js';
import {
  verifyAppleIdentityToken,
  isAppleRevocationConfigured,
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
} from './appleAuth.js';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT || 3000;
const WORDS_PER_GAME_MIN = 3;
const WORDS_PER_GAME_MAX = 20;

// Input limits: this API is open to anyone who can sign up, so every field is bounded.
const MAX_EMAIL = 254;
const MAX_PASSWORD = 200;
const MIN_PASSWORD = 8;
const MAX_TRANSLATE_CHARS = 2000;
const MAX_WORD_CHARS = 500;
const MAX_BULK_WORDS = 200;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// --- Async safety -------------------------------------------------------------
// Express 4 doesn't catch errors thrown inside async handlers: without this, a single
// bad request or database hiccup becomes an unhandled rejection and takes the whole
// server down. Wrap every handler so errors reach the error middleware at the bottom.
function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
for (const method of ['get', 'post', 'patch', 'delete']) {
  const original = app[method].bind(app);
  app[method] = (route, ...handlers) =>
    handlers.length === 0 ? original(route) : original(route, ...handlers.map((h) => (typeof h === 'function' ? wrapAsync(h) : h)));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// --- Security headers ---------------------------------------------------------
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
});

app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// --- Rate limiting (in memory; fine for a single small instance) ---------------
function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many requests. Please try again later.' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

const MINUTE = 60 * 1000;
const apiLimiter = rateLimit({ windowMs: 5 * MINUTE, max: 600 });
const loginLimiter = rateLimit({ windowMs: 15 * MINUTE, max: 30, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' });
const registerLimiter = rateLimit({ windowMs: 60 * MINUTE, max: 10, message: 'Too many accounts created from this network. Please try again later.' });
const translateLimiter = rateLimit({ windowMs: 60 * MINUTE, max: 150, key: (req) => req.user.id, message: 'Translation limit reached for now. Please try again in a while.' });

// --- Small helpers ------------------------------------------------------------
const isString = (value) => typeof value === 'string';
const isTextWithin = (value, max) => isString(value) && value.trim().length > 0 && value.length <= max;
const normalizeEmail = (value) => value.trim().toLowerCase();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The apps send their own local calendar date, so a word saved at 00:30 in Berlin lands
// on the right day even though the server clock (UTC) is still on the previous one.
// Falls back to the server's date for older app versions or anything implausible.
function resolveClientDate(value) {
  if (isString(value) && DATE_PATTERN.test(value)) {
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isNaN(time) && new Date(time).toISOString().startsWith(value) && Math.abs(time - Date.now()) < 3 * 24 * 60 * 60 * 1000) {
      return value;
    }
  }
  return todayKey();
}

const validLanguageCodes = LANGUAGES.map((l) => l.code);

function sendPage(res, file) {
  res.sendFile(path.join(__dirname, 'public', file));
}

// --- Gated pages ----------------------------------------------------------------
// These must run before express.static — static would otherwise serve these exact
// files directly and skip the auth check. The request path is decoded and normalized
// first, so encoded or doubled-slash variants (/%61dmin.html, //admin.html) can't slip
// past the check and reach static.
const GATED_PAGES = {
  '/': ['index.html', requireAuthPage],
  '/index.html': ['index.html', requireAuthPage],
  '/lists.html': ['lists.html', requireAuthPage],
  '/settings.html': ['settings.html', requireAuthPage],
  '/games.html': ['games.html', requireAuthPage],
  '/stats.html': ['stats.html', requireAuthPage],
  '/admin.html': ['admin.html', requireAdminPage],
};

app.use((req, res, next) => {
  let decoded;
  try {
    decoded = decodeURIComponent(req.path);
  } catch {
    return res.status(400).end();
  }
  const normalized = path.posix.normalize(decoded).toLowerCase().replace(/\/+$/, '') || '/';
  const entry = GATED_PAGES[normalized];
  if (!entry) return next();

  const [file, guard] = entry;
  Promise.resolve(guard(req, res, () => sendPage(res, file))).catch(next);
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// --- Auth API ---------------------------------------------------------------------
app.use('/api', apiLimiter);

app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!isString(email) || !isString(password) || !email.trim() || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (email.length > MAX_EMAIL || password.length > MAX_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect email/ID or password' });
  }

  const user = await getUserByEmail(email.trim());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Incorrect email/ID or password' });
  }

  setAuthCookie(req, res, user.id);
  res.json({ email: user.email, isAdmin: user.isAdmin });
});

app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

app.post('/api/register', registerLimiter, async (req, res) => {
  const { email: rawEmail, password } = req.body;
  if (!isString(rawEmail) || !isString(password) || !rawEmail.trim() || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const email = normalizeEmail(rawEmail);
  if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  }
  if (password.length > MAX_PASSWORD) {
    return res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD} characters` });
  }

  const existing = await getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = await createUser({ email, passwordHash: await hashPassword(password) });
  setAuthCookie(req, res, user.id);
  res.status(201).json({ email: user.email, isAdmin: user.isAdmin });
});

app.post('/api/auth/apple', loginLimiter, async (req, res) => {
  const { identityToken, authorizationCode } = req.body;
  if (!isString(identityToken) || !identityToken) return res.status(400).json({ error: 'identityToken is required' });

  let claims;
  try {
    claims = await verifyAppleIdentityToken(identityToken);
  } catch (err) {
    return res.status(401).json({ error: `Invalid Apple credential: ${err.message}` });
  }

  const appleSub = claims.sub;
  let user = await getUserByAppleSub(appleSub);

  if (!user) {
    // Only the email inside Apple's signed token is trusted. A client-supplied email can
    // be forged, and since sign-up here doesn't verify email ownership, an existing
    // password account is only linked when Apple vouches for the address.
    const appleEmail = isString(claims.email) ? normalizeEmail(claims.email) : null;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    const existingByEmail = appleEmail ? await getUserByEmail(appleEmail) : null;

    if (existingByEmail && emailVerified && !existingByEmail.appleSub) {
      // The old password may have been set by someone who never owned this address
      // (nothing verified it at sign-up), so it's replaced with an unusable one.
      user = await updateUser(existingByEmail.id, {
        appleSub,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
      });
    } else {
      user = await createUser({
        email: appleEmail && !existingByEmail ? appleEmail : `apple-${appleSub}@users.invalid`,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
        appleSub,
      });
    }
  }

  // Keep Apple's refresh token so it can be revoked if this account is deleted.
  // Best effort: a failure here must never block signing in.
  if (isString(authorizationCode) && authorizationCode && isAppleRevocationConfigured()) {
    try {
      const appleRefreshToken = await exchangeAppleAuthorizationCode(authorizationCode);
      if (appleRefreshToken) await updateUser(user.id, { appleRefreshToken });
    } catch (err) {
      console.error('Could not store Apple refresh token:', err.message);
    }
  }

  setAuthCookie(req, res, user.id);
  res.json({ email: user.email, isAdmin: user.isAdmin });
});

app.get('/api/me', requireAuthApi, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    isAdmin: req.user.isAdmin,
    inputLang: req.user.inputLang,
    outputLang: req.user.outputLang,
    wordsPerGame: req.user.wordsPerGame,
  });
});

app.patch('/api/me', requireAuthApi, async (req, res) => {
  const { inputLang, outputLang, wordsPerGame } = req.body;

  if (inputLang !== undefined && !validLanguageCodes.includes(inputLang)) {
    return res.status(400).json({ error: `Unknown language code: ${inputLang}` });
  }
  if (outputLang !== undefined && !validLanguageCodes.includes(outputLang)) {
    return res.status(400).json({ error: `Unknown language code: ${outputLang}` });
  }
  if (
    wordsPerGame !== undefined &&
    (!Number.isInteger(wordsPerGame) || wordsPerGame < WORDS_PER_GAME_MIN || wordsPerGame > WORDS_PER_GAME_MAX)
  ) {
    return res.status(400).json({ error: `wordsPerGame must be a whole number between ${WORDS_PER_GAME_MIN} and ${WORDS_PER_GAME_MAX}` });
  }
  if ((inputLang ?? req.user.inputLang) === (outputLang ?? req.user.outputLang)) {
    return res.status(400).json({ error: "Pick two different languages: the one you're learning and the one to translate into." });
  }

  const updated = await updateUser(req.user.id, { inputLang, outputLang, wordsPerGame });
  res.json({
    email: updated.email,
    isAdmin: updated.isAdmin,
    inputLang: updated.inputLang,
    outputLang: updated.outputLang,
    wordsPerGame: updated.wordsPerGame,
  });
});

// Self-service account deletion (required by App Store guideline 5.1.1(v) for apps
// that let users create accounts). Removes the user's words and stats too.
app.delete('/api/me', requireAuthApi, async (req, res) => {
  if (req.user.isAdmin) {
    const admins = (await getAllUsers()).filter((u) => u.isAdmin);
    if (admins.length <= 1) {
      return res.status(400).json({
        error: "You're the only admin, so this account can't be deleted. Make another account an admin first.",
      });
    }
  }

  if (req.user.appleRefreshToken && isAppleRevocationConfigured()) {
    try {
      await revokeAppleRefreshToken(req.user.appleRefreshToken);
    } catch (err) {
      console.error('Could not revoke Apple token:', err.message);
    }
  }

  await deleteUser(req.user.id);
  clearAuthCookie(res);
  res.status(204).end();
});

// --- Translate ---
app.post('/api/translate', requireAuthApi, translateLimiter, async (req, res) => {
  if (!isString(req.body.text) || !req.body.text.trim()) return res.status(400).json({ error: 'text is required' });
  const text = req.body.text.trim();
  if (text.length > MAX_TRANSLATE_CHARS) {
    return res.status(400).json({ error: `That's too long to translate at once (max ${MAX_TRANSLATE_CHARS} characters).` });
  }

  if (req.user.inputLang === req.user.outputLang) {
    return res.status(400).json({ error: 'Your learning language and translation language are the same. Change one in Settings.' });
  }

  if (!process.env.DEEPL_API_KEY) {
    return res.status(500).json({
      error: 'DEEPL_API_KEY is not set. Copy .env.example to .env and add your free DeepL API key.',
    });
  }

  try {
    const source = getLanguage(req.user.inputLang);
    const target = getLanguage(req.user.outputLang);

    const params = new URLSearchParams();
    params.set('text', text);
    params.set('source_lang', source.deeplSource);
    params.set('target_lang', target.deeplTarget);

    const response = await fetch(process.env.DEEPL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `DeepL error (${response.status}): ${errText}` });
    }

    const data = await response.json();
    const translation = data.translations?.[0]?.text || '';
    res.json({ translation });
  } catch (err) {
    res.status(500).json({ error: `Translation request failed: ${err.message}` });
  }
});

// --- Words (per user) ---
app.get('/api/words', requireAuthApi, async (req, res) => {
  const words = await getAllWords(req.user.id);
  res.json(words);
});

app.post('/api/words', requireAuthApi, async (req, res) => {
  const { original, translation, date } = req.body;
  if (!isTextWithin(original, MAX_WORD_CHARS) || !isTextWithin(translation, MAX_WORD_CHARS)) {
    return res.status(400).json({ error: `original and translation are required (max ${MAX_WORD_CHARS} characters each)` });
  }

  const entry = await addWord(req.user.id, {
    original: original.trim(),
    translation: translation.trim(),
    date: resolveClientDate(date),
    createdAt: new Date().toISOString(),
    inputLang: req.user.inputLang,
    outputLang: req.user.outputLang,
  });
  res.status(201).json(entry);
});

app.post('/api/words/bulk', requireAuthApi, async (req, res) => {
  const { words, date } = req.body;
  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({ error: 'words array is required' });
  }
  if (words.length > MAX_BULK_WORDS) {
    return res.status(400).json({ error: `Add at most ${MAX_BULK_WORDS} words at a time.` });
  }

  const day = resolveClientDate(date);
  const createdAt = new Date().toISOString();
  const entries = words
    .filter((w) => w && isTextWithin(w.original, MAX_WORD_CHARS) && isTextWithin(w.translation, MAX_WORD_CHARS))
    .map((w) => ({
      original: w.original.trim(),
      translation: w.translation.trim(),
      date: day,
      createdAt,
      inputLang: req.user.inputLang,
      outputLang: req.user.outputLang,
    }));

  const created = await addWords(req.user.id, entries);
  res.status(201).json({ added: created.length, skipped: words.length - entries.length });
});

app.patch('/api/words/:id', requireAuthApi, async (req, res) => {
  const { original, translation } = req.body;
  if (original !== undefined && !isTextWithin(original, MAX_WORD_CHARS)) {
    return res.status(400).json({ error: `original can't be empty (max ${MAX_WORD_CHARS} characters)` });
  }
  if (translation !== undefined && !isTextWithin(translation, MAX_WORD_CHARS)) {
    return res.status(400).json({ error: `translation can't be empty (max ${MAX_WORD_CHARS} characters)` });
  }

  const updated = await updateWord(req.user.id, req.params.id, {
    original: original?.trim(),
    translation: translation?.trim(),
  });
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

app.delete('/api/words', requireAuthApi, async (req, res) => {
  const { date } = req.query;
  if (!isString(date) || !DATE_PATTERN.test(date)) {
    return res.status(400).json({ error: 'date query parameter (YYYY-MM-DD) is required' });
  }
  const count = await deleteWordsByDate(req.user.id, date);
  res.json({ deleted: count });
});

app.delete('/api/words/:id', requireAuthApi, async (req, res) => {
  const deleted = await deleteWord(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// --- Games ---
app.get('/api/game/words', requireAuthApi, async (req, res) => {
  const requested = parseInt(req.query.count, 10) || req.user.wordsPerGame;
  const count = Math.min(Math.max(requested, WORDS_PER_GAME_MIN), WORDS_PER_GAME_MAX);
  const result = await getGameWords(req.user.id, count);
  res.json(result);
});

app.post('/api/game/result', requireAuthApi, async (req, res) => {
  const { wordId, correct } = req.body;
  if (!isString(wordId) || !wordId || typeof correct !== 'boolean') {
    return res.status(400).json({ error: 'wordId and correct (boolean) are required' });
  }
  const recorded = await recordGameResult(req.user.id, wordId, correct);
  if (!recorded) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// --- Stats ---
app.get('/api/stats', requireAuthApi, async (req, res) => {
  const stats = await getWordStats(req.user.id);
  res.json(stats);
});

app.delete('/api/stats', requireAuthApi, async (req, res) => {
  await resetWordStats(req.user.id);
  res.status(204).end();
});

// --- Admin ---
function toAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
    inputLang: user.inputLang,
    outputLang: user.outputLang,
    createdAt: user.createdAt,
  };
}

app.get('/api/admin/users', requireAdminApi, async (req, res) => {
  const users = await getAllUsers();
  res.json(users.map(toAdminUser));
});

app.post('/api/admin/users', requireAdminApi, async (req, res) => {
  const { email, password, isAdmin } = req.body;
  if (!isTextWithin(email, MAX_EMAIL) || !isString(password) || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return res.status(400).json({ error: `email and a password of ${MIN_PASSWORD}-${MAX_PASSWORD} characters are required` });
  }

  const existing = await getUserByEmail(email.trim());
  if (existing) return res.status(409).json({ error: 'A user with that email/ID already exists' });

  const user = await createUser({ email: email.trim(), passwordHash: await hashPassword(password), isAdmin: isAdmin === true });
  res.status(201).json(toAdminUser(user));
});

app.patch('/api/admin/users/:id', requireAdminApi, async (req, res) => {
  const { email, password, isAdmin, inputLang, outputLang } = req.body;

  if (email !== undefined && !isTextWithin(email, MAX_EMAIL)) {
    return res.status(400).json({ error: 'email can\'t be empty' });
  }
  if (password !== undefined && password !== '' && (!isString(password) || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)) {
    return res.status(400).json({ error: `Password must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters` });
  }
  if (inputLang !== undefined && !validLanguageCodes.includes(inputLang)) {
    return res.status(400).json({ error: `Unknown language code: ${inputLang}` });
  }
  if (outputLang !== undefined && !validLanguageCodes.includes(outputLang)) {
    return res.status(400).json({ error: `Unknown language code: ${outputLang}` });
  }
  if (isAdmin !== undefined && typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'isAdmin must be true or false' });
  }

  if (email !== undefined) {
    const clash = await getUserByEmail(email.trim());
    if (clash && clash.id !== req.params.id) {
      return res.status(409).json({ error: 'A user with that email/ID already exists' });
    }
  }
  if (isAdmin === false) {
    const admins = (await getAllUsers()).filter((u) => u.isAdmin);
    if (admins.length <= 1 && admins[0]?.id === req.params.id) {
      return res.status(400).json({ error: "That's the only admin, so it can't lose admin access." });
    }
  }

  const fields = { email: email?.trim(), isAdmin, inputLang, outputLang };
  if (password) fields.passwordHash = await hashPassword(password);

  const updated = await updateUser(req.params.id, fields);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(toAdminUser(updated));
});

app.delete('/api/admin/users/:id', requireAdminApi, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You can't delete your own account while logged in as it" });
  }
  const deleted = await deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// --- Fallbacks ----------------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Last stop for anything thrown or rejected inside a handler (see wrapAsync above).
// Always answers with JSON so the apps can show a message instead of hanging.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in the request body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large' });

  console.error(`${req.method} ${req.path} failed:`, err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Linguanest running at http://localhost:${PORT}`);
});
