import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  verifyPassword,
  setAuthCookie,
  clearAuthCookie,
  requireAuthApi,
  requireAuthPage,
} from './auth.js';
import { getUserByEmail, updateUser } from './users.js';
import { getAllWords, addWord, deleteWord } from './words.js';
import { LANGUAGES, getLanguage } from './languages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT || 3000;

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function sendPage(res, file) {
  res.sendFile(path.join(__dirname, 'public', file));
}

// --- Public pages ---
app.get('/login.html', (req, res) => sendPage(res, 'login.html'));

// --- Gated pages ---
app.get('/', requireAuthPage, (req, res) => sendPage(res, 'index.html'));
app.get('/index.html', requireAuthPage, (req, res) => sendPage(res, 'index.html'));
app.get('/lists.html', requireAuthPage, (req, res) => sendPage(res, 'lists.html'));
app.get('/settings.html', requireAuthPage, (req, res) => sendPage(res, 'settings.html'));

// --- Auth API ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await getUserByEmail(email);
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

app.get('/api/me', requireAuthApi, (req, res) => {
  res.json({
    email: req.user.email,
    isAdmin: req.user.isAdmin,
    inputLang: req.user.inputLang,
    outputLang: req.user.outputLang,
  });
});

app.patch('/api/me', requireAuthApi, async (req, res) => {
  const { inputLang, outputLang } = req.body;
  const validCodes = LANGUAGES.map((l) => l.code);
  if (inputLang && !validCodes.includes(inputLang)) {
    return res.status(400).json({ error: `Unknown language code: ${inputLang}` });
  }
  if (outputLang && !validCodes.includes(outputLang)) {
    return res.status(400).json({ error: `Unknown language code: ${outputLang}` });
  }

  const updated = await updateUser(req.user.id, { inputLang, outputLang });
  res.json({
    email: updated.email,
    isAdmin: updated.isAdmin,
    inputLang: updated.inputLang,
    outputLang: updated.outputLang,
  });
});

// --- Translate ---
app.post('/api/translate', requireAuthApi, async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

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
  const { original, translation } = req.body;
  if (!original || !translation) {
    return res.status(400).json({ error: 'original and translation are required' });
  }

  const entry = await addWord(req.user.id, {
    original,
    translation,
    date: todayKey(),
    createdAt: new Date().toISOString(),
    inputLang: req.user.inputLang,
    outputLang: req.user.outputLang,
  });
  res.status(201).json(entry);
});

app.delete('/api/words/:id', requireAuthApi, async (req, res) => {
  const deleted = await deleteWord(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`German Vocab Helper running at http://localhost:${PORT}`);
});
