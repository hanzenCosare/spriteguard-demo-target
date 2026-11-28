import { NAV_ITEMS, ICONS } from '../data/demo-data.js';
import { getState, setState } from '../core/state.js';
import { navigate } from '../core/router.js';
import { escapeHtml } from '../core/formatters.js';

export function renderSidebar() {
  const sidebarEl = document.getElementById('sidebar-root');
  const backdropEl = document.getElementById('sidebar-backdrop');
  if (!sidebarEl) return;

  const state = getState();
  const primaryNav = NAV_ITEMS.filter((item) => item.section === 'primary');
  const secondaryNav = NAV_ITEMS.filter((item) => item.section === 'secondary');

  sidebarEl.classList.toggle('open', state.mobileSidebarOpen);
  if (backdropEl) {
    backdropEl.classList.toggle('open', state.mobileSidebarOpen);
    backdropEl.setAttribute('aria-hidden', String(!state.mobileSidebarOpen));
  }

  const renderNavLink = (item) => {
    const isActive = state.route === item.id;
    return `
      <li>
        <a
          href="${escapeHtml(item.path)}"
          class="sidebar-link ${isActive ? 'active' : ''}"
          data-route-id="${escapeHtml(item.id)}"
          aria-current="${isActive ? 'page' : 'false'}"
        >
          ${ICONS[item.icon] || ''}
          <span>${escapeHtml(item.label)}</span>
        </a>
      </li>
    `;
  };

  sidebarEl.innerHTML = `
    <div class="sidebar-brand">
      <a href="/" class="brand-lockup" data-route-id="overview">
        <span class="brand-mark" aria-hidden="true">${ICONS.brand}</span>
        <div class="brand-meta">
          <div class="brand-name">PulseMetrics</div>
          <div class="brand-workspace">${escapeHtml(state.workspace.workspaceName)}</div>
        </div>
      </a>
      <button type="button" class="sidebar-close-btn" id="sidebar-close-btn" aria-label="Close navigation">
        ${ICONS.close}
      </button>
    </div>

    <nav class="sidebar-nav" aria-label="Dashboard sections">
      <div>
        <div class="sidebar-section-label">Platform</div>
        <ul class="sidebar-list">
          ${primaryNav.map(renderNavLink).join('')}
        </ul>
      </div>

      <div>
        <div class="sidebar-section-label">Workspace</div>
        <ul class="sidebar-list">
          ${secondaryNav.map(renderNavLink).join('')}
        </ul>
      </div>
    </nav>

    <div class="sidebar-footer">
      <button type="button" class="sidebar-plan-card" data-route-id="billing" title="Manage subscription plan">
        <div class="sidebar-plan-info">
          <div class="sidebar-plan-title">${escapeHtml(state.subscription.planName)} Plan</div>
          <div class="sidebar-plan-meta">
            ${escapeHtml(state.subscription.billingPeriod === 'annual' ? 'Annual billing' : 'Monthly billing')}
          </div>
        </div>
        <span class="sidebar-plan-badge">${escapeHtml(state.subscription.status)}</span>
      </button>

      <button type="button" class="sidebar-user-btn" data-route-id="settings" title="Account settings">
        <span class="avatar avatar-dark">${escapeHtml(state.profile.avatarInitials || 'AM')}</span>
        <div class="sidebar-user-meta">
          <div class="sidebar-user-name">${escapeHtml(state.profile.name)}</div>
          <div class="sidebar-user-email">${escapeHtml(state.profile.email)}</div>
        </div>
      </button>
    </div>
  `;

  sidebarEl.querySelectorAll('[data-route-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(el.dataset.routeId);
    });
  });

  const closeBtn = sidebarEl.querySelector('#sidebar-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      setState({ mobileSidebarOpen: false });
    });
  }
}

export function bindSidebarBackdrop() {
  const backdropEl = document.getElementById('sidebar-backdrop');
  if (!backdropEl) return;
  backdropEl.addEventListener('click', () => {
    setState({ mobileSidebarOpen: false });
  });
}
