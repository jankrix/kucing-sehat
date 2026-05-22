import { api } from '../api.js';
import { state } from '../state.js';

const PILOT_KEY = 'pilot_bypassed';
let _overlayActive = false; // prevent duplicate overlays

export async function initSubscriptionPrompt() {
  // Already bypassed this session
  if (sessionStorage.getItem(PILOT_KEY)) return;

  let subscription = state.subscription;
  if (!subscription) {
    try {
      const me = await api.get('/api/me');
      subscription = me.subscription;
      state.setSubscription(subscription);
    } catch {
      return;
    }
  }

  const isActive = subscription?.status === 'active' && subscription?.plan !== 'free';
  if (isActive) return;

  showPilotScreen();
}

function showPilotScreen() {
  if (_overlayActive) return; // already showing
  _overlayActive = true;

  // Hide the app body so nothing is visible behind the overlay
  const appBody = document.getElementById('app-body');
  if (appBody) appBody.style.visibility = 'hidden';

  const overlay = document.createElement('div');
  overlay.id = 'pilotOverlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: var(--bg-primary);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  `;

  overlay.innerHTML = `
    <div style="max-width:480px;width:100%;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">🐱</div>
      <h1 style="font-size:24px;margin-bottom:6px;">KucingKu Sehat</h1>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:28px;">
        Platform rekam medis kucing berbasis AI
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;text-align:left;">
        <div class="pricing-card">
          <div class="pricing-badge">Basic</div>
          <div class="pricing-price">Rp 35.000<span>/bulan</span></div>
          <ul class="pricing-features">
            <li>✓ Hingga 3 profil kucing</li>
            <li>✓ Upload hasil lab (10x/bulan)</li>
            <li>✓ Chat Dr. Meow</li>
            <li>✓ Tren kesehatan</li>
          </ul>
        </div>
        <div class="pricing-card pricing-card-featured">
          <div class="pricing-badge">Premium ⭐</div>
          <div class="pricing-price">Rp 49.000<span>/bulan</span></div>
          <ul class="pricing-features">
            <li>✓ Kucing tidak terbatas</li>
            <li>✓ Upload lab tidak terbatas</li>
            <li>✓ Chat prioritas</li>
            <li>✓ Analisis tren AI</li>
          </ul>
        </div>
      </div>

      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:20px;text-align:left;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Punya kode voucher?</div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="pilotVoucher" placeholder="Masukkan kode..." style="
            flex:1;background:var(--bg-primary);border:1px solid var(--border);
            color:var(--text-primary);padding:8px 12px;border-radius:var(--radius-sm);
            font-size:13px;outline:none;text-transform:uppercase;font-family:var(--font-family);
          ">
          <button id="applyPilotVoucher" style="
            background:var(--bg-tertiary);border:1px solid var(--border);
            color:var(--text-primary);padding:8px 14px;border-radius:var(--radius-sm);
            font-size:13px;cursor:pointer;font-family:var(--font-family);white-space:nowrap;
          ">Pakai</button>
        </div>
        <div id="pilotVoucherMsg" style="font-size:12px;margin-top:6px;min-height:16px;"></div>
      </div>

      <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">
        Pembayaran via transfer bank / e-wallet — segera hadir
      </div>

      <button id="pilotContinueBtn" style="
        width:100%;background:var(--accent);color:#fff;border:none;
        padding:14px;border-radius:var(--radius-md);font-size:15px;
        font-weight:600;cursor:pointer;font-family:var(--font-family);
        transition:opacity 0.2s;
      ">Lanjut (Pilot Mode)</button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">
        Sesi uji coba tim — fitur lengkap tersedia
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#pilotVoucher').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  overlay.querySelector('#applyPilotVoucher').addEventListener('click', async () => {
    const code = overlay.querySelector('#pilotVoucher').value.trim();
    const msgEl = overlay.querySelector('#pilotVoucherMsg');
    if (!code) return;
    try {
      const result = await api.post('/api/subscribe/validate-voucher', { code });
      if (result.valid) {
        msgEl.style.color = 'var(--success)';
        msgEl.textContent = `✓ Voucher valid — diskon ${result.discount_percent}%`;
      } else {
        msgEl.style.color = 'var(--danger)';
        msgEl.textContent = result.error || 'Voucher tidak valid';
      }
    } catch {
      msgEl.style.color = 'var(--danger)';
      msgEl.textContent = 'Gagal memvalidasi voucher';
    }
  });

  overlay.querySelector('#pilotContinueBtn').addEventListener('click', () => {
    sessionStorage.setItem(PILOT_KEY, '1');
    _overlayActive = false;
    overlay.remove();
    if (appBody) appBody.style.visibility = '';
  });
}
