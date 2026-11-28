import { escapeHtml, formatDelta } from '../core/formatters.js';

function renderSparklineSvg(values = [], color = '#635BDB') {
  if (!Array.isArray(values) || values.length < 2) return '';
  const width = 72;
  const height = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = values
    .map((val, idx) => {
      const x = (idx / (values.length - 1)) * (width - 4) + 2;
      const y = height - 3 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `
    <svg class="stat-card-sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline
        fill="none"
        stroke="${color}"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${coords}"
      />
    </svg>
  `;
}

export function renderStatCard({
  label,
  value,
  delta = null,
  comparison = '',
  sparkline = [],
  sparklineColor = '#635BDB',
  targetRoute = ''
}) {
  const deltaNum = delta === null ? null : Number(delta);
  const deltaClass =
    deltaNum === null ? 'neutral' : deltaNum >= 0 ? 'positive' : 'negative';
  const interactiveAttrs = targetRoute
    ? `data-nav-target="${escapeHtml(targetRoute)}" tabindex="0" role="button"`
    : '';

  return `
    <article class="stat-card ${targetRoute ? 'interactive' : ''}" ${interactiveAttrs}>
      <div class="stat-card-top">
        <span class="stat-card-label">${escapeHtml(label)}</span>
      </div>
      <div class="stat-card-value-row">
        <div class="stat-card-value tabular-nums">${escapeHtml(value)}</div>
        ${renderSparklineSvg(sparkline, sparklineColor)}
      </div>
      ${
        deltaNum !== null || comparison
          ? `
        <div class="stat-card-footer">
          ${
            deltaNum !== null
              ? `<span class="stat-delta ${deltaClass}">${escapeHtml(formatDelta(deltaNum))}</span>`
              : ''
          }
          ${comparison ? `<span class="text-muted">${escapeHtml(comparison)}</span>` : ''}
        </div>
      `
          : ''
      }
    </article>
  `;
}
