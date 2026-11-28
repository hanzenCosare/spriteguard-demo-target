import { NAV_ITEMS, ICONS } from '../data/demo-data.js';
import { getState, setState } from '../core/state.js';
import { navigate } from '../core/router.js';
import { escapeHtml, formatDateTime } from '../core/formatters.js';
import { bindDropdown } from './dropdown.js';
import { showToast } from './toast.js';

function buildSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const state = getState();
  const groups = [];

  const navMatches = NAV_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
  ).map((item) => ({
    title: item.label,
    subtitle: item.description,
    route: item.id
  }));
  if (navMatches.length) groups.push({ label: 'Navigation', items: navMatches.slice(0, 4) });

  const keyMatches = (state.searchIndex.keys || [])
    .filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.prefix.toLowerCase().includes(q) ||
        k.environment.toLowerCase().includes(q)
    )
    .map((k) => ({
      title: k.name,
      subtitle: `${k.prefix} · ${k.status}`,
      route: 'api-keys'
    }));
  if (keyMatches.length) groups.push({ label: 'API Keys', items: keyMatches.slice(0, 4) });

  const memberMatches = (state.searchIndex.members || [])
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    )
    .map((m) => ({
      title: m.name,
      subtitle: `${m.email} · ${m.role}`,
      route: 'team'
    }));
  if (memberMatches.length) groups.push({ label: 'Team Members', items: memberMatches.slice(0, 4) });

  const actMatches = (state.searchIndex.activity || [])
    .filter(
      (a) =>
        a.event.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.resource.toLowerCase().includes(q)
    )
    .map((a) => ({
      title: a.event,
      subtitle: a.description,
      route: 'overview'
    }));
  if (actMatches.length) groups.push({ label: 'Recent Activity', items: actMatches.slice(0, 3) });

  return groups;
}

export function renderHeader() {
  const headerEl = document.getElementById('header-root');
  if (!headerEl) return;

  const state = getState();
  const currentNav = NAV_ITEMS.find((item) => item.id === state.route) || NAV_ITEMS[0];
  const recentNotifs = (state.searchIndex.activity || []).slice(0, 4);

  headerEl.innerHTML = `
    <div class="header-left">
      <button type="button" class="header-menu-btn" id="header-menu-btn" aria-label="Open navigation">
        ${ICONS.menu}
      </button>
      <div class="header-breadcrumb">
        <span class="header-crumb-root">${escapeHtml(state.workspace.workspaceName)}</span>
        <span class="header-crumb-sep" aria-hidden="true">/</span>
        <span class="header-crumb-current">${escapeHtml(currentNav.label)}</span>
      </div>
    </div>

    <div class="header-right">
      <div class="dropdown" id="workspace-dropdown">
        <button type="button" class="dropdown-trigger" data-dropdown-trigger aria-expanded="false">
          <span class="truncate" style="max-width: 130px;">${escapeHtml(state.workspace.workspaceName)}</span>
          ${ICONS.chevronDown}
        </button>
        <div class="dropdown-menu align-left" data-dropdown-menu>
          ${state.workspaces
            .map(
              (ws) => `
            <button
              type="button"
              class="dropdown-item ${ws.id === state.activeWorkspaceId ? 'selected' : ''}"
              data-workspace-id="${escapeHtml(ws.id)}"
            >
              <span>${escapeHtml(ws.name)}</span>
              <span class="badge badge-neutral">${escapeHtml(ws.plan)}</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="header-search-wrap" id="global-search-wrap">
        <span class="header-search-icon" aria-hidden="true">${ICONS.search}</span>
        <input
          type="search"
          id="global-search-input"
          class="header-search-input"
          placeholder="Search pages, keys, team..."
          autocomplete="off"
          aria-label="Search PulseMetrics"
        />
        <button type="button" id="global-search-clear" class="header-search-clear hidden" aria-label="Clear search">
          ${ICONS.close}
        </button>
        <div id="global-search-results" class="header-search-results hidden" role="listbox"></div>
      </div>

      <div class="dropdown" id="notif-dropdown">
        <button type="button" class="header-icon-btn" data-dropdown-trigger aria-label="Notifications" aria-expanded="false">
          ${ICONS.bell}
          ${recentNotifs.length ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}
        </button>
        <div class="dropdown-menu notif-panel" data-dropdown-menu>
          <div class="notif-panel-header">
            <span class="card-title">Recent Alerts</span>
            <button type="button" class="btn btn-ghost btn-sm" id="notif-view-all">View all</button>
          </div>
          <div class="notif-list">
            ${
              recentNotifs.length
                ? recentNotifs
                    .map(
                      (n) => `
                  <div class="notif-item">
                    <div class="notif-item-title">${escapeHtml(n.event)}</div>
                    <div class="notif-item-desc">${escapeHtml(n.description)}</div>
                    <div class="notif-item-time">${escapeHtml(formatDateTime(n.timestamp))}</div>
                  </div>
                `
                    )
                    .join('')
                : `<div class="notif-item"><div class="notif-item-desc">All caught up. No new notifications.</div></div>`
            }
          </div>
        </div>
      </div>

      <div class="dropdown" id="user-menu-dropdown">
        <button type="button" class="dropdown-trigger" data-dropdown-trigger aria-expanded="false" style="padding: 0 8px 0 4px;">
          <span class="avatar avatar-sm">${escapeHtml(state.profile.avatarInitials || 'AM')}</span>
          ${ICONS.chevronDown}
        </button>
        <div class="dropdown-menu" data-dropdown-menu>
          <div style="padding: 8px 10px;">
            <div style="font-weight: 600; font-size: 13px;">${escapeHtml(state.profile.name)}</div>
            <div class="text-secondary" style="font-size: 12px;">${escapeHtml(state.profile.email)}</div>
          </div>
          <div class="dropdown-divider"></div>
          <button type="button" class="dropdown-item" data-menu-nav="settings">Workspace Settings</button>
          <button type="button" class="dropdown-item" data-menu-nav="billing">Billing & Plans</button>
          <button type="button" class="dropdown-item" data-menu-nav="api-keys">API Keys</button>
        </div>
      </div>
    </div>
  `;

  // Mobile sidebar button
  const menuBtn = headerEl.querySelector('#header-menu-btn');
  menuBtn.addEventListener('click', () => {
    setState({ mobileSidebarOpen: !getState().mobileSidebarOpen });
  });

  // Dropdowns
  const wsDropdown = bindDropdown(headerEl.querySelector('#workspace-dropdown'));
  headerEl.querySelectorAll('[data-workspace-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.workspaceId;
      const chosen = getState().workspaces.find((w) => w.id === targetId);
      if (chosen) {
        setState({
          activeWorkspaceId: chosen.id,
          workspace: {
            ...getState().workspace,
            workspaceName: chosen.name,
            workspaceId: chosen.id
          }
        });
        showToast({
          type: 'info',
          title: `Switched workspace to ${chosen.name}`,
          description: 'Displaying local demo workspace context.'
        });
      }
      if (wsDropdown) wsDropdown.close();
    });
  });

  const notifDropdown = bindDropdown(headerEl.querySelector('#notif-dropdown'));
  const viewAllBtn = headerEl.querySelector('#notif-view-all');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      if (notifDropdown) notifDropdown.close();
      navigate('overview');
    });
  }

  const userDropdown = bindDropdown(headerEl.querySelector('#user-menu-dropdown'));
  headerEl.querySelectorAll('[data-menu-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (userDropdown) userDropdown.close();
      navigate(btn.dataset.menuNav);
    });
  });

  // Live search
  const searchInput = headerEl.querySelector('#global-search-input');
  const clearBtn = headerEl.querySelector('#global-search-clear');
  const resultsBox = headerEl.querySelector('#global-search-results');

  const closeSearchResults = () => {
    resultsBox.classList.add('hidden');
  };

  const renderResults = () => {
    const query = searchInput.value;
    clearBtn.classList.toggle('hidden', !query);
    if (!query.trim()) {
      closeSearchResults();
      return;
    }

    const groups = buildSearchResults(query);
    if (!groups.length) {
      resultsBox.innerHTML = `
        <div style="padding: 16px 10px; text-align: center;">
          <div style="font-size: 13px; font-weight: 500;">No results for "${escapeHtml(query)}"</div>
          <div class="text-secondary" style="font-size: 12px; margin-top: 2px;">Try searching for Overview, Billing, Production, or Alex.</div>
        </div>
      `;
    } else {
      resultsBox.innerHTML = groups
        .map(
          (group) => `
          <div class="search-group-label">${escapeHtml(group.label)}</div>
          ${group.items
            .map(
              (item) => `
            <button type="button" class="search-result-item" data-search-route="${escapeHtml(item.route)}">
              <div>
                <div class="search-result-title">${escapeHtml(item.title)}</div>
                <div class="search-result-sub">${escapeHtml(item.subtitle)}</div>
              </div>
              <span class="badge badge-neutral">Open</span>
            </button>
          `
            )
            .join('')}
        `
        )
        .join('');

      resultsBox.querySelectorAll('[data-search-route]').forEach((itemBtn) => {
        itemBtn.addEventListener('click', () => {
          const targetRoute = itemBtn.dataset.searchRoute;
          searchInput.value = '';
          clearBtn.classList.add('hidden');
          closeSearchResults();
          navigate(targetRoute);
        });
      });
    }

    resultsBox.classList.remove('hidden');
  };

  searchInput.addEventListener('input', renderResults);
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) renderResults();
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      closeSearchResults();
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    closeSearchResults();
    searchInput.focus();
  });
}

document.addEventListener(
  'click',
  (event) => {
    const wrap = document.getElementById('global-search-wrap');
    const resultsBox = document.getElementById('global-search-results');
    if (wrap && resultsBox && !wrap.contains(event.target)) {
      resultsBox.classList.add('hidden');
    }
  },
  { passive: true }
);
