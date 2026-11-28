const express = require('express');
const store = require('../services/mockStore');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.get('/', (_req, res) => {
  const state = store.getState();
  res.json({
    ok: true,
    settings: state.settings,
    workspaces: state.workspaces,
    activeWorkspaceId: state.activeWorkspaceId
  });
});

router.patch('/', (req, res) => {
  const body = req.body || {};
  const state = store.getState();
  const current = state.settings;

  const nextGeneral = { ...current.general, ...(body.general || {}) };
  const nextProfile = { ...current.profile, ...(body.profile || {}) };
  const nextNotifications = { ...current.notifications, ...(body.notifications || {}) };
  const nextSecurity = { ...current.security, ...(body.security || {}) };

  if (typeof nextGeneral.workspaceName !== 'string' || !nextGeneral.workspaceName.trim()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Workspace name is required.'
      }
    });
  }

  const normalizedSlug = String(nextGeneral.workspaceId || '').trim().toLowerCase();
  if (!SLUG_RE.test(normalizedSlug)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Workspace identifier must contain lowercase letters, numbers, and hyphens only.'
      }
    });
  }

  if (typeof nextProfile.name !== 'string' || !nextProfile.name.trim()) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Profile name is required.'
      }
    });
  }

  if (typeof nextProfile.email !== 'string' || !EMAIL_RE.test(nextProfile.email.trim())) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'A valid profile email address is required.'
      }
    });
  }

  const timeoutVal = Number(nextSecurity.sessionTimeoutMinutes);
  if (!Number.isFinite(timeoutVal) || timeoutVal < 15 || timeoutVal > 1440) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Session timeout must be between 15 and 1440 minutes.'
      }
    });
  }

  const rotationDays = Number(nextSecurity.apiKeyRotationDays);
  if (!Number.isFinite(rotationDays) || rotationDays < 7 || rotationDays > 365) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'API key rotation reminder must be between 7 and 365 days.'
      }
    });
  }

  nextGeneral.workspaceName = nextGeneral.workspaceName.trim();
  nextGeneral.workspaceId = normalizedSlug;
  nextProfile.name = nextProfile.name.trim();
  nextProfile.email = nextProfile.email.trim();
  nextProfile.avatarInitials = String(nextProfile.avatarInitials || 'AM')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  nextProfile.jobTitle = String(nextProfile.jobTitle || '').trim();
  nextSecurity.sessionTimeoutMinutes = timeoutVal;
  nextSecurity.apiKeyRotationDays = rotationDays;

  state.settings = {
    ...current,
    general: nextGeneral,
    profile: nextProfile,
    notifications: {
      usageThresholdAlerts: Boolean(nextNotifications.usageThresholdAlerts),
      billingNotifications: Boolean(nextNotifications.billingNotifications),
      securityNotifications: Boolean(nextNotifications.securityNotifications),
      weeklyUsageReports: Boolean(nextNotifications.weeklyUsageReports),
      productUpdates: Boolean(nextNotifications.productUpdates)
    },
    security: {
      sessionTimeoutMinutes: nextSecurity.sessionTimeoutMinutes,
      loginNotifications: Boolean(nextSecurity.loginNotifications),
      apiKeyRotationDays: nextSecurity.apiKeyRotationDays
    }
  };

  // Sync primary workspace and owner profile for cross-view consistency
  if (state.workspaces[0]) {
    state.workspaces[0].name = nextGeneral.workspaceName;
    state.workspaces[0].id = nextGeneral.workspaceId;
    state.activeWorkspaceId = nextGeneral.workspaceId;
  }

  const owner = state.members.find((m) => m.id === 'mem_01');
  if (owner) {
    owner.name = nextProfile.name;
    owner.email = nextProfile.email;
    owner.initials = nextProfile.avatarInitials;
    owner.title = nextProfile.jobTitle;
  }

  store.addActivity({
    event: 'Workspace settings updated',
    description: `Saved workspace and profile preferences for ${nextGeneral.workspaceName}.`,
    resource: `workspace/${nextGeneral.workspaceId}`,
    status: 'Success',
    metadata: { timezone: nextGeneral.timezone }
  });

  return res.json({
    ok: true,
    settings: state.settings
  });
});

module.exports = router;
