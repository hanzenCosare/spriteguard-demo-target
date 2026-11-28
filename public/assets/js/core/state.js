import { emit } from './events.js';

const STORAGE_KEY = 'pulsemetrics_ui_prefs_v1';

function loadPreferences() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePreferences(prefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
}

const persisted = loadPreferences();

const appState = {
  route: 'overview',
  dateRange: persisted.dateRange || '30d',
  billingPeriod: persisted.billingPeriod || 'monthly',
  usageMetric: persisted.usageMetric || 'requests',
  mobileSidebarOpen: false,
  workspace: {
    workspaceName: 'Acme AI Studio',
    workspaceId: 'acme-ai-studio',
    timezone: 'America/Los_Angeles',
    dateFormat: 'MMM D, YYYY'
  },
  workspaces: [
    { id: 'acme-ai-studio', name: 'Acme AI Studio', plan: 'pro' },
    { id: 'acme-staging', name: 'Acme Staging', plan: 'free' }
  ],
  activeWorkspaceId: 'acme-ai-studio',
  profile: {
    name: 'Alex Morgan',
    email: 'alex@acme-ai.example',
    avatarInitials: 'AM',
    jobTitle: 'Head of AI Platform'
  },
  subscription: {
    plan: 'pro',
    planName: 'Pro',
    status: 'Active',
    billingPeriod: 'monthly',
    seatLimit: 5,
    seatsUsed: 4
  },
  searchIndex: {
    keys: [],
    members: [],
    activity: []
  }
};

export function getState() {
  return appState;
}

export function setState(patch, { persist = false, silent = false } = {}) {
  Object.assign(appState, patch);

  if (persist) {
    savePreferences({
      dateRange: appState.dateRange,
      billingPeriod: appState.billingPeriod,
      usageMetric: appState.usageMetric
    });
  }

  if (!silent) {
    emit('state:changed', { patch, state: appState });
  }
}

export function updateSearchIndex(partial) {
  appState.searchIndex = {
    ...appState.searchIndex,
    ...partial
  };
}
