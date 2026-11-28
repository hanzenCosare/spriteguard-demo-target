import { NAV_ITEMS } from '../data/demo-data.js';
import { setState } from './state.js';
import { emit } from './events.js';

const routeByPath = new Map(NAV_ITEMS.map((item) => [item.path, item]));
const routeById = new Map(NAV_ITEMS.map((item) => [item.id, item]));

export function resolveRoute(pathname) {
  const clean = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  if (routeByPath.has(clean)) {
    return routeByPath.get(clean);
  }
  if (clean.startsWith('/mock-checkout/')) {
    return routeById.get('billing');
  }
  return routeById.get('overview');
}

export function navigate(target, { replace = false } = {}) {
  const route = routeById.get(target) || resolveRoute(target);
  if (!route) return;

  if (window.location.pathname !== route.path) {
    if (replace) {
      window.history.replaceState({ routeId: route.id }, '', route.path);
    } else {
      window.history.pushState({ routeId: route.id }, '', route.path);
    }
  }

  setState({ route: route.id, mobileSidebarOpen: false });
  document.title = `${route.label} — PulseMetrics`;
  emit('route:changed', route);
}

export function initRouter() {
  window.addEventListener('popstate', () => {
    const route = resolveRoute(window.location.pathname);
    setState({ route: route.id, mobileSidebarOpen: false });
    document.title = `${route.label} — PulseMetrics`;
    emit('route:changed', route);
  });

  const initial = resolveRoute(window.location.pathname);
  setState({ route: initial.id }, { silent: true });
  document.title = `${initial.label} — PulseMetrics`;
  return initial;
}
