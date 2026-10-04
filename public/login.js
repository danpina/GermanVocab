const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorEl = document.getElementById('error');
const wakeHint = document.getElementById('wakeHint');
let wakeTimer;

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // The free hosting plan sleeps when idle; explain a long first wait instead of just hanging.
  wakeTimer = setTimeout(() => wakeHint.classList.remove('hidden'), 4000);
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    window.location.href = '/';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    clearTimeout(wakeTimer);
    wakeHint.classList.add('hidden');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log in';
  }
});
