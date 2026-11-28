import { escapeHtml } from '../core/formatters.js';
import { ICONS } from '../data/demo-data.js';

export function renderPageSkeleton() {
  return `
    <div class="stack-lg">
      <div class="grid grid-cols-4">
        ${Array.from({ length: 4 })
          .map(
            () => `
          <div class="stat-card">
            <div class="skeleton" style="width: 110px; height: 14px;"></div>
            <div class="skeleton" style="width: 140px; height: 28px; margin-top: 6px;"></div>
            <div class="skeleton" style="width: 130px; height: 12px; margin-top: 6px;"></div>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="surface-card">
        <div class="surface-card-body">
          <div class="skeleton" style="width: 180px; height: 16px; margin-bottom: 16px;"></div>
          <div class="skeleton" style="width: 100%; height: 220px;"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderErrorState({
  title = 'Unable to load data',
  message = 'Something went wrong while fetching workspace metrics.',
  retryId = 'view-retry-btn'
}) {
  return `
    <div class="surface-card">
      <div class="empty-state">
        <div class="empty-state-icon" style="color: var(--color-danger); background: var(--color-danger-soft);">
          ${ICONS.alertCircle}
        </div>
        <div class="empty-state-title">${escapeHtml(title)}</div>
        <p class="empty-state-desc">${escapeHtml(message)}</p>
        <button type="button" class="btn btn-secondary mt-4" id="${escapeHtml(retryId)}">
          Try again
        </button>
      </div>
    </div>
  `;
}

export function renderEmptyState({ title, description, actionHtml = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${ICONS.infoCircle}</div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <p class="empty-state-desc">${escapeHtml(description)}</p>
      ${actionHtml ? `<div style="margin-top: 8px;">${actionHtml}</div>` : ''}
    </div>
  `;
}
