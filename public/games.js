const modeSelect = document.getElementById('modeSelect');
const difficultyRow = document.getElementById('difficultyRow');
const startBtn = document.getElementById('startBtn');
const notEnoughWords = document.getElementById('notEnoughWords');

const gameScreen = document.getElementById('gameScreen');
const roundLabel = document.getElementById('roundLabel');
const scoreLabel = document.getElementById('scoreLabel');
const promptEl = document.getElementById('prompt');
const hintEl = document.getElementById('hint');
const choicesArea = document.getElementById('choicesArea');
const typeArea = document.getElementById('typeArea');
const typeInput = document.getElementById('typeInput');
const submitTypeBtn = document.getElementById('submitTypeBtn');
const feedbackEl = document.getElementById('feedback');
const nextBtn = document.getElementById('nextBtn');

const resultsScreen = document.getElementById('resultsScreen');
const finalScore = document.getElementById('finalScore');
const missedList = document.getElementById('missedList');
const playAgainBtn = document.getElementById('playAgainBtn');
const changeModeBtn = document.getElementById('changeModeBtn');

const ROUND_COUNT = 6;
const TYPE_MODES = ['c', 'd'];

let sessionWords = [];
let rounds = [];
let roundIndex = 0;
let score = 0;
let missed = [];
let answered = false;

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function selectedDifficulty() {
  return document.querySelector('input[name="difficulty"]:checked').value;
}

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const mode = selectedMode();
    difficultyRow.classList.toggle('hidden', !TYPE_MODES.includes(mode) && mode !== 'e');
  });
});

function buildHint(word, difficulty) {
  return word
    .split('')
    .map((ch, i) => {
      if (ch === ' ') return ' ';
      if (difficulty === 'easy') return i % 2 === 0 ? ch : '_';
      if (difficulty === 'medium') return i === 0 ? ch : '_';
      return '_';
    })
    .join(' ');
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractors(pool, correctText, count) {
  const candidates = pool.filter((text) => text.toLowerCase() !== correctText.toLowerCase());
  const unique = [...new Set(candidates)];
  return shuffle(unique).slice(0, count);
}

startBtn.addEventListener('click', async () => {
  notEnoughWords.classList.add('hidden');
  const res = await authedFetch(`/api/game/words?count=${ROUND_COUNT}`);
  const data = await res.json();

  if (data.words.length < data.minRequired) {
    notEnoughWords.textContent = `Save at least ${data.minRequired} words before playing (you have ${data.available}).`;
    notEnoughWords.classList.remove('hidden');
    return;
  }

  sessionWords = data.words;
  const baseMode = selectedMode();
  const difficulty = selectedDifficulty();

  rounds = sessionWords.map((word) => ({
    word,
    mode: baseMode === 'e' ? ['a', 'b', 'c', 'd'][Math.floor(Math.random() * 4)] : baseMode,
    difficulty,
  }));

  roundIndex = 0;
  score = 0;
  missed = [];

  modeSelect.classList.add('hidden');
  resultsScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  playRound();
});

function playRound() {
  answered = false;
  feedbackEl.classList.add('hidden');
  nextBtn.classList.add('hidden');
  hintEl.classList.add('hidden');
  choicesArea.classList.add('hidden');
  typeArea.classList.add('hidden');
  choicesArea.innerHTML = '';
  typeInput.value = '';

  const round = rounds[roundIndex];
  roundLabel.textContent = `Round ${roundIndex + 1}/${rounds.length}`;
  scoreLabel.textContent = score;

  if (round.mode === 'a' || round.mode === 'b') {
    playChoiceRound(round);
  } else {
    playTypeRound(round);
  }
}

function playChoiceRound(round) {
  const { word, mode } = round;
  const showOriginal = mode === 'a';
  promptEl.textContent = showOriginal ? word.original : word.translation;

  const correctText = showOriginal ? word.translation : word.original;
  const pool = sessionWords
    .filter((w) => w.id !== word.id)
    .map((w) => (showOriginal ? w.translation : w.original));
  const distractors = pickDistractors(pool, correctText, 2);
  const options = shuffle([correctText, ...distractors]);

  choicesArea.classList.remove('hidden');
  for (const option of options) {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.addEventListener('click', () => {
      if (answered) return;
      handleAnswer(option.toLowerCase() === correctText.toLowerCase(), correctText, btn);
    });
    choicesArea.appendChild(btn);
  }
}

function playTypeRound(round) {
  const { word, mode, difficulty } = round;
  const showOriginal = mode === 'd';
  promptEl.textContent = showOriginal ? word.original : word.translation;

  const correctText = showOriginal ? word.translation : word.original;
  hintEl.textContent = buildHint(correctText, difficulty);
  hintEl.classList.remove('hidden');

  typeArea.classList.remove('hidden');
  typeInput.focus();

  const submit = () => {
    if (answered) return;
    const value = typeInput.value.trim();
    handleAnswer(value.toLowerCase() === correctText.toLowerCase(), correctText);
  };

  submitTypeBtn.onclick = submit;
  typeInput.onkeydown = (event) => {
    if (event.key === 'Enter') submit();
  };
}

async function handleAnswer(correct, correctText, clickedBtn) {
  answered = true;
  const round = rounds[roundIndex];

  if (correct) {
    score++;
    feedbackEl.textContent = '✅ Correct!';
  } else {
    missed.push({ ...round.word, correctText });
    feedbackEl.textContent = `❌ The right answer was "${correctText}".`;
  }
  feedbackEl.classList.remove('hidden');
  scoreLabel.textContent = score;

  if (clickedBtn) {
    clickedBtn.classList.add(correct ? 'correct' : 'wrong');
  }
  for (const btn of choicesArea.querySelectorAll('button')) {
    btn.disabled = true;
    if (btn.textContent.toLowerCase() === correctText.toLowerCase()) {
      btn.classList.add('correct');
    }
  }

  nextBtn.classList.remove('hidden');
  await authedFetch('/api/game/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordId: round.word.id, correct }),
  });
}

nextBtn.addEventListener('click', () => {
  roundIndex++;
  if (roundIndex >= rounds.length) {
    showResults();
  } else {
    playRound();
  }
});

function showResults() {
  gameScreen.classList.add('hidden');
  resultsScreen.classList.remove('hidden');
  finalScore.textContent = `${score}/${rounds.length}`;

  missedList.innerHTML = '';
  if (missed.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Perfect round — nothing missed!';
    missedList.appendChild(li);
  } else {
    for (const word of missed) {
      const li = document.createElement('li');
      li.textContent = `${word.original} — ${word.translation}`;
      missedList.appendChild(li);
    }
  }
}

playAgainBtn.addEventListener('click', () => startBtn.click());

changeModeBtn.addEventListener('click', () => {
  resultsScreen.classList.add('hidden');
  modeSelect.classList.remove('hidden');
});

renderUserBar('userBar');
