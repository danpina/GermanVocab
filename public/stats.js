const statsRows = document.getElementById('statsRows');
const emptyMessage = document.getElementById('emptyMessage');
const totalCount = document.getElementById('totalCount');
const resetBtn = document.getElementById('resetBtn');

async function loadStats() {
  const res = await authedFetch('/api/stats');
  const stats = await res.json();
  renderStats(stats);
}

function renderStats(stats) {
  statsRows.innerHTML = '';
  emptyMessage.classList.toggle('hidden', stats.length > 0);
  totalCount.textContent = stats.length ? `${stats.length} word${stats.length === 1 ? '' : 's'} practiced` : '';

  for (const word of stats) {
    const tr = document.createElement('tr');
    const total = word.correctCount + word.incorrectCount;
    const accuracy = total ? Math.round((word.correctCount / total) * 100) : 0;

    const originalTd = document.createElement('td');
    originalTd.textContent = word.original;

    const translationTd = document.createElement('td');
    translationTd.textContent = word.translation;

    const correctTd = document.createElement('td');
    correctTd.textContent = word.correctCount;

    const incorrectTd = document.createElement('td');
    incorrectTd.textContent = word.incorrectCount;

    const accuracyTd = document.createElement('td');
    accuracyTd.textContent = `${accuracy}%`;

    tr.append(originalTd, translationTd, correctTd, incorrectTd, accuracyTd);
    statsRows.appendChild(tr);
  }
}

resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset all your game stats? This clears your correct/incorrect history for every word (your saved words themselves are not affected).')) return;
  await authedFetch('/api/stats', { method: 'DELETE' });
  await loadStats();
});

renderUserBar('userBar');
loadStats();
