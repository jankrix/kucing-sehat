import { api } from '../api.js';
import { navigate } from '../router.js';
import { renderDashboard } from './cat-dashboard.js';
import { showToast } from '../components/toast.js';

async function loadRecentVetVisits(catId) {
  try {
    return await api.get(`/api/cats/${catId}/vet-visits/recent?days=30`);
  } catch {
    return [];
  }
}

export async function render(container, params) {
  await renderDashboard(container, params.catId, async (mainEl, cat) => {
    renderUploadForm(mainEl, cat);
  });
}

async function renderUploadForm(el, cat) {
  const recentVisits = await loadRecentVetVisits(cat.id);
  const vetVisitOptions = recentVisits.map(v => {
    const date = new Date(v.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const label = [date, v.clinic_name, v.reason].filter(Boolean).join(' — ');
    return `<option value="${v.id}">${label}</option>`;
  }).join('');

  el.innerHTML = `
    <div class="page-content">
      <h2 style="margin-bottom:4px;">Upload Hasil Lab</h2>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:24px;">
        Foto hasil lab ${cat.name} — AI akan mengekstrak nilai-nilainya otomatis
      </p>

      <form id="labUploadForm">
        <div class="form-group">
          <label class="form-label">Tanggal Tes *</label>
          <input type="date" id="testDate" class="form-input" required
            max="${new Date().toISOString().split('T')[0]}"
            value="${new Date().toISOString().split('T')[0]}">
        </div>

        <div class="form-group">
          <label class="form-label">Nama Laboratorium</label>
          <input type="text" id="labName" class="form-input" placeholder="contoh: Pet Lab Kemang" maxlength="200">
        </div>

        ${recentVisits.length > 0 ? `
        <div class="form-group">
          <label class="form-label">Kunjungan Dokter Hewan (30 hari terakhir)</label>
          <select id="vetVisitId" class="form-input">
            <option value="">— Tidak terkait kunjungan —</option>
            ${vetVisitOptions}
          </select>
          <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">
            Pilih kunjungan yang menghasilkan lab ini agar tersambung.
          </p>
        </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label">Foto Hasil Lab *</label>
          <div id="imageDropzone" class="image-dropzone" role="button" tabindex="0">
            <div id="dropzonePlaceholder">
              <div style="font-size:40px;margin-bottom:8px;">📄</div>
              <p style="font-weight:600;margin-bottom:4px;">Klik atau seret foto ke sini</p>
              <p style="font-size:13px;color:var(--text-muted);">JPG, PNG, PDF — maks. 8MB</p>
            </div>
            <img id="imagePreview" style="display:none;max-width:100%;max-height:300px;border-radius:8px;">
          </div>
          <input type="file" id="imageInput" accept="image/jpeg,image/png,image/webp,image/heic" style="display:none;">
          <div id="imageWarning" style="display:none;margin-top:8px;background:#3a2a0a;border-left:3px solid var(--warning);padding:8px 12px;border-radius:0 4px 4px 0;font-size:13px;color:var(--warning);"></div>
        </div>

        <div style="display:flex;gap:12px;margin-top:24px;">
          <button type="button" id="cancelBtn" class="btn-secondary" style="flex:1;">Batal</button>
          <button type="submit" id="submitBtn" class="btn-primary" style="flex:2;" disabled>
            Analisis dengan AI
          </button>
        </div>
      </form>

      <div id="processingState" style="display:none;text-align:center;padding:40px 0;">
        <div class="spinner" style="margin:0 auto 16px;"></div>
        <p style="font-weight:600;">AI sedang menganalisis hasil lab...</p>
        <p style="font-size:13px;color:var(--text-secondary);">Proses ini membutuhkan 10–30 detik</p>
      </div>
    </div>
  `;

  let imageDataUrl = null;

  const dropzone = el.querySelector('#imageDropzone');
  const imageInput = el.querySelector('#imageInput');
  const imagePreview = el.querySelector('#imagePreview');
  const placeholder = el.querySelector('#dropzonePlaceholder');
  const submitBtn = el.querySelector('#submitBtn');
  const form = el.querySelector('#labUploadForm');

  function loadFile(file) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!file) return;

    if (!file.type.startsWith('image/') && !ALLOWED_TYPES.includes(file.type)) {
      showToast('Format tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Ukuran file maksimal 8MB. Kompres gambar terlebih dahulu.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // Validate image dimensions
      const img = new Image();
      img.onload = () => {
        const warn = el.querySelector('#imageWarning');
        if (img.width < 400 || img.height < 300) {
          warn.style.display = '';
          warn.textContent = `⚠️ Gambar terlalu kecil (${img.width}×${img.height}px). AI mungkin tidak dapat membaca teks. Gunakan foto dengan resolusi lebih tinggi.`;
        } else {
          warn.style.display = 'none';
        }
        imageDataUrl = dataUrl;
        imagePreview.src = dataUrl;
        imagePreview.style.display = 'block';
        placeholder.style.display = 'none';
        submitBtn.disabled = false;
      };
      img.onerror = () => {
        showToast('File gambar tidak valid atau rusak.', 'error');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  dropzone.addEventListener('click', () => imageInput.click());
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') imageInput.click(); });
  imageInput.addEventListener('change', (e) => loadFile(e.target.files[0]));

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    loadFile(e.dataTransfer.files[0]);
  });

  el.querySelector('#cancelBtn').addEventListener('click', () => navigate(`/cats/${cat.id}/chat`));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!imageDataUrl) return;

    const testDate = el.querySelector('#testDate').value;
    const labName = el.querySelector('#labName').value.trim();
    const vetVisitId = el.querySelector('#vetVisitId')?.value || '';

    form.style.display = 'none';
    el.querySelector('#processingState').style.display = 'block';

    try {
      const result = await api.post(`/api/cats/${cat.id}/labs/upload`, {
        image: imageDataUrl,
        test_date: testDate,
        ...(labName && { lab_name: labName }),
        ...(vetVisitId && { vet_visit_id: vetVisitId }),
      });

      showToast('Hasil lab berhasil dianalisis!', 'success');
      navigate(`/cats/${cat.id}/labs/${result.id}`);
    } catch (err) {
      form.style.display = 'block';
      el.querySelector('#processingState').style.display = 'none';
      showToast(err.message || 'Gagal menganalisis hasil lab', 'error');
    }
  });
}
