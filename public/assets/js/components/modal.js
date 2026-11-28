import { ICONS } from '../data/demo-data.js';
import { escapeHtml } from '../core/formatters.js';

let previouslyFocused = null;
let activeCleanup = null;

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;

  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '';

  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
    previouslyFocused.focus();
    previouslyFocused = null;
  }
}

export function openModal({
  title,
  subtitle = '',
  size = 'md',
  bodyHtml = '',
  footerHtml = '',
  closeOnBackdrop = true,
  onMount = null,
  onClose = null
}) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  previouslyFocused = document.activeElement;

  const sizeClass = size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : '';

  root.innerHTML = `
    <div class="modal-dialog ${sizeClass}" role="dialog" aria-modal="true" aria-labelledby="modal-heading">
      <div class="modal-header">
        <div>
          <h2 id="modal-heading" class="modal-title">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="modal-close" data-modal-close aria-label="Close modal">
          ${ICONS.close}
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;

  root.classList.add('open');
  root.setAttribute('aria-hidden', 'false');

  const handleClose = () => {
    closeModal();
    if (typeof onClose === 'function') onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  };

  const handleBackdropClick = (event) => {
    if (closeOnBackdrop && event.target === root) {
      handleClose();
    }
  };

  root.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', handleClose);
  });

  document.addEventListener('keydown', handleKeyDown);
  root.addEventListener('click', handleBackdropClick);

  activeCleanup = () => {
    document.removeEventListener('keydown', handleKeyDown);
    root.removeEventListener('click', handleBackdropClick);
  };

  if (typeof onMount === 'function') {
    onMount(root, handleClose);
  }

  const focusable = root.querySelector(
    'input, select, textarea, button:not([data-modal-close])'
  );
  if (focusable) {
    focusable.focus();
  } else {
    const closeBtn = root.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.focus();
  }
}

export function confirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm
}) {
  openModal({
    title,
    size: 'sm',
    bodyHtml: `<p class="text-secondary">${escapeHtml(message)}</p>`,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>${escapeHtml(cancelLabel)}</button>
      <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-submit">
        ${escapeHtml(confirmLabel)}
      </button>
    `,
    onMount: (root, close) => {
      const submitBtn = root.querySelector('#confirm-modal-submit');
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Working...`;
        try {
          await onConfirm();
          close();
        } catch {
          submitBtn.disabled = false;
          submitBtn.textContent = confirmLabel;
        }
      });
    }
  });
}
