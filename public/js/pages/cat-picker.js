import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { calculateAge } from '../utils.js';

// Shown when user navigates to /chat without a specific cat.
// Auto-redirects if only one cat exists.
export async function render(container, destination) {
  container.innerHTML = `<div class="cats-page"><div class="spinner mt-3" style="margin:auto;"></div></div>`;

  let cats = state.cats;
  if (!cats?.length) {
    try {
      cats = await api.get('/api/cats');
      state.setCats(cats);
    } catch {
      container.innerHTML = `<div class="empty-state mt-3"><p>Gagal memuat daftar kucing.</p></div>`;
      return;
    }
  }

  if (cats.length === 0) {
    navigate('/cats');
    return;
  }

  // Only one cat — skip picker entirely
  if (cats.length === 1) {
    navigate(destination(cats[0].id));
    return;
  }

  container.innerHTML = `
    <div class="cats-page">
      <div class="page-header" style="margin-bottom:8px;">
        <h2>Pilih Kucing</h2>
        <p style="font-size:14px;color:var(--text-secondary);margin-top:4px;">Kucing mana yang ingin kamu tanyakan?</p>
      </div>
      <div class="cat-grid">
        ${cats.map(cat => {
          const age = calculateAge(cat.birth_date);
          const avatar = cat.photo_url
            ? `<img src="${cat.photo_url}" alt="${cat.name}" style="width:100%;height:100%;object-fit:cover;">`
            : '🐱';
          return `
            <div class="cat-card" data-cat-id="${cat.id}" style="cursor:pointer;">
              <div class="cat-avatar">${avatar}</div>
              <div class="cat-info">
                <h3>${cat.name}</h3>
                <p>${cat.breed || 'Kucing Domestik'}</p>
                <p style="font-size:12px;color:var(--text-muted);">${age}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => navigate(destination(card.dataset.catId)));
  });
}
