const listsContainer = document.getElementById('lists');
const emptyMessage = document.getElementById('emptyMessage');
const exportAllBtn = document.getElementById('exportAllBtn');
const totalCount = document.getElementById('totalCount');

let allWords = [];

async function loadAllWords() {
  const res = await fetch('/api/words');
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

    const dayExportBtn = document.createElement('button');
    dayExportBtn.className = 'day-export-btn';
    dayExportBtn.textContent = 'Export this day as CSV';
    dayExportBtn.addEventListener('click', () => downloadCsv(wordsToCsv(words), `german-vocab-${key}.csv`));
    dayBody.appendChild(dayExportBtn);

    details.appendChild(dayBody);
    listsContainer.appendChild(details);
  }
}

exportAllBtn.addEventListener('click', () => {
  downloadCsv(wordsToCsv(allWords), 'german-vocab-all.csv');
});

loadAllWords();
