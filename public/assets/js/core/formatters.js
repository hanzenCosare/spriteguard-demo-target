export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatCompact(value) {
  const num = Number(value || 0);
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 10_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return formatNumber(num);
}

export function formatCurrency(value, { decimals = 2 } = {}) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

export function formatPercent(value, decimals = 2) {
  const num = Number(value || 0);
  return `${num.toFixed(decimals)}%`;
}

export function formatDelta(value) {
  const num = Number(value || 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(Math.abs(num) < 1 ? 2 : 1)}%`;
}

export function formatDate(isoString, formatPref = 'MMM D, YYYY') {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (formatPref === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  if (formatPref === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function formatDateTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

export function formatPermission(permission) {
  const labels = {
    full_access: 'Full Access',
    read_write: 'Read & Write',
    read_only: 'Read Only'
  };
  return labels[permission] || permission;
}

export function formatEnvironment(env) {
  if (!env) return 'Development';
  return env.charAt(0).toUpperCase() + env.slice(1);
}

export function statusBadgeClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (['active', 'success', 'paid'].includes(normalized)) return 'badge-success';
  if (['pending', 'warning'].includes(normalized)) return 'badge-warning';
  if (['revoked', 'failed', 'error', 'danger'].includes(normalized)) return 'badge-danger';
  return 'badge-neutral';
}
