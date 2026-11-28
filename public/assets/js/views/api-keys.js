import { api } from '../api/client.js';
import { ICONS } from '../data/demo-data.js';
import { getState, updateSearchIndex } from '../core/state.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatEnvironment,
  formatNumber,
  formatPermission,
  statusBadgeClass
} from '../core/formatters.js';
import { renderDataTable, sortRows } from '../components/data-table.js';
import { renderErrorState, renderPageSkeleton } from '../components/loading.js';
import { confirmModal, openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const keysViewState = {
  searchQuery: '',
  statusFilter: 'all',
  sortKey: 'createdAt',
  sortDir: 'desc'
};

async function copyToClipboard(text, successTitle) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast({ type: 'success', title: successTitle });
  } catch {
    showToast({
      type: 'warning',
      title: 'Clipboard unavailable',
      description: 'Copy the displayed value manually.'
    });
  }
}

function openKeyRevealModal(createdRes) {
  openModal({
    title: 'Test API Key Generated',
    subtitle: 'Copy this fictional test key now. Once closed, only the masked prefix is displayed.',
    size: 'md',
    closeOnBackdrop: false,
    bodyHtml: `
      <div class="key-reveal-box">
        <code class="key-reveal-value" id="generated-key-value">${escapeHtml(createdRes.plainTextOnce)}</code>
        <button type="button" class="btn btn-secondary btn-sm" id="copy-generated-key-btn">
          ${ICONS.copy}
          <span>Copy</span>
        </button>
      </div>
      <div class="notice-box notice-box-info">
        <strong>Demo Notice:</strong> ${escapeHtml(createdRes.notice)}
      </div>
    `,
    footerHtml: `<button type="button" class="btn btn-primary" data-modal-close>Done</button>`,
    onMount: (root) => {
      root.querySelector('#copy-generated-key-btn').addEventListener('click', () => {
        copyToClipboard(createdRes.plainTextOnce, 'Mock test key copied to clipboard');
      });
    }
  });
}

function openCreateKeyModal(onCreated) {
  openModal({
    title: 'Generate Test Key',
    subtitle: 'Create a fictional mock key with a non-production pm_test_ prefix.',
    size: 'md',
    bodyHtml: `
      <form id="create-key-form" class="stack-md" novalidate>
        <div class="form-group">
          <label class="form-label" for="key-name-input">Key name<span class="form-required">*</span></label>
          <input type="text" id="key-name-input" class="form-input" placeholder="e.g. Staging Inference Worker" maxlength="64" required />
          <div class="form-error" id="key-name-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="key-desc-input">Description</label>
          <input type="text" id="key-desc-input" class="form-input" placeholder="Optional usage notes" maxlength="180" />
        </div>
        <div class="grid grid-cols-2">
          <div class="form-group">
            <label class="form-label" for="key-env-select">Environment</label>
            <select id="key-env-select" class="form-select">
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="testing">Testing</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="key-perm-select">Permissions</label>
            <select id="key-perm-select" class="form-select">
              <option value="read_write">Read & Write</option>
              <option value="read_only">Read Only</option>
              <option value="full_access">Full Access</option>
            </select>
          </div>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" form="create-key-form" class="btn btn-primary" id="create-key-submit">
        Generate Key
      </button>
    `,
    onMount: (root, close) => {
      const form = root.querySelector('#create-key-form');
      const nameInput = root.querySelector('#key-name-input');
      const nameError = root.querySelector('#key-name-error');
      const submitBtn = root.querySelector('#create-key-submit');

      nameInput.addEventListener('input', () => {
        nameInput.classList.remove('invalid');
        nameError.textContent = '';
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.classList.add('invalid');
          nameError.textContent = 'Please provide a descriptive name for this test key.';
          nameInput.focus();
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Generating...`;

        try {
          const res = await api.createKey({
            name,
            description: root.querySelector('#key-desc-input').value.trim(),
            environment: root.querySelector('#key-env-select').value,
            permissions: root.querySelector('#key-perm-select').value
          });
          close();
          await onCreated();
          openKeyRevealModal(res);
          showToast({
            type: 'success',
            title: 'Test API key created',
            description: `"${res.key.name}" added to your workspace.`
          });
        } catch (err) {
          nameInput.classList.add('invalid');
          nameError.textContent = err.message;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Generate Key';
        }
      });
    }
  });
}

function openKeyDetailModal(key) {
  openModal({
    title: key.name,
    subtitle: 'Fictional workspace API key metadata',
    size: 'md',
    bodyHtml: `
      <dl class="detail-list">
        <dt>Key ID</dt>
        <dd class="text-mono">${escapeHtml(key.id)}</dd>
        <dt>Masked Value</dt>
        <dd><span class="code-pill">${escapeHtml(key.maskedValue)}</span></dd>
        <dt>Status</dt>
        <dd><span class="badge ${statusBadgeClass(key.status)}"><span class="badge-dot"></span>${escapeHtml(formatEnvironment(key.status))}</span></dd>
        <dt>Environment</dt>
        <dd>${escapeHtml(formatEnvironment(key.environment))}</dd>
        <dt>Permissions</dt>
        <dd>${escapeHtml(formatPermission(key.permissions))}</dd>
        <dt>Description</dt>
        <dd>${escapeHtml(key.description || 'No description provided.')}</dd>
        <dt>Created</dt>
        <dd>${escapeHtml(formatDateTime(key.createdAt))}</dd>
        <dt>Last Used</dt>
        <dd>${escapeHtml(key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'Never used')}</dd>
        <dt>Mock Requests</dt>
        <dd class="tabular-nums">${escapeHtml(formatNumber(key.requestsCount))}</dd>
      </dl>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" id="detail-copy-prefix">Copy prefix</button>
      <button type="button" class="btn btn-primary" data-modal-close>Close</button>
    `,
    onMount: (root) => {
      root.querySelector('#detail-copy-prefix').addEventListener('click', () => {
        copyToClipboard(key.prefix, 'Key prefix copied');
      });
    }
  });
}

export async function renderApiKeysView(container) {
  container.innerHTML = renderPageSkeleton();

  try {
    const data = await api.getKeys();
    const { summary, items } = data;
    const dateFmt = getState().workspace.dateFormat;

    updateSearchIndex({ keys: items });

    container.innerHTML = `
      <section class="stack-lg">
        <div class="page-header">
          <div>
            <h1 class="page-title">API Keys</h1>
            <p class="page-subtitle">Create and manage the API keys associated with your workspace.</p>
          </div>
          <div class="page-header-actions">
            <button type="button" class="btn btn-primary" id="generate-key-btn">
              ${ICONS.plus}
              <span>Generate Test Key</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-4">
          <div class="stat-card">
            <span class="stat-card-label">Total Keys</span>
            <div class="stat-card-value">${escapeHtml(summary.total)}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Active Keys</span>
            <div class="stat-card-value" style="color: var(--color-success);">${escapeHtml(summary.active)}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Revoked Keys</span>
            <div class="stat-card-value" style="color: var(--color-text-secondary);">${escapeHtml(summary.revoked)}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Last Key Created</span>
            <div class="stat-card-value" style="font-size: 18px;">${escapeHtml(formatDate(summary.lastCreatedAt, dateFmt))}</div>
          </div>
        </div>

        <div class="surface-card">
          <div class="table-toolbar">
            <div class="table-toolbar-left">
              <input
                type="search"
                id="keys-search-input"
                class="table-search-input"
                placeholder="Search by key name or prefix..."
                value="${escapeHtml(keysViewState.searchQuery)}"
                aria-label="Search API keys"
              />
              <select id="keys-status-filter" class="table-filter-select" aria-label="Filter by status">
                <option value="all" ${keysViewState.statusFilter === 'all' ? 'selected' : ''}>All statuses</option>
                <option value="active" ${keysViewState.statusFilter === 'active' ? 'selected' : ''}>Active only</option>
                <option value="revoked" ${keysViewState.statusFilter === 'revoked' ? 'selected' : ''}>Revoked only</option>
              </select>
            </div>
            <div class="table-toolbar-right">
              <span class="text-muted" style="font-size: 12px;">All keys use fictional pm_test_ demo prefixes</span>
            </div>
          </div>
          <div id="api-keys-table"></div>
        </div>
      </section>
    `;

    const tableEl = container.querySelector('#api-keys-table');

    const drawTable = () => {
      const q = keysViewState.searchQuery.trim().toLowerCase();
      let rows = items.filter((k) => {
        if (keysViewState.statusFilter !== 'all' && k.status !== keysViewState.statusFilter) {
          return false;
        }
        if (
          q &&
          !k.name.toLowerCase().includes(q) &&
          !k.prefix.toLowerCase().includes(q) &&
          !k.environment.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });

      rows = sortRows(rows, keysViewState.sortKey, keysViewState.sortDir);

      renderDataTable(tableEl, {
        rows,
        sortKey: keysViewState.sortKey,
        sortDir: keysViewState.sortDir,
        onSort: (key) => {
          if (keysViewState.sortKey === key) {
            keysViewState.sortDir = keysViewState.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            keysViewState.sortKey = key;
            keysViewState.sortDir = 'desc';
          }
          drawTable();
        },
        emptyTitle: 'No API keys found',
        emptyDescription: 'Try clearing your search filter or generate a new fictional test key.',
        columns: [
          {
            key: 'name',
            label: 'Key Name',
            sortable: true,
            render: (row) => `
              <div>
                <div style="font-weight: 500;">${escapeHtml(row.name)}</div>
                <div class="text-secondary" style="font-size: 12px;">${escapeHtml(formatEnvironment(row.environment))}</div>
              </div>
            `
          },
          {
            key: 'prefix',
            label: 'Key Prefix',
            render: (row) => `
              <span class="code-pill">${escapeHtml(row.maskedValue)}</span>
            `
          },
          {
            key: 'createdAt',
            label: 'Created',
            sortable: true,
            render: (row) => `<span class="tabular-nums text-secondary">${escapeHtml(formatDate(row.createdAt, dateFmt))}</span>`
          },
          {
            key: 'lastUsedAt',
            label: 'Last Used',
            render: (row) =>
              `<span class="tabular-nums text-secondary">${escapeHtml(row.lastUsedAt ? formatDate(row.lastUsedAt, dateFmt) : 'Never')}</span>`
          },
          {
            key: 'permissions',
            label: 'Permissions',
            render: (row) => `<span class="badge badge-neutral">${escapeHtml(formatPermission(row.permissions))}</span>`
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (row) =>
              `<span class="badge ${statusBadgeClass(row.status)}"><span class="badge-dot"></span>${escapeHtml(formatEnvironment(row.status))}</span>`
          },
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (row) => `
              <div class="table-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-copy-prefix="${escapeHtml(row.prefix)}" title="Copy masked prefix">Copy</button>
                <button type="button" class="btn btn-secondary btn-sm" data-view-key="${escapeHtml(row.id)}">Details</button>
                ${
                  row.status === 'active'
                    ? `<button type="button" class="btn btn-danger-outline btn-sm" data-revoke-key="${escapeHtml(row.id)}">Revoke</button>`
                    : `<button type="button" class="btn btn-ghost btn-sm" disabled>Revoked</button>`
                }
              </div>
            `
          }
        ]
      });

      tableEl.querySelectorAll('[data-copy-prefix]').forEach((btn) => {
        btn.addEventListener('click', () => {
          copyToClipboard(btn.dataset.copyPrefix, 'Masked key prefix copied');
        });
      });

      tableEl.querySelectorAll('[data-view-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const found = items.find((k) => k.id === btn.dataset.viewKey);
          if (found) openKeyDetailModal(found);
        });
      });

      tableEl.querySelectorAll('[data-revoke-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const found = items.find((k) => k.id === btn.dataset.revokeKey);
          if (!found) return;
          confirmModal({
            title: 'Revoke API Key',
            message: `Are you sure you want to revoke "${found.name}" (${found.prefix})? This mock key will immediately be marked as revoked.`,
            confirmLabel: 'Revoke Key',
            danger: true,
            onConfirm: async () => {
              await api.revokeKey(found.id);
              showToast({
                type: 'warning',
                title: 'API key revoked',
                description: `"${found.name}" is no longer active.`
              });
              await renderApiKeysView(container);
            }
          });
        });
      });
    };

    drawTable();

    container.querySelector('#generate-key-btn').addEventListener('click', () => {
      openCreateKeyModal(() => renderApiKeysView(container));
    });

    container.querySelector('#keys-search-input').addEventListener('input', (e) => {
      keysViewState.searchQuery = e.target.value;
      drawTable();
    });

    container.querySelector('#keys-status-filter').addEventListener('change', (e) => {
      keysViewState.statusFilter = e.target.value;
      drawTable();
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Failed to load API keys',
      message: err.message
    });
    const retry = container.querySelector('#view-retry-btn');
    if (retry) retry.addEventListener('click', () => renderApiKeysView(container));
  }
}
