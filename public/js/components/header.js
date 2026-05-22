import { state } from '../state.js';
import { navigate } from '../router.js';
import { signOut } from '../supabase.js';

export function renderHeader(container) {
  container.innerHTML = `
    <div class="app-header">
      <div class="logo" id="headerLogo">
        <div class="avatar">🐱</div>
        <span>KucingKu Sehat</span>
      </div>
      <div class="spacer"></div>
      <a href="#/chat" class="header-chat-btn" id="headerChatBtn" style="display:none;">💬 Chat Dr. Meow</a>
      <div class="user-menu" id="userMenu"></div>
    </div>
  `;

  container.querySelector('#headerLogo').addEventListener('click', () => {
    navigate('/cats');
  });

  updateUserMenu();
  return state.onChange(updateUserMenu);
}

function updateUserMenu() {
  const menu = document.getElementById('userMenu');
  if (!menu) return;

  if (state.user) {
    const chatBtn = document.getElementById('headerChatBtn');
    if (chatBtn) chatBtn.style.display = '';

    menu.innerHTML = `
      <span class="user-email">${state.user.email || ''}</span>
      <button class="btn btn-sm" id="logoutBtn">Keluar</button>
    `;
    menu.querySelector('#logoutBtn').addEventListener('click', async () => {
      await signOut();
      navigate('/login');
    });
  } else {
    const chatBtn = document.getElementById('headerChatBtn');
    if (chatBtn) chatBtn.style.display = 'none';
    menu.innerHTML = '';
  }
}
