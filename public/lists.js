const listsContainer = document.getElementById('lists');
const emptyMessage = document.getElementById('emptyMessage');
const exportAllBtn = document.getElementById('exportAllBtn');
const totalCount = document.getElementById('totalCount');
const bulkInput = document.getElementById('bulkInput');
const bulkAddBtn = document.getElementById('bulkAddBtn');
const bulkError = document.getElementById('bulkError');
const bulkSuccess = document.getElementById('bulkSuccess');

let allWords = [];

async function loadAllWords() {
  const res = await authedFetch('/api/words');
  allWords = await res.json();
  renderLists();
}

function renderLists() {
  listsContainer.innerHTML = '';
  emptyMessage.classList.toggle('hidden', allWords.length > 0);
  totalCount.textContent = allWords.length
    ? `${allWords.length} word${allWords.length === 1 ? '' : 's'} saved in total`
    : '';

  const groups = new Map();
  for (const word of allWords) {
    const key = wordDateKey(word);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }

  const sortedKeys = [...groups.keys()].sort().reverse();

  for (const key of sortedKeys) {
    const words = groups.get(key);

    const details = document.createElement('details');
    details.open = key === todayKey();

    const summary = document.createElement('summary');
    summary.textContent = `${formatDateLabel(key)} — ${words.length} word${words.length === 1 ? '' : 's'}`;
    details.appendChild(summary);

    const dayBody = document.createElement('div');
    dayBody.className = 'day-body';

    const ul = document.createElement('ul');
    ul.className = 'day-word-list';
    for (const word of words) {
      ul.appendChild(createWordListItem(word, loadAllWords));
    }
    dayBody.appendChild(ul);

    const dayActions = document.createElement('div');
    dayActions.className = 'day-actions';

    const dayExportBtn = document.createElement('button');
    dayExportBtn.className = 'day-export-btn';
    dayExportBtn.textContent = 'Export this day as CSV';
    dayExportBtn.addEventListener('click', () => downloadCsv(wordsToCsv(words), `german-vocab-${key}.csv`));

    const dayDeleteBtn = document.createElement('button');
    dayDeleteBtn.className = 'day-export-btn';
    dayDeleteBtn.textContent = 'Delete this day';
    dayDeleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete all ${words.length} word${words.length === 1 ? '' : 's'} from ${formatDateLabel(key)}? This can't be undone.`)) return;
      await authedFetch(`/api/words?date=${encodeURIComponent(key)}`, { method: 'DELETE' });
      await loadAllWords();
    });

    dayActions.append(dayExportBtn, dayDeleteBtn);
    dayBody.appendChild(dayActions);

    details.appendChild(dayBody);
    listsContainer.appendChild(details);
  }
}

exportAllBtn.addEventListener('click', () => {
  downloadCsv(wordsToCsv(allWords), 'german-vocab-all.csv');
});

function parseBulkLines(text) {
  const words = [];
  const invalidLines = [];

  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      invalidLines.push(i + 1);
      return;
    }

    const original = trimmed.slice(0, colonIndex).trim();
    const translation = trimmed.slice(colonIndex + 1).trim();
    if (!original || !translation) {
      invalidLines.push(i + 1);
      return;
    }

    words.push({ original, translation });
  });

  return { words, invalidLines };
}

bulkAddBtn.addEventListener('click', async () => {
  bulkError.classList.add('hidden');
  bulkSuccess.classList.add('hidden');

  const { words, invalidLines } = parseBulkLines(bulkInput.value);
  if (words.length === 0) {
    bulkError.textContent = 'Nothing to add — each line needs "word : translation".';
    bulkError.classList.remove('hidden');
    return;
  }

  bulkAddBtn.disabled = true;
  try {
    const res = await authedFetch('/api/words/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add words');

    let message = `Added ${data.added} word${data.added === 1 ? '' : 's'}.`;
    if (invalidLines.length > 0) {
      message += ` Skipped line${invalidLines.length === 1 ? '' : 's'} ${invalidLines.join(', ')} (missing "word : translation").`;
    }
    bulkSuccess.textContent = message;
    bulkSuccess.classList.remove('hidden');
    bulkInput.value = '';
    await loadAllWords();
  } catch (err) {
    bulkError.textContent = err.message;
    bulkError.classList.remove('hidden');
  } finally {
    bulkAddBtn.disabled = false;
  }
});

renderUserBar('userBar');
loadAllWords();
