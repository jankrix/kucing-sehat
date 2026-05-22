import { api } from '../api.js';
import { renderDashboard } from './cat-dashboard.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const CATEGORY = {
  food:       { label: 'Makanan',        icon: '🥩' },
  vitamin:    { label: 'Vitamin',        icon: '💊' },
  medicine:   { label: 'Obat',           icon: '💉' },
  supplement: { label: 'Suplemen',       icon: '🌿' },
  vet_visit:  { label: 'Dokter Hewan',   icon: '🏥' },
  other:      { label: 'Lainnya',        icon: '📦' },
};

export async function render(container, params) {
  await renderDashboard(container, params.catId, async (mainEl, cat) => {
    await renderPurchases(mainEl, cat);
  });
}

async function renderPurchases(el, cat) {
  el.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

  let purchases = [];
  let vetVisits = [];
  try {
    [purchases, vetVisits] = await Promise.all([
      api.get(`/api/cats/${cat.id}/purchases`),
      api.get(`/api/cats/${cat.id}/vet-visits`),
    ]);
  } catch {
    el.innerHTML = `<div class="empty-state mt-3"><p>Gagal memuat data pembelian.</p></div>`;
    return;
  }

  // Normalise vet visits into the same shape as purchases for unified display
  const vetAsPurchases = vetVisits.map(v => ({
    id: v.id,
    category: 'vet_visit',
    product_name: v.reason || 'Kunjungan dokter hewan',
    brand: v.clinic_name,
    quantity: v.vet_name ? `Dr. ${v.vet_name}` : null,
    price_idr: v.cost_idr,
    purchase_date: v.visit_date,
    notes: v.notes,
    _is_vet_visit: true,
  }));

  const all = [...purchases, ...vetAsPurchases].sort(
    (a, b) => b.purchase_date.localeCompare(a.purchase_date)
  );

  renderList(el, cat, all);
}

function renderList(el, cat, purchases) {
  const byCategory = groupByCategory(purchases);

  el.innerHTML = `
    <div class="page-content" style="max-width:700px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <h2>Log Pembelian ${cat.name}</h2>
        <button id="addBtn" class="btn-primary">+ Tambah</button>
      </div>

      ${purchases.length === 0 ? `
        <div class="empty-state" style="margin-top:40px;">
          <div class="emoji">🛒</div>
          <h3>Belum ada catatan pembelian</h3>
          <p>Catat makanan, vitamin, dan obat-obatan ${cat.name} di sini. Atau ceritakan ke Dr. Meow!</p>
        </div>
      ` : `
        <!-- Date range filter -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;" id="dateFilterRow">
          <button class="filter-btn active" data-range="all">Semua</button>
          <button class="filter-btn" data-range="today">Hari ini</button>
          <button class="filter-btn" data-range="week">Minggu ini</button>
          <button class="filter-btn" data-range="month">Bulan ini</button>
          <button class="filter-btn" data-range="custom">📅 Pilih tanggal</button>
        </div>
        <div id="customDateRow" style="display:none;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
          <input type="date" id="dateFrom" class="form-input" style="width:auto;">
          <span style="color:var(--text-muted);">s/d</span>
          <input type="date" id="dateTo" class="form-input" style="width:auto;" value="${new Date().toISOString().split('T')[0]}">
        </div>

        <!-- Category filter -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;" id="catFilterRow">
          <button class="filter-btn active" data-cat="all">Semua kategori</button>
          ${Object.entries(CATEGORY).filter(([k]) => byCategory[k]?.length > 0).map(([k, v]) => `
            <button class="filter-btn" data-cat="${k}">${v.icon} ${v.label}</button>
          `).join('')}
        </div>

        <!-- Summary row -->
        <div id="summaryRow" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:13px;">
          <span id="summaryCount" style="color:var(--text-secondary);"></span>
          <span id="summaryTotal" style="font-weight:700;"></span>
        </div>

        <div id="purchaseList"></div>
      `}
    </div>
  `;

  el.querySelector('#addBtn').addEventListener('click', () => showAddModal(cat, (p) => {
    purchases.unshift(p);
    renderList(el, cat, purchases);
  }));

  if (purchases.length === 0) return;

  let activeDateRange = 'all';
  let activeCatFilter = 'all';
  const listEl = el.querySelector('#purchaseList');

  function getDateBounds(range) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (range === 'today') {
      return { from: today, to: new Date() };
    }
    if (range === 'week') {
      const from = new Date(today);
      from.setDate(today.getDate() - today.getDay());
      return { from, to: new Date() };
    }
    if (range === 'month') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: new Date() };
    }
    if (range === 'custom') {
      const fromVal = el.querySelector('#dateFrom')?.value;
      const toVal = el.querySelector('#dateTo')?.value;
      const from = fromVal ? new Date(fromVal) : null;
      const to = toVal ? new Date(toVal + 'T23:59:59') : new Date();
      return { from, to };
    }
    return null;
  }

  function applyFilters() {
    const bounds = getDateBounds(activeDateRange);

    let filtered = purchases.filter(p => {
      if (activeCatFilter !== 'all' && p.category !== activeCatFilter) return false;
      if (bounds) {
        const d = new Date(p.purchase_date);
        if (bounds.from && d < bounds.from) return false;
        if (bounds.to && d > bounds.to) return false;
      }
      return true;
    });

    const total = filtered.reduce((s, p) => s + (p.price_idr || 0), 0);
    el.querySelector('#summaryCount').textContent = `${filtered.length} item`;
    el.querySelector('#summaryTotal').textContent = total > 0 ? `Total: Rp ${formatIDR(total)}` : '';

    renderItems(listEl, filtered, cat, (id) => {
      purchases = purchases.filter(p => p.id !== id);
      renderList(el, cat, purchases);
    });
  }

  // Date range filter
  el.querySelector('#dateFilterRow').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    el.querySelectorAll('#dateFilterRow .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeDateRange = btn.dataset.range;
    const customRow = el.querySelector('#customDateRow');
    customRow.style.display = activeDateRange === 'custom' ? 'flex' : 'none';
    applyFilters();
  });

  // Custom date inputs
  el.querySelector('#customDateRow')?.addEventListener('change', applyFilters);

  // Category filter
  el.querySelector('#catFilterRow').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    el.querySelectorAll('#catFilterRow .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCatFilter = btn.dataset.cat;
    applyFilters();
  });

  applyFilters();
}

function renderItems(el, purchases, cat, onDelete) {
  if (purchases.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:14px;">Tidak ada item dalam kategori ini.</div>`;
    return;
  }

  // Group by month
  const grouped = {};
  for (const p of purchases) {
    const d = new Date(p.purchase_date);
    const key = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  el.innerHTML = Object.entries(grouped).map(([month, items]) => `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;margin-bottom:8px;">${month}</div>
      ${items.map(p => renderItem(p)).join('')}
    </div>
  `).join('');

  el.querySelectorAll('.delete-purchase-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const isVet = btn.dataset.vet === 'true';
      if (!confirm('Hapus catatan ini?')) return;
      try {
        const url = isVet
          ? `/api/cats/${cat.id}/vet-visits/${id}`
          : `/api/cats/${cat.id}/purchases/${id}`;
        await api.del(url);
        showToast('Catatan dihapus', 'success');
        onDelete(id);
      } catch {
        showToast('Gagal menghapus', 'error');
      }
    });
  });
}

function renderItem(p) {
  const cat = CATEGORY[p.category] ?? CATEGORY.other;
  const date = new Date(p.purchase_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `
    <div class="purchase-item">
      <div class="purchase-icon">${cat.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.product_name}</div>
        <div style="font-size:12px;color:var(--text-secondary);">
          ${p.brand ? p.brand + ' · ' : ''}${cat.label}${p.quantity ? ' · ' + p.quantity : ''}
          ${p.notes ? `<span style="color:var(--text-muted);"> · ${p.notes}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        ${p.price_idr ? `<div style="font-weight:600;font-size:14px;">Rp ${formatIDR(p.price_idr)}</div>` : ''}
        <div style="font-size:12px;color:var(--text-muted);">${date}</div>
      </div>
      <button class="delete-purchase-btn" data-id="${p.id}" data-vet="${p._is_vet_visit ? 'true' : 'false'}" title="Hapus" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:4px 8px;flex-shrink:0;">✕</button>
    </div>
  `;
}

function showAddModal(cat, onAdded) {
  const today = new Date().toISOString().split('T')[0];
  const formHtml = `
    <div class="form-group">
      <label>Kategori *</label>
      <select class="form-input" data-field="category">
        ${Object.entries(CATEGORY).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nama Produk *</label>
      <input type="text" class="form-input" data-field="product_name" placeholder="Contoh: Royal Canin Kitten">
    </div>
    <div class="form-group">
      <label>Merek</label>
      <input type="text" class="form-input" data-field="brand" placeholder="Contoh: Royal Canin">
    </div>
    <div class="form-group">
      <label>Jumlah / Ukuran</label>
      <input type="text" class="form-input" data-field="quantity" placeholder="Contoh: 2kg, 1 botol, 30 tablet">
    </div>
    <div class="form-group">
      <label>Harga (Rp)</label>
      <input type="number" class="form-input" data-field="price_idr" placeholder="Contoh: 150000" min="0">
    </div>
    <div class="form-group">
      <label>Tanggal Beli</label>
      <input type="date" class="form-input" data-field="purchase_date" value="${today}" max="${today}">
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" class="form-input" data-field="notes" placeholder="Opsional">
    </div>
  `;

  showModal('Tambah Pembelian', formHtml, async (data, overlay) => {
    if (!data.product_name?.trim()) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }

    const payload = {
      category: data.category,
      product_name: data.product_name.trim(),
    };
    if (data.brand?.trim()) payload.brand = data.brand.trim();
    if (data.quantity?.trim()) payload.quantity = data.quantity.trim();
    if (data.price_idr) payload.price_idr = parseInt(data.price_idr, 10);
    if (data.purchase_date) payload.purchase_date = data.purchase_date;
    if (data.notes?.trim()) payload.notes = data.notes.trim();

    try {
      const purchase = await api.post(`/api/cats/${cat.id}/purchases`, payload);
      closeModal(overlay);
      showToast('Pembelian berhasil dicatat!', 'success');
      onAdded(purchase);
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan', 'error');
    }
  });
}

function groupByCategory(purchases) {
  const result = {};
  for (const p of purchases) {
    if (!result[p.category]) result[p.category] = [];
    result[p.category].push(p);
  }
  return result;
}

function formatIDR(n) {
  return n.toLocaleString('id-ID');
}
