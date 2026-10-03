const settingsForm = document.getElementById('settingsForm');
const inputLangSelect = document.getElementById('inputLang');
const outputLangSelect = document.getElementById('outputLang');
const wordsPerGameInput = document.getElementById('wordsPerGame');
const saveBtn = document.getElementById('saveBtn');
const errorEl = document.getElementById('error');
const savedEl = document.getElementById('saved');

function populateSelect(select) {
  for (const lang of LANGUAGES) {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.label;
    select.appendChild(option);
  }
}

populateSelect(inputLangSelect);
populateSelect(outputLangSelect);

async function loadCurrentSettings() {
  const user = await renderUserBar('userBar');
  if (!user) return;
  inputLangSelect.value = user.inputLang;
  outputLangSelect.value = user.outputLang;
  wordsPerGameInput.value = user.wordsPerGame;
}

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');
  savedEl.classList.add('hidden');

  saveBtn.disabled = true;
  try {
    const res = await authedFetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputLang: inputLangSelect.value,
        outputLang: outputLangSelect.value,
        wordsPerGame: parseInt(wordsPerGameInput.value, 10),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save settings');
    savedEl.classList.remove('hidden');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
  }
});

loadCurrentSettings();

const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const deleteErrorEl = document.getElementById('deleteError');

deleteAccountBtn.addEventListener('click', async () => {
  if (!confirm("Permanently delete your account, saved words, and stats? This can't be undone.")) return;

  deleteErrorEl.classList.add('hidden');
  deleteAccountBtn.disabled = true;
  try {
    const res = await authedFetch('/api/me', { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Could not delete account');
    }
    window.location.href = '/login.html';
  } catch (err) {
    deleteErrorEl.textContent = err.message;
    deleteErrorEl.classList.remove('hidden');
  } finally {
    deleteAccountBtn.disabled = false;
  }
});
