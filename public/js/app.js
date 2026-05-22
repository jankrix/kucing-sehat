import { initSupabase } from './supabase.js';
import { state } from './state.js';
import { addRoute, startRouter, navigate } from './router.js';
import { renderHeader } from './components/header.js';
import { initSubscriptionPrompt } from './components/subscription-prompt.js';

async function init() {
  // Initialize Supabase client
  await initSupabase();

  // Set up header
  const headerEl = document.getElementById('app-header');
  renderHeader(headerEl);

  // Register routes
  addRoute('/login', async (container) => {
    const { render } = await import('./pages/login.js');
    await render(container);
  });

  addRoute('/cats', async (container) => {
    requireAuth();
    const { render } = await import('./pages/cats.js');
    await render(container);
  });

  addRoute('/chat', async (container) => {
    requireAuth();
    const { render } = await import('./pages/cat-picker.js');
    await render(container, (catId) => `/cats/${catId}/chat`);
  });

  addRoute('/cats/:catId/chat', async (container, params) => {
    requireAuth();
    const { render } = await import('./pages/chat.js');
    await render(container, params);
  });

  addRoute('/cats/:catId/trends', async (container, params) => {
    requireAuth();
    const { render } = await import('./pages/trends.js');
    await render(container, params);
  });

  addRoute('/cats/:catId/purchases', async (container, params) => {
    requireAuth();
    const { render } = await import('./pages/purchases.js');
    await render(container, params);
  });

  addRoute('/cats/:catId/lab/upload', async (container, params) => {
    requireAuth();
    const { render } = await import('./pages/lab-upload.js');
    await render(container, params);
  });

  addRoute('/cats/:catId/labs/:labId', async (container, params) => {
    requireAuth();
    const { render } = await import('./pages/lab-detail.js');
    await render(container, params);
  });

  // Default route: /
  addRoute('/', async () => {
    if (state.user) {
      navigate('/cats');
    } else {
      navigate('/login');
    }
  });

  // Start routing
  const path = window.location.hash.slice(1) || '/';
  if (!state.user && path !== '/login') {
    navigate('/login');
  }

  startRouter();
}

function requireAuth() {
  if (!state.user) {
    navigate('/login');
    throw new Error('Not authenticated');
  }
}

// Track whether we've already run the subscription prompt for this login session
let _subPromptRan = false;

// Handle auth state changes - show/hide header + subscription prompt (once per login)
state.onChange(() => {
  const headerEl = document.getElementById('app-header');
  if (headerEl) {
    headerEl.style.display = state.user ? '' : 'none';
  }

  if (state.user && !_subPromptRan) {
    _subPromptRan = true;
    initSubscriptionPrompt();
  } else if (!state.user) {
    _subPromptRan = false; // reset on logout so it shows again next login
  }
});

init().catch(err => {
  console.error('App init error:', err);
  document.getElementById('app-body').innerHTML = `
    <div class="empty-state mt-3">
      <div class="emoji">⚠️</div>
      <h3>Gagal memuat aplikasi</h3>
      <p>Pastikan server berjalan dan konfigurasi Supabase sudah benar.</p>
    </div>
  `;
});
