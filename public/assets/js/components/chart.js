import {
  escapeHtml,
  formatCompact,
  formatCurrency,
  formatNumber
} from '../core/formatters.js';

function formatAxisTick(value, valueType) {
  if (valueType === 'currency') {
    return value >= 100 ? `$${Math.round(value)}` : `$${value.toFixed(1)}`;
  }
  return formatCompact(value);
}

function formatTooltipMetric(value, valueType, unitLabel) {
  if (valueType === 'currency') {
    return `${formatCurrency(value)} estimated`;
  }
  return `${formatNumber(value)} ${unitLabel}`;
}

export function renderTimeSeriesChart(
  container,
  { points = [], valueKey = 'requests', valueType = 'number', unitLabel = 'requests' }
) {
  if (!container) return;

  if (!points.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No usage points for this selection</div>
        <p class="empty-state-desc">Try selecting a broader date range or resetting the model filter.</p>
      </div>
    `;
    return;
  }

  const width = 760;
  const height = 250;
  const pad = { top: 18, right: 18, bottom: 34, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.map((p) => Number(p[valueKey] || 0));
  const rawMax = Math.max(...values, 1);
  const maxVal = rawMax * 1.12;
  const minVal = 0;

  const xFor = (idx) =>
    points.length === 1
      ? pad.left + plotW / 2
      : pad.left + (idx / (points.length - 1)) * plotW;
  const yFor = (val) => pad.top + plotH - ((val - minVal) / (maxVal - minVal || 1)) * plotH;

  const yTicks = 4;
  const gridLines = [];
  for (let i = 0; i <= yTicks; i += 1) {
    const val = (maxVal / yTicks) * i;
    const y = yFor(val);
    gridLines.push(`
      <line class="chart-grid-line" x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" />
      <text class="chart-axis-label" x="${pad.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">
        ${escapeHtml(formatAxisTick(val, valueType))}
      </text>
    `);
  }

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const xLabels = points
    .map((p, idx) => {
      if (idx !== 0 && idx !== points.length - 1 && idx % labelStep !== 0) return '';
      const x = xFor(idx);
      return `<text class="chart-axis-label" x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle">${escapeHtml(p.label)}</text>`;
    })
    .join('');

  const lineCoords = points.map((p, idx) => `${xFor(idx).toFixed(1)},${yFor(Number(p[valueKey] || 0)).toFixed(1)}`);
  const linePath = `M ${lineCoords.join(' L ')}`;
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)} L ${xFor(0).toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;

  const dots = points
    .map((p, idx) => {
      const cx = xFor(idx).toFixed(1);
      const cy = yFor(Number(p[valueKey] || 0)).toFixed(1);
      return `<circle class="chart-point-dot" data-idx="${idx}" cx="${cx}" cy="${cy}" r="${points.length > 20 ? 3 : 3.8}" />`;
    })
    .join('');

  const hitTargets = points
    .map((p, idx) => {
      const x = xFor(idx);
      const sliceW = plotW / Math.max(1, points.length - 1);
      const rx = Math.max(pad.left, x - sliceW / 2);
      const rw = Math.min(width - pad.right - rx, sliceW);
      return `<rect data-hit-idx="${idx}" x="${rx.toFixed(1)}" y="${pad.top}" width="${Math.max(12, rw).toFixed(1)}" height="${plotH}" fill="transparent" style="cursor: crosshair;" />`;
    })
    .join('');

  container.innerHTML = `
    <div class="chart-wrapper">
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Usage time series chart">
        ${gridLines.join('')}
        <path class="chart-area-path" d="${areaPath}" />
        <path class="chart-line-path" d="${linePath}" />
        <line class="chart-hover-line hidden" id="chart-hover-line" x1="0" y1="${pad.top}" x2="0" y2="${pad.top + plotH}" />
        ${dots}
        ${xLabels}
        ${hitTargets}
      </svg>
      <div class="chart-tooltip" id="chart-tooltip"></div>
    </div>
  `;

  const wrapper = container.querySelector('.chart-wrapper');
  const tooltip = container.querySelector('#chart-tooltip');
  const hoverLine = container.querySelector('#chart-hover-line');
  const dotEls = container.querySelectorAll('.chart-point-dot');

  const showPoint = (idx) => {
    const point = points[idx];
    if (!point) return;

    const val = Number(point[valueKey] || 0);
    const xPct = xFor(idx) / width;
    const yPct = yFor(val) / height;

    hoverLine.setAttribute('x1', xFor(idx).toFixed(1));
    hoverLine.setAttribute('x2', xFor(idx).toFixed(1));
    hoverLine.classList.remove('hidden');

    dotEls.forEach((dot) => {
      const isMatch = Number(dot.dataset.idx) === idx;
      dot.classList.toggle('active', isMatch);
      dot.setAttribute('r', isMatch ? '5' : points.length > 20 ? '3' : '3.8');
    });

    tooltip.innerHTML = `
      <div class="chart-tooltip-date">${escapeHtml(point.label)}</div>
      <div class="chart-tooltip-value">${escapeHtml(formatTooltipMetric(val, valueType, unitLabel))}</div>
    `;
    tooltip.classList.add('visible');

    const wrapperRect = wrapper.getBoundingClientRect();
    const tipWidth = tooltip.offsetWidth || 130;
    let leftPx = xPct * wrapperRect.width + 12;
    if (leftPx + tipWidth > wrapperRect.width) {
      leftPx = Math.max(8, xPct * wrapperRect.width - tipWidth - 12);
    }
    const topPx = Math.max(8, yPct * wrapperRect.height - 34);

    tooltip.style.left = `${leftPx}px`;
    tooltip.style.top = `${topPx}px`;
  };

  const hidePoint = () => {
    hoverLine.classList.add('hidden');
    tooltip.classList.remove('visible');
    dotEls.forEach((dot) => {
      dot.classList.remove('active');
      dot.setAttribute('r', points.length > 20 ? '3' : '3.8');
    });
  };

  container.querySelectorAll('[data-hit-idx]').forEach((rect) => {
    const idx = Number(rect.dataset.hitIdx);
    rect.addEventListener('mouseenter', () => showPoint(idx));
    rect.addEventListener('focus', () => showPoint(idx));
  });

  wrapper.addEventListener('mouseleave', hidePoint);
}

export function renderModelBreakdown(container, models = []) {
  if (!container) return;

  if (!models.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No model usage recorded</div>
        <p class="empty-state-desc">Usage breakdown will appear once requests are logged.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="breakdown-list">
      ${models
        .map(
          (m) => `
        <div class="breakdown-item">
          <div class="breakdown-item-top">
            <span class="breakdown-model">
              <span class="breakdown-swatch" style="background: ${escapeHtml(m.color)};"></span>
              ${escapeHtml(m.model)}
            </span>
            <span class="breakdown-metrics">
              ${escapeHtml(formatCompact(m.requests))} req · ${escapeHtml(formatCompact(m.totalTokens))} tok (${escapeHtml(m.percentage)}%)
            </span>
          </div>
          <div class="breakdown-bar-track">
            <div class="breakdown-bar-fill" style="width: ${Math.max(2, m.percentage)}%; background: ${escapeHtml(m.color)};"></div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}
