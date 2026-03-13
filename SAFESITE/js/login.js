// ============================================================
// js/login.js — Login Page Logic
// ============================================================

// ---- Clock ----
function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('en-PH', { hour12: false });
  const el = document.getElementById('liveTime');
  if (el) el.textContent = t;
}
setInterval(updateClock, 1000);
updateClock();

// ---- Floating particles ----
(function spawnParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      bottom: -10px;
      animation-duration: ${6 + Math.random() * 10}s;
      animation-delay: ${Math.random() * 8}s;
      opacity: 0;
    `;
    container.appendChild(p);
  }
})();

// ---- Toggle password visibility ----
window.togglePassword = function() {
  const input = document.getElementById('loginPass');
  input.type = input.type === 'password' ? 'text' : 'password';
};

// ---- Login ----
window.doLogin = async function() {
  const email  = document.getElementById('loginEmail').value.trim();
  const pass   = document.getElementById('loginPass').value;
  const errEl  = document.getElementById('loginError');
  const btn    = document.getElementById('signinBtn');

  errEl.style.display = 'none';

  if (!email) { showError('Please enter your email address.'); return; }
  if (!pass)  { showError('Please enter your password.'); return; }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { signInWithEmailAndPassword } = window._fns;
    await signInWithEmailAndPassword(window._auth, email, pass);
    // Redirect handled by firebase-init.js onAuthStateChanged
  } catch (err) {
    btn.classList.remove('loading');
    btn.disabled = false;

    const msgs = {
      'auth/invalid-credential':   '❌ Invalid email or password.',
      'auth/user-not-found':       '❌ No account found with that email.',
      'auth/wrong-password':       '❌ Incorrect password.',
      'auth/too-many-requests':    '⏳ Too many attempts. Try again later.',
      'auth/network-request-failed': '🌐 Network error. Check your connection.',
    };
    showError(msgs[err.code] || '❌ Login failed: ' + err.message);
  }
};

function showError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ---- Enter key support ----
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
