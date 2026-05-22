import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { renderCatCard } from '../components/cat-card.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  container.innerHTML = `
    <div class="cats-page">
      <div class="page-header">
        <h2>Kucing Saya</h2>
        <button class="btn-primary" id="addCatBtn">+ Tambah Kucing</button>
      </div>
      <div id="catContent"><div class="spinner mt-3"></div></div>
    </div>
  `;

  container.querySelector('#addCatBtn').addEventListener('click', showAddCatModal);

  await loadCats(container);
}

async function loadCats(container) {
  const content = container.querySelector('#catContent');
  try {
    const cats = await api.get('/api/cats');
    state.setCats(cats);

    if (cats.length === 0) {
      content.innerHTML = `
        <div class="onboarding-card">
          <div style="font-size:52px;margin-bottom:12px;">🐱</div>
          <h2 style="margin-bottom:6px;">Selamat datang di KucingKu Sehat!</h2>
          <p style="color:var(--text-secondary);max-width:400px;margin:0 auto 28px;">
            Platform rekam medis kucing pertama di Indonesia. Mulai dengan menambahkan profil kucing kamu.
          </p>

          <div class="onboarding-steps">
            <div class="onboarding-step">
              <div class="step-num">1</div>
              <div>
                <div class="step-title">Tambah profil kucing</div>
                <div class="step-desc">Nama, ras, tanggal lahir, dan foto</div>
              </div>
            </div>
            <div class="onboarding-step">
              <div class="step-num">2</div>
              <div>
                <div class="step-title">Upload hasil lab</div>
                <div class="step-desc">Foto hasil cek darah — AI ekstrak nilainya otomatis</div>
              </div>
            </div>
            <div class="onboarding-step">
              <div class="step-num">3</div>
              <div>
                <div class="step-title">Chat dengan Dr. Meow</div>
                <div class="step-desc">AI vet yang tahu riwayat lab kucing kamu</div>
              </div>
            </div>
          </div>

          <button class="btn-primary" id="onboardingAddBtn" style="margin-top:28px;padding:12px 32px;font-size:15px;">
            + Tambah Kucing Pertama
          </button>
        </div>
      `;
      content.querySelector('#onboardingAddBtn').addEventListener('click', showAddCatModal);
      return;
    }

    content.innerHTML = `<div class="cat-grid">${cats.map(renderCatCard).join('')}</div>`;

    // Add click handlers to cards
    content.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => {
        const catId = card.dataset.catId;
        navigate(`/cats/${catId}/chat`);
      });
    });
  } catch (err) {
    content.innerHTML = `<div class="empty-state mt-3"><p>Gagal memuat data. Coba refresh.</p></div>`;
  }
}

function showAddCatModal() {
  const formHtml = `
    <div class="form-group">
      <label>Nama Kucing *</label>
      <input type="text" class="form-input" data-field="name" placeholder="Contoh: Milo, Oyen, Luna">
    </div>
    <div class="form-group">
      <label>Ras / Breed</label>
      <input type="text" class="form-input" data-field="breed" placeholder="Contoh: Persia, Domestik, Anggora">
    </div>
    <div class="form-group">
      <label>Tanggal Lahir</label>
      <input type="date" class="form-input" data-field="birth_date" max="${new Date().toISOString().split('T')[0]}">
    </div>
    <div class="form-group">
      <label>Jenis Kelamin</label>
      <select class="form-input" data-field="gender">
        <option value="unknown">Tidak diketahui</option>
        <option value="male">Jantan</option>
        <option value="female">Betina</option>
      </select>
    </div>
    <div class="form-group">
      <label>Berat (kg)</label>
      <input type="number" class="form-input" data-field="weight_kg" step="0.1" min="0" max="50" placeholder="Contoh: 4.5">
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" class="form-input" data-field="notes" placeholder="Alergi, kondisi khusus, dll">
    </div>
  `;

  showModal('Tambah Kucing Baru', formHtml, async (data, overlay) => {
    if (!data.name || !data.name.trim()) {
      showToast('Nama kucing wajib diisi', 'error');
      return;
    }

    const payload = { name: data.name.trim() };
    if (data.breed) payload.breed = data.breed.trim();
    if (data.birth_date) payload.birth_date = data.birth_date;
    if (data.gender) payload.gender = data.gender;
    if (data.weight_kg) payload.weight_kg = parseFloat(data.weight_kg);
    if (data.notes) payload.notes = data.notes.trim();

    try {
      await api.post('/api/cats', payload);
      closeModal(overlay);
      showToast('Kucing berhasil ditambahkan!', 'success');
      // Reload the cats page
      const container = document.getElementById('app-body');
      await loadCats(container.querySelector('.cats-page') ? container : container);
      // Re-render
      await render(container);
    } catch (err) {
      showToast(err.message || 'Gagal menambahkan kucing', 'error');
    }
  });
}
