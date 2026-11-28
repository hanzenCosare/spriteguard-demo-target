import { api } from '../api/client.js';
import { DATE_RANGES, ICONS } from '../data/demo-data.js';
import { getState, setState } from '../core/state.js';
import {
  escapeHtml,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent
} from '../core/formatters.js';
import { renderTimeSeriesChart } from '../components/chart.js';
import { renderDataTable, sortRows } from '../components/data-table.js';
import { renderErrorState, renderPageSkeleton } from '../components/loading.js';
import { showToast } from '../components/toast.js';

const viewState = {
  modelFilter: 'all',
  searchQuery: '',
  sortKey: 'requests',
  sortDir: 'desc'
};

const METRIC_META = {
  requests: { valueKey: 'requests', valueType: 'number', unitLabel: 'requests', label: 'Requests' },
  tokens: { valueKey: 'tokens', valueType: 'number', unitLabel: 'tokens', label: 'Tokens' },
  cost: { valueKey: 'cost', valueType: 'currency', unitLabel: 'USD', label: 'Estimated cost' }
};

export async function renderUsageView(container) {
  const state = getState();
  container.innerHTML = renderPageSkeleton();

  try {
    const [summaryRes, timeseriesRes, modelsRes] = await Promise.all([
      api.getUsageSummary(state.dateRange),
      api.getUsageTimeseries(state.dateRange, viewState.modelFilter),
      api.getUsageModels(state.dateRange)
    ]);

    const { summary } = summaryRes;
    const allModels = modelsRes.models;
    const activeMetric = METRIC_META[state.usageMetric] || METRIC_META.requests;

    container.innerHTML = `
      <section class="stack-lg">
        <div class="page-header">
          <div>
            <h1 class="page-title">Usage & Analytics</h1>
            <p class="page-subtitle">Understand how your API consumption changes over time.</p>
          </div>
          <div class="page-header-actions">
            <select id="usage-range-select" class="form-select" style="width: 158px; height: 34px; font-size: 13px;" aria-label="Date range">
              ${DATE_RANGES.map(
                (r) =>
                  `<option value="${r.value}" ${r.value === state.dateRange ? 'selected' : ''}>${escapeHtml(r.label)}</option>`
              ).join('')}
            </select>
            <button type="button" class="btn btn-primary" id="usage-export-btn">
              ${ICONS.download}
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-6">
          <div class="stat-card">
            <span class="stat-card-label">Total Requests</span>
            <div class="stat-card-value" style="font-size: 20px;">${escapeHtml(formatNumber(summary.totalRequests))}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Input Tokens</span>
            <div class="stat-card-value" style="font-size: 20px;">${escapeHtml(formatCompact(summary.inputTokens))}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Output Tokens</span>
            <div class="stat-card-value" style="font-size: 20px;">${escapeHtml(formatCompact(summary.outputTokens))}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Total Tokens</span>
            <div class="stat-card-value" style="font-size: 20px;">${escapeHtml(formatCompact(summary.totalTokens))}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Estimated Cost</span>
            <div class="stat-card-value" style="font-size: 20px;">${escapeHtml(formatCurrency(summary.estimatedCost))}</div>
          </div>
          <div class="stat-card">
            <span class="stat-card-label">Error Rate</span>
            <div class="stat-card-value" style="font-size: 20px;">${escapeHtml(formatPercent(summary.errorRate))}</div>
          </div>
        </div>

        <div class="surface-card">
          <div class="surface-card-header">
            <div>
              <h2 class="card-title">Usage Timeline</h2>
              <p class="card-subtitle">Switch between requests, token consumption, and estimated cost.</p>
            </div>
            <div class="segmented-control" role="tablist" aria-label="Chart metric">
              ${Object.entries(METRIC_META)
                .map(
                  ([key, meta]) => `
                <button
                  type="button"
                  role="tab"
                  aria-selected="${state.usageMetric === key}"
                  class="segmented-btn ${state.usageMetric === key ? 'active' : ''}"
                  data-metric-key="${key}"
                >${escapeHtml(meta.label)}</button>
              `
                )
                .join('')}
            </div>
          </div>
          <div class="surface-card-body">
            <div id="usage-timeline-chart"></div>
          </div>
        </div>

        <div class="surface-card">
          <div class="surface-card-header">
            <div>
              <h2 class="card-title">Model Breakdown</h2>
              <p class="card-subtitle">Per-model requests, token splits, and estimated cost.</p>
            </div>
          </div>
          <div class="table-toolbar">
            <div class="table-toolbar-left">
              <input
                type="search"
                id="usage-model-search"
                class="table-search-input"
                placeholder="Search models..."
                value="${escapeHtml(viewState.searchQuery)}"
                aria-label="Search models"
              />
              <select id="usage-model-filter" class="table-filter-select" aria-label="Filter by model">
                <option value="all" ${viewState.modelFilter === 'all' ? 'selected' : ''}>All models</option>
                ${allModels
                  .map(
                    (m) =>
                      `<option value="${escapeHtml(m.id)}" ${viewState.modelFilter === m.id ? 'selected' : ''}>${escapeHtml(m.model)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="table-toolbar-right">
              <button type="button" class="btn btn-ghost btn-sm" id="usage-clear-filters">
                Clear filters
              </button>
            </div>
          </div>
          <div id="usage-models-table"></div>
        </div>
      </section>
    `;

    const chartContainer = container.querySelector('#usage-timeline-chart');
    const drawChart = (metricKey) => {
      const m = METRIC_META[metricKey] || METRIC_META.requests;
      renderTimeSeriesChart(chartContainer, {
        points: timeseriesRes.points,
        valueKey: m.valueKey,
        valueType: m.valueType,
        unitLabel: m.unitLabel
      });
    };

    drawChart(activeMetric.valueKey === 'cost' ? 'cost' : state.usageMetric);

    const tableContainer = container.querySelector('#usage-models-table');
    const drawTable = () => {
      const q = viewState.searchQuery.trim().toLowerCase();
      let filtered = allModels.filter((m) => {
        if (viewState.modelFilter !== 'all' && m.id !== viewState.modelFilter) return false;
        if (q && !m.model.toLowerCase().includes(q)) return false;
        return true;
      });

      filtered = sortRows(filtered, viewState.sortKey, viewState.sortDir);

      renderDataTable(tableContainer, {
        rows: filtered,
        sortKey: viewState.sortKey,
        sortDir: viewState.sortDir,
        onSort: (key) => {
          if (viewState.sortKey === key) {
            viewState.sortDir = viewState.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            viewState.sortKey = key;
            viewState.sortDir = 'desc';
          }
          drawTable();
        },
        emptyTitle: 'No models match your filters',
        emptyDescription: 'Clear your search query or model filter to view all usage data.',
        columns: [
          {
            key: 'model',
            label: 'Model',
            sortable: true,
            render: (row) => `
              <span class="breakdown-model">
                <span class="breakdown-swatch" style="background: ${escapeHtml(row.color)};"></span>
                ${escapeHtml(row.model)}
              </span>
            `
          },
          {
            key: 'requests',
            label: 'Requests',
            sortable: true,
            align: 'right',
            render: (row) => `<span class="tabular-nums">${escapeHtml(formatNumber(row.requests))}</span>`
          },
          {
            key: 'inputTokens',
            label: 'Input Tokens',
            sortable: true,
            align: 'right',
            render: (row) => `<span class="tabular-nums">${escapeHtml(formatCompact(row.inputTokens))}</span>`
          },
          {
            key: 'outputTokens',
            label: 'Output Tokens',
            sortable: true,
            align: 'right',
            render: (row) => `<span class="tabular-nums">${escapeHtml(formatCompact(row.outputTokens))}</span>`
          },
          {
            key: 'totalTokens',
            label: 'Total Tokens',
            sortable: true,
            align: 'right',
            render: (row) => `<span class="tabular-nums" style="font-weight: 500;">${escapeHtml(formatCompact(row.totalTokens))}</span>`
          },
          {
            key: 'estimatedCost',
            label: 'Estimated Cost',
            sortable: true,
            align: 'right',
            render: (row) => `<span class="tabular-nums">${escapeHtml(formatCurrency(row.estimatedCost))}</span>`
          },
          {
            key: 'percentage',
            label: '% of Total',
            sortable: true,
            align: 'right',
            render: (row) => `<span class="badge badge-neutral tabular-nums">${escapeHtml(row.percentage)}%</span>`
          }
        ]
      });
    };

    drawTable();

    // Event bindings
    container.querySelector('#usage-range-select').addEventListener('change', (e) => {
      setState({ dateRange: e.target.value }, { persist: true });
      renderUsageView(container);
    });

    container.querySelectorAll('[data-metric-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.metricKey;
        setState({ usageMetric: key }, { persist: true, silent: true });
        container.querySelectorAll('[data-metric-key]').forEach((b) => {
          const active = b.dataset.metricKey === key;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        drawChart(key);
      });
    });

    container.querySelector('#usage-model-search').addEventListener('input', (e) => {
      viewState.searchQuery = e.target.value;
      drawTable();
    });

    container.querySelector('#usage-model-filter').addEventListener('change', (e) => {
      viewState.modelFilter = e.target.value;
      renderUsageView(container);
    });

    container.querySelector('#usage-clear-filters').addEventListener('click', () => {
      viewState.modelFilter = 'all';
      viewState.searchQuery = '';
      viewState.sortKey = 'requests';
      viewState.sortDir = 'desc';
      renderUsageView(container);
    });

    const exportBtn = container.querySelector('#usage-export-btn');
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      try {
        const filename = await api.downloadUsageCsv(getState().dateRange, viewState.modelFilter);
        showToast({
          type: 'success',
          title: 'CSV export complete',
          description: `Saved ${filename}`
        });
      } catch (err) {
        showToast({
          type: 'error',
          title: 'CSV export failed',
          description: err.message
        });
      } finally {
        exportBtn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Failed to load usage analytics',
      message: err.message
    });
    const retry = container.querySelector('#view-retry-btn');
    if (retry) retry.addEventListener('click', () => renderUsageView(container));
  }
}
