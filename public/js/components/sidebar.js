import { calculateAge, genderLabel } from '../utils.js';
import { getCurrentPath } from '../router.js';
import { showModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { api } from '../api.js';

export function renderSidebar(cat, labResults = []) {
  const age = calculateAge(cat.birth_date);
  const avatarContent = cat.photo_url
    ? `<img src="${cat.photo_url}" alt="${cat.name}">`
    : '🐱';

  const currentPath = getCurrentPath();
  const basePath = `/cats/${cat.id}`;

  const navItems = [
    { path: `${basePath}/chat`, icon: '💬', label: 'Chat Dr. Meow' },
    { path: `${basePath}/trends`, icon: '📊', label: 'Tren Kesehatan' },
    { path: `${basePath}/purchases`, icon: '🛒', label: 'Log Pembelian' },
  ];

  const navHtml = navItems.map(item => `
    <a href="#${item.path}" class="${currentPath === item.path ? 'active' : ''}">
      <span>${item.icon}</span> ${item.label}
    </a>
  `).join('');

  // Group lab results by month
  const groupedLabs = {};
  for (const lab of labResults) {
    const date = new Date(lab.test_date);
    const key = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    if (!groupedLabs[key]) groupedLabs[key] = [];
    groupedLabs[key].push(lab);
  }

  let timelineHtml = '';
  for (const [month, labs] of Object.entries(groupedLabs)) {
    timelineHtml += `<div class="sidebar-section-title">${month}</div>`;
    for (const lab of labs) {
      const date = new Date(lab.test_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      const statusColor = lab.status === 'confirmed' ? 'var(--success)' : 'var(--warning)';
      timelineHtml += `
        <a href="#/cats/${cat.id}/labs/${lab.id}" class="timeline-item" data-lab-id="${lab.id}" style="text-decoration:none;">
          <div class="dot" style="background:${statusColor}"></div>
          <div>
            <div style="font-size:13px;color:var(--text-primary);">${date} - ${lab.lab_name || 'Hasil Lab'}</div>
          </div>
        </a>
      `;
    }
  }

  if (labResults.length === 0) {
    timelineHtml = `
      <div style="padding:12px;font-size:13px;color:var(--text-muted);">
        Belum ada hasil lab. Upload hasil lab kucing kamu!
      </div>
    `;
  }

  return `
    <div class="dashboard-sidebar">
      <div class="sidebar-header">
        <div class="cat-avatar-sm">${avatarContent}</div>
        <div class="cat-meta">
          <h3>${cat.name}</h3>
          <p>${cat.breed || 'Kucing Domestik'} &bull; ${age}</p>
        </div>
        <button class="sidebar-edit-btn" data-cat-id="${cat.id}" title="Edit profil kucing">✏️</button>
      </div>
      <div class="sidebar-nav">${navHtml}</div>
      <div class="sidebar-section-title" style="margin-top:8px;">Riwayat Lab</div>
      <div style="padding:0 8px 8px;">${timelineHtml}</div>
      <div style="padding:8px;">
        <a href="#${basePath}/lab/upload" class="btn-primary" style="display:block;text-align:center;text-decoration:none;padding:8px;border-radius:8px;font-size:13px;">
          + Upload Hasil Lab
        </a>
      </div>
      <div style="flex:1;"></div>
      <div style="padding:12px;">
        <a href="#/cats" style="font-size:13px;color:var(--text-secondary);">&larr; Semua Kucing</a>
      </div>
    </div>
  `;
}
