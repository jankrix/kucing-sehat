import { signUp, signIn } from '../supabase.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { state } from '../state.js';

export async function render(container) {
  // If already logged in, redirect
  if (state.user) {
    navigate('/cats');
    return;
  }

  let isSignUp = false;

  function renderForm() {
    container.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="logo-emoji">🐱</div>
          <h2>KucingKu Sehat</h2>
          <p class="subtitle">${isSignUp ? 'Buat akun baru' : 'Masuk ke akun kamu'}</p>
          <form id="authForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" class="form-input" data-field="email" placeholder="email@contoh.com" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" class="form-input" data-field="password" placeholder="Min. 6 karakter" required minlength="6">
            </div>
            ${isSignUp ? `
            <div class="form-group">
              <label>Konfirmasi Password</label>
              <input type="password" class="form-input" data-field="confirmPassword" placeholder="Ulangi password" required minlength="6">
            </div>
            ` : ''}
            <button type="submit" class="btn-primary" style="width:100%; margin-top:8px;" id="submitBtn">
              ${isSignUp ? 'Daftar' : 'Masuk'}
            </button>
          </form>
          <div class="toggle-link">
            ${isSignUp
              ? 'Sudah punya akun? <a id="toggleAuth">Masuk</a>'
              : 'Belum punya akun? <a id="toggleAuth">Daftar</a>'
            }
          </div>
        </div>
      </div>
    `;

    container.querySelector('#toggleAuth').addEventListener('click', (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      renderForm();
    });

    container.querySelector('#authForm').addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('[data-field="email"]').value.trim();
    const password = form.querySelector('[data-field="password"]').value;
    const btn = form.querySelector('#submitBtn');

    if (isSignUp) {
      const confirm = form.querySelector('[data-field="confirmPassword"]').value;
      if (password !== confirm) {
        showToast('Password tidak sama', 'error');
        return;
      }
    }

    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
      if (isSignUp) {
        await signUp(email, password);
        showToast('Akun berhasil dibuat! Silakan cek email untuk verifikasi.', 'success', 5000);
      } else {
        await signIn(email, password);
        navigate('/cats');
      }
    } catch (err) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = isSignUp ? 'Daftar' : 'Masuk';
    }
  }

  renderForm();
}
