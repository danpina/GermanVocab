async function authedFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/login.html';
    return new Promise(() => {}); // navigating away; halt the caller
  }
  return res;
}

async function renderUserBar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const res = await authedFetch('/api/me');
  const user = await res.json();

  container.innerHTML = '';
  const emailSpan = document.createElement('span');
  emailSpan.className = 'muted';
  emailSpan.textContent = user.email;

  const logoutLink = document.createElement('a');
  logoutLink.href = '#';
  logoutLink.textContent = 'Logout';
  logoutLink.addEventListener('click', async (event) => {
    event.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  container.append(emailSpan, logoutLink);
  return user;
}

function speak(text, lang) {
  if (!text) return;
  if (!('speechSynthesis' in window)) {
    alert('Your browser does not support text-to-speech.');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function dateKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey() {
  return dateKey(new Date());
}

// Older entries saved before per-word dates existed fall back to their createdAt timestamp.
function wordDateKey(word) {
  return word.date || word.createdAt.slice(0, 10);
}

function formatDateLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function createWordListItem(word, onDeleted) {
  const li = document.createElement('li');

  const textDiv = document.createElement('div');
  textDiv.className = 'entry-text';
  const original = document.createElement('p');
  original.className = 'original';
  original.textContent = word.original;
  const translation = document.createElement('p');
  translation.className = 'translation';
  translation.textContent = word.translation;
  textDiv.append(original, translation);

  const actions = document.createElement('div');
  actions.className = 'entry-actions';

  const speakBtn = document.createElement('button');
  speakBtn.textContent = '🔊';
  speakBtn.title = 'Read aloud';
  speakBtn.addEventListener('click', () => speak(word.original, 'de-DE'));

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '🗑';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    await authedFetch(`/api/words/${word.id}`, { method: 'DELETE' });
    onDeleted();
  });

  actions.append(speakBtn, deleteBtn);
  li.append(textDiv, actions);
  return li;
}

function wordsToCsv(words) {
  const rows = [['German', 'English', 'Saved at'], ...words.map((w) => [w.original, w.translation, w.createdAt])];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
