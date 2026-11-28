const openDropdowns = new Set();

function closeAllExcept(exceptEl) {
  openDropdowns.forEach((entry) => {
    if (entry.container !== exceptEl) {
      entry.close();
    }
  });
}

document.addEventListener('click', (event) => {
  openDropdowns.forEach((entry) => {
    if (!entry.container.contains(event.target)) {
      entry.close();
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    openDropdowns.forEach((entry) => entry.close());
  }
});

export function bindDropdown(container, { onToggle } = {}) {
  if (!container) return null;
  const trigger = container.querySelector('[data-dropdown-trigger]');
  const menu = container.querySelector('[data-dropdown-menu]');
  if (!trigger || !menu) return null;

  const entry = {
    container,
    close() {
      menu.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      openDropdowns.delete(entry);
      if (typeof onToggle === 'function') onToggle(false);
    },
    open() {
      closeAllExcept(container);
      menu.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      openDropdowns.add(entry);
      if (typeof onToggle === 'function') onToggle(true);
    }
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (menu.classList.contains('open')) {
      entry.close();
    } else {
      entry.open();
    }
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (!menu.classList.contains('open')) {
        event.preventDefault();
        entry.open();
        const firstItem = menu.querySelector('button, [tabindex="0"]');
        if (firstItem) firstItem.focus();
      }
    }
  });

  menu.addEventListener('keydown', (event) => {
    const items = Array.from(menu.querySelectorAll('button:not(:disabled)'));
    const idx = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = items[(idx + 1) % items.length];
      if (next) next.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = items[(idx - 1 + items.length) % items.length];
      if (prev) prev.focus();
    } else if (event.key === 'Escape') {
      entry.close();
      trigger.focus();
    }
  });

  return entry;
}
