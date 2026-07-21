import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllWords, addWord, deleteWord } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function todayKey() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

app.post('/api/translate', async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });

  if (!process.env.DEEPL_API_KEY) {
    return res.status(500).json({
      error: 'DEEPL_API_KEY is not set. Copy .env.example to .env and add your free DeepL API key.',
    });
  }

  try {
    const params = new URLSearchParams();
    params.set('text', text);
    params.set('source_lang', 'DE');
    params.set('target_lang', 'EN-US');

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

app.get('/api/words', async (req, res) => {
  const words = await getAllWords();
  res.json(words);
});

app.post('/api/words', async (req, res) => {
  const { original, translation } = req.body;
  if (!original || !translation) {
    return res.status(400).json({ error: 'original and translation are required' });
  }

  const entry = await addWord({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    original,
    translation,
    date: todayKey(),
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(entry);
});

app.delete('/api/words/:id', async (req, res) => {
  const deleted = await deleteWord(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`German Vocab Helper running at http://localhost:${PORT}`);
});
