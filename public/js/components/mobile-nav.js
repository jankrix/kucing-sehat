import { getCurrentPath } from '../router.js';

export function renderMobileNav(cat) {
  const existing = document.getElementById('mobileNav');
  if (existing) existing.remove();

  const nav = document.createElement('nav');
  nav.id = 'mobileNav';
  nav.className = 'mobile-nav';

  const base = `/cats/${cat.id}`;
  const current = getCurrentPath();

  const items = [
    { path: `${base}/chat`,      icon: '💬', label: 'Chat' },
    { path: `${base}/lab/upload`,icon: '🧪', label: 'Lab' },
    { path: `${base}/trends`,    icon: '📊', label: 'Tren' },
    { path: `${base}/purchases`, icon: '🛒', label: 'Log' },
  ];

  nav.innerHTML = items.map(item => `
    <a href="#${item.path}" class="mobile-nav-item ${current === item.path ? 'active' : ''}">
      <span class="mobile-nav-icon">${item.icon}</span>
      <span class="mobile-nav-label">${item.label}</span>
    </a>
  `).join('');

  document.body.appendChild(nav);
  return () => nav.remove();
}
