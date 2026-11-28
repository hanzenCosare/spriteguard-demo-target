import { api } from '../api/client.js';
import { DATE_FORMATS, TIMEZONES } from '../data/demo-data.js';
import { setState } from '../core/state.js';
import { escapeHtml } from '../core/formatters.js';
import { renderErrorState, renderPageSkeleton } from '../components/loading.js';
import { showToast } from '../components/toast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function renderSettingsView(container) {
  container.innerHTML = renderPageSkeleton();

  try {
    const res = await api.getSettings();
    const { settings } = res;

    container.innerHTML = `
      <form id="settings-form" class="stack-lg" novalidate>
        <div class="page-header">
          <div>
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Manage your workspace preferences and account configuration.</p>
          </div>
          <div class="page-header-actions">
            <button type="submit" class="btn btn-primary" id="settings-save-top-btn">
              Save Changes
            </button>
          </div>
        </div>

        <div class="settings-grid">
          <section class="settings-section">
            <div class="settings-section-header">
              <h2 class="section-title">General</h2>
              <p class="section-description">Workspace identity and regional display defaults.</p>
            </div>
            <div class="settings-section-body">
              <div class="form-group">
                <label class="form-label" for="set-ws-name">Workspace name<span class="form-required">*</span></label>
                <input type="text" id="set-ws-name" class="form-input" value="${escapeHtml(settings.general.workspaceName)}" required />
                <div class="form-error" id="err-ws-name"></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="set-ws-id">Workspace identifier<span class="form-required">*</span></label>
                <input type="text" id="set-ws-id" class="form-input text-mono" value="${escapeHtml(settings.general.workspaceId)}" required />
                <div class="form-error" id="err-ws-id"></div>
              </div>
              <div class="grid grid-cols-2">
                <div class="form-group">
                  <label class="form-label" for="set-timezone">Default timezone</label>
                  <select id="set-timezone" class="form-select">
                    ${TIMEZONES.map(
                      (tz) =>
                        `<option value="${escapeHtml(tz)}" ${settings.general.timezone === tz ? 'selected' : ''}>${escapeHtml(tz)}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="set-date-format">Default date format</label>
                  <select id="set-date-format" class="form-select">
                    ${DATE_FORMATS.map(
                      (fmt) =>
                        `<option value="${escapeHtml(fmt)}" ${settings.general.dateFormat === fmt ? 'selected' : ''}>${escapeHtml(fmt)}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-header">
              <h2 class="section-title">Profile</h2>
              <p class="section-description">Personal details displayed across workspace menus and audit trails.</p>
            </div>
            <div class="settings-section-body">
              <div class="form-group">
                <label class="form-label" for="set-profile-name">Full name<span class="form-required">*</span></label>
                <input type="text" id="set-profile-name" class="form-input" value="${escapeHtml(settings.profile.name)}" required />
                <div class="form-error" id="err-profile-name"></div>
              </div>
              <div class="form-group">
                <label class="form-label" for="set-profile-email">Email address<span class="form-required">*</span></label>
                <input type="email" id="set-profile-email" class="form-input" value="${escapeHtml(settings.profile.email)}" required />
                <div class="form-error" id="err-profile-email"></div>
              </div>
              <div class="grid grid-cols-2">
                <div class="form-group">
                  <label class="form-label" for="set-profile-initials">Avatar initials</label>
                  <input type="text" id="set-profile-initials" class="form-input" maxlength="2" value="${escapeHtml(settings.profile.avatarInitials)}" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="set-profile-title">Job title</label>
                  <input type="text" id="set-profile-title" class="form-input" value="${escapeHtml(settings.profile.jobTitle)}" />
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-header">
              <h2 class="section-title">Notifications</h2>
              <p class="section-description">Choose which workspace events trigger alerts.</p>
            </div>
            <div class="settings-section-body" style="gap: 0;">
              ${[
                {
                  id: 'notif-usage',
                  key: 'usageThresholdAlerts',
                  label: 'Usage threshold alerts',
                  desc: 'Notify when monthly API requests exceed 75% of your plan quota.'
                },
                {
                  id: 'notif-billing',
                  key: 'billingNotifications',
                  label: 'Billing notifications',
                  desc: 'Receive invoice receipts and subscription change summaries.'
                },
                {
                  id: 'notif-security',
                  key: 'securityNotifications',
                  label: 'Security notifications',
                  desc: 'Alert on API key creation, revocation, or role changes.'
                },
                {
                  id: 'notif-weekly',
                  key: 'weeklyUsageReports',
                  label: 'Weekly usage reports',
                  desc: 'Deliver a weekly digest of token spend and model performance.'
                },
                {
                  id: 'notif-product',
                  key: 'productUpdates',
                  label: 'Product updates',
                  desc: 'Occasional platform release notes and model pricing updates.'
                }
              ]
                .map(
                  (item) => `
                <div class="toggle-row">
                  <div>
                    <div style="font-size: 13.5px; font-weight: 500;">${escapeHtml(item.label)}</div>
                    <div class="text-secondary" style="font-size: 12px;">${escapeHtml(item.desc)}</div>
                  </div>
                  <label class="toggle-switch">
                    <input type="checkbox" id="${item.id}" ${settings.notifications[item.key] ? 'checked' : ''} />
                    <span class="toggle-track"></span>
                  </label>
                </div>
              `
                )
                .join('')}
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-header">
              <h2 class="section-title">Security Preferences</h2>
              <p class="section-description">Mock workspace security policies and active session view.</p>
            </div>
            <div class="settings-section-body">
              <div class="grid grid-cols-2">
                <div class="form-group">
                  <label class="form-label" for="set-session-timeout">Session timeout (minutes)</label>
                  <input
                    type="number"
                    id="set-session-timeout"
                    class="form-input tabular-nums"
                    min="15"
                    max="1440"
                    value="${escapeHtml(settings.security.sessionTimeoutMinutes)}"
                  />
                  <div class="form-error" id="err-session-timeout"></div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="set-key-rotation">Key rotation reminder (days)</label>
                  <input
                    type="number"
                    id="set-key-rotation"
                    class="form-input tabular-nums"
                    min="7"
                    max="365"
                    value="${escapeHtml(settings.security.apiKeyRotationDays)}"
                  />
                  <div class="form-error" id="err-key-rotation"></div>
                </div>
              </div>

              <div class="toggle-row" style="padding: 8px 0;">
                <div>
                  <div style="font-size: 13.5px; font-weight: 500;">Login notifications</div>
                  <div class="text-secondary" style="font-size: 12px;">Record mock alerts when new sessions access this workspace.</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="sec-login-notif" ${settings.security.loginNotifications ? 'checked' : ''} />
                  <span class="toggle-track"></span>
                </label>
              </div>

              <div class="stack-sm">
                <div class="label-meta">Active Sessions (Mock)</div>
                ${(settings.activeSessions || [])
                  .map(
                    (sess) => `
                  <div class="session-item">
                    <div>
                      <div style="font-size: 13px; font-weight: 500;">${escapeHtml(sess.device)}</div>
                      <div class="text-secondary" style="font-size: 12px;">${escapeHtml(sess.location)} · ${escapeHtml(sess.lastActive)}</div>
                    </div>
                    <span class="badge ${sess.current ? 'badge-success' : 'badge-neutral'}">
                      ${sess.current ? 'Current' : 'Idle'}
                    </span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </section>
        </div>

        <div class="settings-save-bar">
          <div class="text-secondary" style="font-size: 12.5px;">
            Changes persist in the local mock backend memory until the server restarts.
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn btn-secondary" id="settings-reset-btn">Discard</button>
            <button type="submit" class="btn btn-primary" id="settings-save-btn">Save Changes</button>
          </div>
        </div>
      </form>
    `;

    const form = container.querySelector('#settings-form');
    const saveButtons = [
      container.querySelector('#settings-save-top-btn'),
      container.querySelector('#settings-save-btn')
    ];

    container.querySelector('#settings-reset-btn').addEventListener('click', () => {
      renderSettingsView(container);
      showToast({ type: 'info', title: 'Unsaved changes discarded' });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Clear previous errors
      ['ws-name', 'ws-id', 'profile-name', 'profile-email', 'session-timeout', 'key-rotation'].forEach(
        (key) => {
          const errEl = container.querySelector(`#err-${key}`);
          if (errEl) errEl.textContent = '';
        }
      );

      const workspaceName = container.querySelector('#set-ws-name').value.trim();
      const workspaceId = container.querySelector('#set-ws-id').value.trim().toLowerCase();
      const profileName = container.querySelector('#set-profile-name').value.trim();
      const profileEmail = container.querySelector('#set-profile-email').value.trim();
      const sessionTimeoutMinutes = Number(container.querySelector('#set-session-timeout').value);
      const apiKeyRotationDays = Number(container.querySelector('#set-key-rotation').value);

      let hasError = false;
      if (!workspaceName) {
        container.querySelector('#err-ws-name').textContent = 'Workspace name is required.';
        hasError = true;
      }
      if (!SLUG_RE.test(workspaceId)) {
        container.querySelector('#err-ws-id').textContent = 'Use lowercase letters, numbers, and hyphens only.';
        hasError = true;
      }
      if (!profileName) {
        container.querySelector('#err-profile-name').textContent = 'Profile name is required.';
        hasError = true;
      }
      if (!EMAIL_RE.test(profileEmail)) {
        container.querySelector('#err-profile-email').textContent = 'Enter a valid email address.';
        hasError = true;
      }
      if (!Number.isFinite(sessionTimeoutMinutes) || sessionTimeoutMinutes < 15 || sessionTimeoutMinutes > 1440) {
        container.querySelector('#err-session-timeout').textContent = 'Must be 15–1440 minutes.';
        hasError = true;
      }
      if (!Number.isFinite(apiKeyRotationDays) || apiKeyRotationDays < 7 || apiKeyRotationDays > 365) {
        container.querySelector('#err-key-rotation').textContent = 'Must be 7–365 days.';
        hasError = true;
      }

      if (hasError) {
        showToast({
          type: 'error',
          title: 'Please fix validation errors',
          description: 'Review the highlighted fields before saving.'
        });
        return;
      }

      saveButtons.forEach((b) => {
        b.disabled = true;
        b.innerHTML = `<span class="spinner"></span> Saving...`;
      });

      try {
        const updated = await api.updateSettings({
          general: {
            workspaceName,
            workspaceId,
            timezone: container.querySelector('#set-timezone').value,
            dateFormat: container.querySelector('#set-date-format').value
          },
          profile: {
            name: profileName,
            email: profileEmail,
            avatarInitials: container.querySelector('#set-profile-initials').value.trim() || 'AM',
            jobTitle: container.querySelector('#set-profile-title').value.trim()
          },
          notifications: {
            usageThresholdAlerts: container.querySelector('#notif-usage').checked,
            billingNotifications: container.querySelector('#notif-billing').checked,
            securityNotifications: container.querySelector('#notif-security').checked,
            weeklyUsageReports: container.querySelector('#notif-weekly').checked,
            productUpdates: container.querySelector('#notif-product').checked
          },
          security: {
            sessionTimeoutMinutes,
            loginNotifications: container.querySelector('#sec-login-notif').checked,
            apiKeyRotationDays
          }
        });

        setState({
          workspace: updated.settings.general,
          profile: updated.settings.profile
        });

        showToast({
          type: 'success',
          title: 'Settings saved',
          description: 'Workspace and account preferences updated.'
        });
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Could not save settings',
          description: err.message
        });
      } finally {
        saveButtons.forEach((b) => {
          b.disabled = false;
          b.textContent = 'Save Changes';
        });
      }
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Failed to load workspace settings',
      message: err.message
    });
    const retry = container.querySelector('#view-retry-btn');
    if (retry) retry.addEventListener('click', () => renderSettingsView(container));
  }
}
