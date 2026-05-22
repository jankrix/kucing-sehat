import { api } from '../api.js';
import { navigate } from '../router.js';
import { renderDashboard } from './cat-dashboard.js';
import { showToast } from '../components/toast.js';

const FLAG_CONFIG = {
  normal:        { label: 'Normal',   color: 'var(--success)',  bg: '#e8f5e9' },
  low:           { label: 'Rendah',   color: 'var(--warning)',  bg: '#fff8e1' },
  high:          { label: 'Tinggi',   color: 'var(--warning)',  bg: '#fff8e1' },
  critical_low:  { label: 'Kritis ↓', color: 'var(--danger)',   bg: '#fdecea' },
  critical_high: { label: 'Kritis ↑', color: 'var(--danger)',   bg: '#fdecea' },
};

export async function render(container, params) {
  await renderDashboard(container, params.catId, async (mainEl, cat) => {
    await renderLabDetail(mainEl, cat, params.labId);
  });
}

async function renderLabDetail(el, cat, labId) {
  el.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

  let lab;
  try {
    lab = await api.get(`/api/labs/${labId}`);
  } catch {
    el.innerHTML = `<div class="empty-state mt-3"><p>Gagal memuat data lab. <a href="#/cats/${cat.id}/chat">Kembali</a></p></div>`;
    return;
  }

  renderLabView(el, cat, lab);
}

function renderLabView(el, cat, lab) {
  const date = new Date(lab.test_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const isConfirmed = lab.status === 'confirmed';

  const valuesHtml = lab.lab_values?.length
    ? lab.lab_values.map((v, i) => renderValueRow(v, i, !isConfirmed)).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">Tidak ada nilai yang diekstrak</td></tr>';

  el.innerHTML = `
    <div class="page-content">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
        <div>
          <h2 style="margin-bottom:4px;">${lab.lab_name || 'Hasil Lab'}</h2>
          <p style="color:var(--text-secondary);font-size:14px;">${date}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${lab.document_url ? `<a href="${lab.document_url}" target="_blank" class="btn-secondary" style="font-size:13px;padding:6px 12px;">Lihat Dokumen</a>` : ''}
          ${isConfirmed
            ? '<span style="background:#e8f5e9;color:var(--success);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">✓ Dikonfirmasi</span>'
            : '<span style="background:#fff8e1;color:var(--warning);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">Menunggu Konfirmasi</span>'
          }
        </div>
      </div>

      ${!isConfirmed ? `
        <div style="background:#fff8e1;border-left:3px solid var(--warning);padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;font-size:14px;">
          <strong>Periksa nilai yang diekstrak AI.</strong> Edit jika ada yang salah, lalu klik Konfirmasi.
        </div>
      ` : ''}

      <div style="overflow-x:auto;">
        <table id="labTable" style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);">
              <th style="text-align:left;padding:8px 12px;color:var(--text-secondary);font-weight:600;">Parameter</th>
              <th style="text-align:right;padding:8px 12px;color:var(--text-secondary);font-weight:600;">Nilai</th>
              <th style="text-align:left;padding:8px 12px;color:var(--text-secondary);font-weight:600;">Satuan</th>
              <th style="text-align:center;padding:8px 12px;color:var(--text-secondary);font-weight:600;">Ref. Min</th>
              <th style="text-align:center;padding:8px 12px;color:var(--text-secondary);font-weight:600;">Ref. Max</th>
              <th style="text-align:center;padding:8px 12px;color:var(--text-secondary);font-weight:600;">Status</th>
            </tr>
          </thead>
          <tbody id="labValues">
            ${valuesHtml}
          </tbody>
        </table>
      </div>

      ${!isConfirmed ? `
        <div style="display:flex;gap:12px;margin-top:24px;">
          <button id="addRowBtn" class="btn-secondary" style="flex:1;">+ Tambah Baris</button>
          <button id="confirmBtn" class="btn-primary" style="flex:2;">Konfirmasi Nilai</button>
        </div>
      ` : `
        <div style="margin-top:24px;">
          <button id="editBtn" class="btn-secondary">Edit Nilai</button>
        </div>
      `}
    </div>
  `;

  if (!isConfirmed) {
    el.querySelector('#addRowBtn').addEventListener('click', () => addEmptyRow(el));
    el.querySelector('#confirmBtn').addEventListener('click', () => confirmValues(el, cat, lab));
  } else {
    el.querySelector('#editBtn').addEventListener('click', () => {
      // Re-render in edit mode
      lab = { ...lab, status: 'extracted' };
      renderLabView(el, cat, lab);
    });
  }

  // Attach delete listeners
  el.querySelectorAll('.delete-row-btn').forEach(btn => {
    btn.addEventListener('click', (e) => e.target.closest('tr').remove());
  });
}

function renderValueRow(v, i, editable) {
  const flagCfg = FLAG_CONFIG[v.flag] ?? FLAG_CONFIG.normal;

  if (!editable) {
    return `
      <tr style="border-bottom:1px solid var(--border);${v.is_abnormal ? `background:${flagCfg.bg};` : ''}">
        <td style="padding:10px 12px;">
          <div style="font-weight:600;">${v.parameter_name}</div>
          ${v.parameter_label ? `<div style="font-size:12px;color:var(--text-muted);">${v.parameter_label}</div>` : ''}
        </td>
        <td style="padding:10px 12px;text-align:right;font-weight:600;">${v.value}</td>
        <td style="padding:10px 12px;color:var(--text-secondary);">${v.unit}</td>
        <td style="padding:10px 12px;text-align:center;color:var(--text-muted);">${v.ref_min ?? '—'}</td>
        <td style="padding:10px 12px;text-align:center;color:var(--text-muted);">${v.ref_max ?? '—'}</td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="background:${flagCfg.bg};color:${flagCfg.color};padding:2px 8px;border-radius:20px;font-size:12px;font-weight:600;">${flagCfg.label}</span>
        </td>
      </tr>
    `;
  }

  return `
    <tr data-row="${i}" style="border-bottom:1px solid var(--border);">
      <td style="padding:6px 8px;">
        <input class="form-input" style="font-size:13px;padding:4px 8px;width:100%;" placeholder="Nama (mis. HCT)" value="${v.parameter_name}" data-field="parameter_name">
        <input class="form-input" style="font-size:12px;padding:3px 8px;margin-top:2px;width:100%;color:var(--text-muted);" placeholder="Label lengkap (opsional)" value="${v.parameter_label ?? ''}" data-field="parameter_label">
      </td>
      <td style="padding:6px 8px;">
        <input type="number" class="form-input" style="font-size:13px;padding:4px 8px;width:80px;text-align:right;" value="${v.value}" data-field="value" step="any">
      </td>
      <td style="padding:6px 8px;">
        <input class="form-input" style="font-size:13px;padding:4px 8px;width:70px;" placeholder="unit" value="${v.unit}" data-field="unit">
      </td>
      <td style="padding:6px 8px;text-align:center;">
        <input type="number" class="form-input" style="font-size:13px;padding:4px 8px;width:70px;text-align:center;" value="${v.ref_min ?? ''}" data-field="ref_min" step="any" placeholder="—">
      </td>
      <td style="padding:6px 8px;text-align:center;">
        <input type="number" class="form-input" style="font-size:13px;padding:4px 8px;width:70px;text-align:center;" value="${v.ref_max ?? ''}" data-field="ref_max" step="any" placeholder="—">
      </td>
      <td style="padding:6px 8px;text-align:center;">
        <button class="delete-row-btn" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;padding:4px;">✕</button>
      </td>
    </tr>
  `;
}

function addEmptyRow(el) {
  const tbody = el.querySelector('#labValues');
  const rowCount = tbody.querySelectorAll('tr[data-row]').length;
  const tr = document.createElement('tr');
  tr.dataset.row = rowCount;
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = renderValueRow(
    { parameter_name: '', parameter_label: '', value: '', unit: '', ref_min: null, ref_max: null, flag: 'normal', is_abnormal: false },
    rowCount,
    true
  ).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '');

  // We can't use innerHTML on existing tr, so build it fresh
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderValueRow(
    { parameter_name: '', parameter_label: '', value: '', unit: '', ref_min: null, ref_max: null, flag: 'normal', is_abnormal: false },
    rowCount,
    true
  );
  const newRow = tempDiv.firstElementChild;
  newRow.querySelector('.delete-row-btn').addEventListener('click', (e) => e.target.closest('tr').remove());
  tbody.appendChild(newRow);
}

function collectValues(el) {
  const rows = el.querySelectorAll('#labValues tr[data-row]');
  const values = [];

  for (const row of rows) {
    const get = (f) => row.querySelector(`[data-field="${f}"]`)?.value?.trim() ?? '';
    const parameter_name = get('parameter_name');
    const unit = get('unit');
    const rawValue = get('value');

    if (!parameter_name || !unit || rawValue === '') continue;

    const value = parseFloat(rawValue);
    if (isNaN(value)) continue;

    const refMin = get('ref_min');
    const refMax = get('ref_max');

    values.push({
      parameter_name,
      parameter_label: get('parameter_label') || undefined,
      value,
      unit,
      ref_min: refMin !== '' ? parseFloat(refMin) : null,
      ref_max: refMax !== '' ? parseFloat(refMax) : null,
    });
  }

  return values;
}

async function confirmValues(el, cat, lab) {
  const values = collectValues(el);
  if (values.length === 0) {
    showToast('Tambahkan minimal satu nilai sebelum konfirmasi', 'error');
    return;
  }

  const confirmBtn = el.querySelector('#confirmBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Menyimpan...';

  try {
    await api.put(`/api/labs/${lab.id}/confirm`, { values });
    showToast('Nilai lab berhasil dikonfirmasi!', 'success');
    // Reload the page to show confirmed state
    const updated = await api.get(`/api/labs/${lab.id}`);
    renderLabView(el, cat, updated);
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan', 'error');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Konfirmasi Nilai';
  }
}
