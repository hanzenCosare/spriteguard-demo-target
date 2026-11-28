import { api } from './api/client.js';
import { on } from './core/events.js';
import { initRouter } from './core/router.js';
import { getState, setState, updateSearchIndex } from './core/state.js';
import { bindSidebarBackdrop, renderSidebar } from './components/sidebar.js';
import { renderHeader } from './components/header.js';
import { renderOverviewView } from './views/overview.js';
import { renderUsageView } from './views/usage.js';
import { renderApiKeysView } from './views/api-keys.js';
import { renderBillingView } from './views/billing.js';
import { renderTeamView } from './views/team.js';
import { renderSettingsView } from './views/settings.js';

const VIEW_RENDERERS = {
  overview: renderOverviewView,
  usage: renderUsageView,
  'api-keys': renderApiKeysView,
  billing: renderBillingView,
  team: renderTeamView,
  settings: renderSettingsView
};

async function hydrateShellState() {
  try {
    const [settingsRes, billingRes, keysRes, teamRes, activityRes] = await Promise.all([
      api.getSettings(),
      api.getBillingSummary(),
      api.getKeys(),
      api.getTeam(),
      api.getDashboardActivity(10)
    ]);

    updateSearchIndex({
      keys: keysRes.items || [],
      members: teamRes.members || [],
      activity: activityRes.items || []
    });

    setState({
      workspace: settingsRes.settings.general,
      workspaces: settingsRes.workspaces || getState().workspaces,
      activeWorkspaceId: settingsRes.activeWorkspaceId || getState().activeWorkspaceId,
      profile: settingsRes.settings.profile,
      subscription: billingRes.subscription
    });
  } catch (err) {
    console.warn('[pulsemetrics] Initial hydration fallback:', err.message);
  }
}

function renderActiveView() {
  const viewRoot = document.getElementById('view-root');
  if (!viewRoot) return;
  const routeId = getState().route || 'overview';
  const renderer = VIEW_RENDERERS[routeId] || renderOverviewView;
  renderer(viewRoot);
}

async function bootstrap() {
  initRouter();
  bindSidebarBackdrop();
  renderSidebar();
  renderHeader();

  on('state:changed', () => {
    renderSidebar();
    renderHeader();
  });

  on('route:changed', () => {
    renderSidebar();
    renderHeader();
    renderActiveView();
    window.scrollTo({ top: 0, behavior: 'auto' });
  });

  await hydrateShellState();
  renderActiveView();
}

bootstrap();
