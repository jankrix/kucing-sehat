// Simple hash-based SPA router

const routes = [];
let currentCleanup = null;

export function addRoute(pattern, handler) {
  // Convert pattern like "/cats/:catId/chat" to regex
  const paramNames = [];
  const regexStr = pattern.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({ pattern, regex: new RegExp(`^${regexStr}$`), paramNames, handler });
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentPath() {
  return window.location.hash.slice(1) || '/';
}

export async function handleRoute() {
  const path = getCurrentPath();
  const container = document.getElementById('app-body');
  if (!container) return;

  // Run cleanup for previous page
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      const cleanup = await route.handler(container, params);
      if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
      }
      return;
    }
  }

  // 404 fallback
  container.innerHTML = `
    <div class="empty-state" style="margin-top:80px;">
      <div class="emoji">🔍</div>
      <h3>Halaman tidak ditemukan</h3>
      <p><a href="#/cats">Kembali ke beranda</a></p>
    </div>
  `;
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
