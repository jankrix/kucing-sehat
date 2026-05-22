import { api } from '../api.js';
import { navigate } from '../router.js';
import { renderDashboard } from './cat-dashboard.js';
import { formatText } from '../utils.js';
import { showToast } from '../components/toast.js';

const FLAG_COLOR = {
  normal:        'var(--success)',
  low:           'var(--warning)',
  high:          'var(--warning)',
  critical_low:  'var(--danger)',
  critical_high: 'var(--danger)',
};

export async function render(container, params) {
  await renderDashboard(container, params.catId, async (mainEl, cat) => {
    await renderTrends(mainEl, cat);
  });
}

async function renderTrends(el, cat) {
  el.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

  let data;
  try {
    data = await api.get(`/api/cats/${cat.id}/trends`);
  } catch {
    el.innerHTML = `<div class="empty-state mt-3"><p>Gagal memuat data tren.</p></div>`;
    return;
  }

  const { trends, total_confirmed_labs } = data;

  if (total_confirmed_labs < 1) {
    el.innerHTML = `
      <div class="page-content">
        <h2>Tren Kesehatan ${cat.name}</h2>
        <div class="empty-state" style="margin-top:40px;">
          <div class="emoji">📊</div>
          <h3>Belum ada data lab</h3>
          <p>Upload dan konfirmasi minimal 1 hasil lab untuk mulai melihat tren kesehatan.</p>
          <a href="#/cats/${cat.id}/lab/upload" class="btn-primary" style="display:inline-block;margin-top:16px;text-decoration:none;">Upload Hasil Lab</a>
        </div>
      </div>
    `;
    return;
  }

  const trendable = trends.filter(t => t.points.length >= 2);
  const single = trends.filter(t => t.points.length === 1);

  el.innerHTML = `
    <div class="page-content" style="max-width:900px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
        <div>
          <h2 style="margin-bottom:4px;">Tren Kesehatan ${cat.name}</h2>
          <p style="color:var(--text-secondary);font-size:14px;">${total_confirmed_labs} pemeriksaan dikonfirmasi</p>
        </div>
        <button id="analyzeBtn" class="btn-primary" ${trendable.length < 1 ? 'disabled' : ''}>
          Analisis AI
        </button>
      </div>

      <div id="aiAnalysis" style="display:none;margin-bottom:28px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;">
        <div class="spinner" style="margin:20px auto;"></div>
      </div>

      ${trendable.length > 0 ? `
        <h3 style="font-size:15px;margin-bottom:16px;color:var(--text-secondary);">Parameter dengan tren (${trendable.length})</h3>
        <div id="trendCards" class="trend-cards-grid"></div>
      ` : `
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:20px;margin-bottom:20px;font-size:14px;color:var(--text-secondary);">
          Upload minimal 2 hasil lab agar tren per parameter ditampilkan.
        </div>
      `}

      ${single.length > 0 ? `
        <h3 style="font-size:15px;margin:24px 0 12px;color:var(--text-secondary);">Parameter satu pemeriksaan</h3>
        <div class="single-params-table">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);">
                <th style="text-align:left;padding:8px 12px;color:var(--text-secondary);">Parameter</th>
                <th style="text-align:right;padding:8px 12px;color:var(--text-secondary);">Nilai</th>
                <th style="text-align:left;padding:8px 12px;color:var(--text-secondary);">Satuan</th>
                <th style="text-align:center;padding:8px 12px;color:var(--text-secondary);">Status</th>
              </tr>
            </thead>
            <tbody>
              ${single.map(t => {
                const p = t.points[0];
                const color = FLAG_COLOR[p.flag] ?? 'var(--text-secondary)';
                return `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px 12px;">
                      <div style="font-weight:600;">${t.name}</div>
                      ${t.label ? `<div style="font-size:12px;color:var(--text-muted);">${t.label}</div>` : ''}
                    </td>
                    <td style="padding:10px 12px;text-align:right;font-weight:600;">${p.value}</td>
                    <td style="padding:10px 12px;color:var(--text-secondary);">${t.unit}</td>
                    <td style="padding:10px 12px;text-align:center;">
                      <span style="color:${color};font-weight:600;font-size:13px;">${p.flag.replace('_', ' ')}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;

  // Render trend cards
  if (trendable.length > 0) {
    const grid = el.querySelector('#trendCards');
    for (const trend of trendable) {
      grid.appendChild(buildTrendCard(trend));
    }
  }

  // AI analysis button
  el.querySelector('#analyzeBtn')?.addEventListener('click', async () => {
    const analysisEl = el.querySelector('#aiAnalysis');
    const btn = el.querySelector('#analyzeBtn');
    analysisEl.style.display = 'block';
    analysisEl.innerHTML = '<div class="spinner" style="margin:20px auto;"></div><p style="text-align:center;font-size:14px;color:var(--text-secondary);margin-top:8px;">Dr. Meow sedang menganalisis...</p>';
    btn.disabled = true;
    btn.textContent = 'Menganalisis...';

    try {
      const { analysis } = await api.post(`/api/cats/${cat.id}/trends/analyze`, {});
      analysisEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="font-size:28px;">🐱</span>
          <div>
            <div style="font-weight:600;color:var(--text-primary);">Analisis Dr. Meow</div>
            <div style="font-size:12px;color:var(--text-muted);">Bukan pengganti konsultasi dokter hewan</div>
          </div>
        </div>
        <div class="analysis-content" style="font-size:14px;line-height:1.7;">${formatText(analysis)}</div>
      `;
      btn.textContent = 'Analisis Ulang';
      btn.disabled = false;
    } catch (err) {
      analysisEl.innerHTML = `<p style="color:var(--danger);">Gagal menganalisis: ${err.message}</p>`;
      btn.textContent = 'Analisis AI';
      btn.disabled = false;
    }
  });
}

function buildTrendCard(trend) {
  const card = document.createElement('div');
  card.className = 'trend-card';

  const latest = trend.points[trend.points.length - 1];
  const prev = trend.points[trend.points.length - 2];
  const delta = latest.value - prev.value;
  const deltaSign = delta > 0 ? '+' : '';
  const trendArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const latestColor = FLAG_COLOR[latest.flag] ?? 'var(--text-primary)';

  const sparkline = buildSparkline(trend);

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-weight:700;font-size:15px;">${trend.name}</div>
        ${trend.label ? `<div style="font-size:12px;color:var(--text-muted);">${trend.label}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:700;color:${latestColor};">${latest.value} <span style="font-size:13px;font-weight:400;">${trend.unit}</span></div>
        <div style="font-size:12px;color:${delta === 0 ? 'var(--text-muted)' : delta > 0 ? 'var(--warning)' : 'var(--success)'};">${trendArrow} ${deltaSign}${delta.toFixed(1)} dari sebelumnya</div>
      </div>
    </div>
    <div class="sparkline-container">${sparkline}</div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:4px;">
      <span>${formatDateShort(trend.points[0].date)}</span>
      <span>${trend.points.length} pemeriksaan</span>
      <span>${formatDateShort(latest.date)}</span>
    </div>
    ${trend.ref_min !== null ? `
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Normal: ${trend.ref_min}–${trend.ref_max} ${trend.unit}</div>
    ` : ''}
  `;

  return card;
}

function buildSparkline(trend) {
  const W = 220, H = 50, PAD = 6;
  const values = trend.points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = trend.points.map((p, i) => {
    const x = PAD + (i / (trend.points.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (p.value - min) / range) * (H - PAD * 2);
    return { x, y, flag: p.flag, value: p.value };
  });

  // Draw ref range band if available
  let refBand = '';
  if (trend.ref_min !== null && trend.ref_max !== null) {
    const yMin = PAD + (1 - (trend.ref_max - min) / range) * (H - PAD * 2);
    const yMax = PAD + (1 - (trend.ref_min - min) / range) * (H - PAD * 2);
    refBand = `<rect x="${PAD}" y="${Math.min(yMin, PAD)}" width="${W - PAD * 2}" height="${Math.max(0, Math.min(yMax, H - PAD) - Math.min(yMin, PAD))}" fill="rgba(46,213,115,0.1)" rx="2"/>`;
  }

  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = pts.map(p => {
    const color = FLAG_COLOR[p.flag] ?? 'var(--text-secondary)';
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="var(--bg-secondary)" stroke-width="1.5"/>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
    ${refBand}
    <polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
  </svg>`;
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
