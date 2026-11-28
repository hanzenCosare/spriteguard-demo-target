import { ICONS } from '../data/demo-data.js';
import { escapeHtml } from '../core/formatters.js';

const TYPE_ICONS = {
  success: ICONS.checkCircle,
  error: ICONS.alertCircle,
  warning: ICONS.alertTriangle,
  info: ICONS.infoCircle
};

export function showToast({ type = 'info', title, description = '', duration = 4200 }) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.setAttribute('role', type === 'error' ? 'alert' : 'status');

  toastEl.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${TYPE_ICONS[type] || ICONS.infoCircle}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${description ? `<div class="toast-desc">${escapeHtml(description)}</div>` : ''}
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">
      ${ICONS.close}
    </button>
  `;

  let timerId = null;

  const dismiss = () => {
    if (timerId) window.clearTimeout(timerId);
    toastEl.remove();
  };

  toastEl.querySelector('.toast-close').addEventListener('click', dismiss);
  root.appendChild(toastEl);

  if (duration > 0) {
    timerId = window.setTimeout(dismiss, duration);
  }

  return dismiss;
}
