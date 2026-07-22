const input = document.getElementById('input');
const micBtn = document.getElementById('micBtn');
const speakBtn = document.getElementById('speakBtn');
const translateBtn = document.getElementById('translateBtn');
const result = document.getElementById('result');
const translationText = document.getElementById('translationText');
const speakTranslationBtn = document.getElementById('speakTranslationBtn');
const saveBtn = document.getElementById('saveBtn');
const errorEl = document.getElementById('error');
const wordList = document.getElementById('wordList');
const emptyMessage = document.getElementById('emptyMessage');
const exportBtn = document.getElementById('exportBtn');

let currentTranslation = '';
let inputLocale = 'de-DE';
let outputLocale = 'en-US';

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearError() {
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

speakBtn.addEventListener('click', () => speak(input.value.trim(), inputLocale));
speakTranslationBtn.addEventListener('click', () => speak(currentTranslation, outputLocale));

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (!SpeechRecognition) {
  micBtn.disabled = true;
  micBtn.title = 'Voice input is not supported in this browser';
}

function startListening() {
  // A fresh instance per session avoids some mobile browsers getting stuck
  // in "listening" forever when a recognizer is restarted.
  recognition = new SpeechRecognition();
  recognition.lang = inputLocale;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.addEventListener('result', (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript;
  });

  recognition.addEventListener('error', (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    showError(`Voice input failed: ${event.error}`);
  });

  recognition.addEventListener('end', () => {
    listening = false;
    micBtn.textContent = '🎤 Dictate';
    micBtn.classList.remove('listening');
  });

  clearError();
  recognition.start();
  listening = true;
  micBtn.textContent = '⏹ Stop listening';
  micBtn.classList.add('listening');
}

micBtn.addEventListener('click', () => {
  if (!SpeechRecognition) return;
  if (listening) {
    recognition.stop();
  } else {
    startListening();
  }
});

translateBtn.addEventListener('click', async () => {
  const text = input.value.trim();
  clearError();
  if (!text) {
    showError('Type a word or sentence first.');
    return;
  }

  translateBtn.disabled = true;
  translateBtn.textContent = 'Translating…';
  try {
    const res = await authedFetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Translation failed');

    currentTranslation = data.translation;
    translationText.textContent = data.translation;
    result.classList.remove('hidden');
  } catch (err) {
    showError(err.message);
    result.classList.add('hidden');
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = 'Translate';
  }
});

saveBtn.addEventListener('click', async () => {
  const original = input.value.trim();
  if (!original || !currentTranslation) return;

  try {
    const res = await authedFetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original, translation: currentTranslation }),
    });
    if (!res.ok) throw new Error('Could not save entry');

    input.value = '';
    result.classList.add('hidden');
    currentTranslation = '';
    await loadWords();
  } catch (err) {
    showError(err.message);
  }
});

function renderWords(words) {
  wordList.innerHTML = '';
  emptyMessage.classList.toggle('hidden', words.length > 0);
  for (const word of words) {
    wordList.appendChild(createWordListItem(word, loadWords));
  }
}

async function loadWords() {
  const res = await authedFetch('/api/words');
  const words = await res.json();
  const todaysWords = words.filter((w) => wordDateKey(w) === todayKey());
  renderWords(todaysWords);
  return todaysWords;
}

exportBtn.addEventListener('click', async () => {
  const words = await loadWords();
  downloadCsv(wordsToCsv(words), `german-vocab-${todayKey()}.csv`);
});

async function init() {
  const user = await renderUserBar('userBar');
  if (user) {
    inputLocale = getLanguage(user.inputLang).speechLocale;
    outputLocale = getLanguage(user.outputLang).speechLocale;
  }
  await loadWords();
}

init();
