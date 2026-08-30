const registerForm = document.getElementById('registerForm');
const registerBtn = document.getElementById('registerBtn');
const errorEl = document.getElementById('error');

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.classList.add('hidden');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  registerBtn.disabled = true;
  registerBtn.textContent = 'Creating account…';
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create account');

    window.location.href = '/';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create account';
  }
});
