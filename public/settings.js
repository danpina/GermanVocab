const settingsForm = document.getElementById('settingsForm');
const inputLangSelect = document.getElementById('inputLang');
const outputLangSelect = document.getElementById('outputLang');
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
