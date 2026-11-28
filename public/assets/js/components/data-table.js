import { escapeHtml } from '../core/formatters.js';
import { renderEmptyState } from './loading.js';

export function renderDataTable(
  container,
  {
    columns = [],
    rows = [],
    sortKey = '',
    sortDir = 'desc',
    onSort = null,
    onRowClick = null,
    emptyTitle = 'No matching records',
    emptyDescription = 'Adjust your filters or search criteria to see results.',
    emptyActionHtml = ''
  }
) {
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = renderEmptyState({
      title: emptyTitle,
      description: emptyDescription,
      actionHtml: emptyActionHtml
    });
    return;
  }

  const headHtml = columns
    .map((col) => {
      const classes = [];
      if (col.align === 'right') classes.push('table-cell-right');
      if (col.sortable) classes.push('sortable');
      if (col.sortable && sortKey === col.key) classes.push('sorted');
      const indicator = col.sortable
        ? `<span class="sort-indicator">${
            sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'
          }</span>`
        : '';
      return `<th class="${classes.join(' ')}" ${
        col.sortable ? `data-sort-key="${escapeHtml(col.key)}"` : ''
      }>${escapeHtml(col.label)}${indicator}</th>`;
    })
    .join('');

  const bodyHtml = rows
    .map((row, rowIdx) => {
      const cells = columns
        .map((col) => {
          const content =
            typeof col.render === 'function'
              ? col.render(row)
              : escapeHtml(row[col.key] ?? '—');
          const alignClass = col.align === 'right' ? 'table-cell-right' : '';
          return `<td class="${alignClass}">${content}</td>`;
        })
        .join('');
      return `<tr class="${onRowClick ? 'clickable-row' : ''}" data-row-index="${rowIdx}">${cells}</tr>`;
    })
    .join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;

  if (typeof onSort === 'function') {
    container.querySelectorAll('th[data-sort-key]').forEach((th) => {
      th.addEventListener('click', () => {
        onSort(th.dataset.sortKey);
      });
    });
  }

  if (typeof onRowClick === 'function') {
    container.querySelectorAll('tbody tr[data-row-index]').forEach((tr) => {
      tr.addEventListener('click', (event) => {
        if (event.target.closest('button, a, select, input')) return;
        const row = rows[Number(tr.dataset.rowIndex)];
        if (row) onRowClick(row);
      });
    });
  }
}

export function sortRows(rows, key, dir = 'desc') {
  if (!key) return rows;
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * factor;
    }
    return String(av ?? '').localeCompare(String(bv ?? '')) * factor;
  });
}
