import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { renderSidebar } from '../components/sidebar.js';
import { renderMobileNav } from '../components/mobile-nav.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export async function renderDashboard(container, catId, renderMain) {
  container.innerHTML = '<div class="dashboard-layout"><div class="spinner mt-3" style="margin:auto;"></div></div>';

  try {
    let cat = await api.get(`/api/cats/${catId}`);
    if (!cat) {
      navigate('/cats');
      return;
    }
    state.setCurrentCat(cat);

    let labResults = [];
    try {
      labResults = await api.get(`/api/cats/${catId}/labs`);
    } catch {
      // Non-fatal
    }

    function buildLayout() {
      container.innerHTML = `
        <div class="dashboard-layout">
          ${renderSidebar(cat, labResults)}
          <div class="dashboard-main" id="dashboardMain"></div>
        </div>
      `;

      // Wire up the edit button in the sidebar
      container.querySelector('.sidebar-edit-btn')?.addEventListener('click', () => {
        showEditCatModal(cat, async (updated) => {
          cat = updated;
          state.setCurrentCat(updated);
          // Rebuild sidebar in place without re-rendering the whole page
          const sidebar = container.querySelector('.dashboard-sidebar');
          if (sidebar) sidebar.outerHTML = renderSidebar(updated, labResults);
          // Re-wire after DOM replacement
          container.querySelector('.sidebar-edit-btn')?.addEventListener('click', () => {});
          buildLayout();
        });
      });
    }

    buildLayout();

    const mainEl = container.querySelector('#dashboardMain');
    const cleanupNav = renderMobileNav(cat);

    if (renderMain) {
      const cleanup = await renderMain(mainEl, cat);
      return () => {
        cleanupNav();
        if (typeof cleanup === 'function') cleanup();
      };
    }
    return cleanupNav;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state mt-3">
        <p>Gagal memuat data kucing. <a href="#/cats">Kembali</a></p>
      </div>
    `;
  }
}

function showEditCatModal(cat, onSaved) {
  const today = new Date().toISOString().split('T')[0];

  const formHtml = `
    <div class="form-group">
      <label>Nama Kucing *</label>
      <input type="text" class="form-input" data-field="name" value="${cat.name || ''}" placeholder="Contoh: Milo, Oyen, Luna">
    </div>
    <div class="form-group">
      <label>Ras / Breed</label>
      <input type="text" class="form-input" data-field="breed" value="${cat.breed || ''}" placeholder="Contoh: Persia, Domestik, Anggora">
    </div>
    <div class="form-group">
      <label>Tanggal Lahir</label>
      <input type="date" class="form-input" data-field="birth_date" value="${cat.birth_date || ''}" max="${today}">
    </div>
    <div class="form-group">
      <label>Jenis Kelamin</label>
      <select class="form-input" data-field="gender">
        <option value="unknown" ${cat.gender === 'unknown' ? 'selected' : ''}>Tidak diketahui</option>
        <option value="male"    ${cat.gender === 'male'    ? 'selected' : ''}>Jantan</option>
        <option value="female"  ${cat.gender === 'female'  ? 'selected' : ''}>Betina</option>
      </select>
    </div>
    <div class="form-group">
      <label>Berat (kg)</label>
      <input type="number" class="form-input" data-field="weight_kg" value="${cat.weight_kg || ''}" step="0.1" min="0" max="50" placeholder="Contoh: 4.5">
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" class="form-input" data-field="notes" value="${cat.notes || ''}" placeholder="Alergi, kondisi khusus, dll">
    </div>
  `;

  showModal(`Edit Profil ${cat.name}`, formHtml, async (data, overlay) => {
    if (!data.name?.trim()) {
      showToast('Nama kucing wajib diisi', 'error');
      return;
    }

    const payload = { name: data.name.trim() };
    if (data.breed?.trim())   payload.breed      = data.breed.trim();
    if (data.birth_date)      payload.birth_date  = data.birth_date;
    if (data.gender)          payload.gender      = data.gender;
    if (data.weight_kg)       payload.weight_kg   = parseFloat(data.weight_kg);
    if (data.notes?.trim())   payload.notes       = data.notes.trim();

    try {
      const updated = await api.put(`/api/cats/${cat.id}`, payload);
      closeModal(overlay);
      showToast('Profil kucing berhasil diperbarui!', 'success');
      onSaved(updated);
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan', 'error');
    }
  });
}
