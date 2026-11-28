import { api } from '../api/client.js';
import { DATE_RANGES, ICONS } from '../data/demo-data.js';
import { getState, setState, updateSearchIndex } from '../core/state.js';
import { navigate } from '../core/router.js';
import {
  escapeHtml,
  formatCompact,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  statusBadgeClass
} from '../core/formatters.js';
import { renderStatCard } from '../components/stat-card.js';
import { renderTimeSeriesChart, renderModelBreakdown } from '../components/chart.js';
import { renderDataTable } from '../components/data-table.js';
import { renderErrorState, renderPageSkeleton } from '../components/loading.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function openActivityDetailModal(item) {
  const metaEntries = Object.entries(item.metadata || {});
  openModal({
    title: item.event,
    subtitle: formatDateTime(item.timestamp),
    size: 'sm',
    bodyHtml: `
      <dl class="detail-list">
        <dt>Status</dt>
        <dd><span class="badge ${statusBadgeClass(item.status)}"><span class="badge-dot"></span>${escapeHtml(item.status)}</span></dd>
        <dt>Description</dt>
        <dd>${escapeHtml(item.description)}</dd>
        <dt>Resource</dt>
        <dd><span class="code-pill">${escapeHtml(item.resource)}</span></dd>
        <dt>Triggered by</dt>
        <dd>${escapeHtml(item.actor)}</dd>
        ${metaEntries
          .map(
            ([k, v]) => `
          <dt>${escapeHtml(k)}</dt>
          <dd>${escapeHtml(v)}</dd>
        `
          )
          .join('')}
      </dl>
    `,
    footerHtml: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>`
  });
}

export async function renderOverviewView(container) {
  const state = getState();
  container.innerHTML = renderPageSkeleton();

  try {
    const [summaryRes, timeseriesRes, modelsRes, activityRes] = await Promise.all([
      api.getDashboardSummary(state.dateRange),
      api.getUsageTimeseries(state.dateRange, 'all'),
      api.getUsageModels(state.dateRange),
      api.getDashboardActivity(10)
    ]);

    updateSearchIndex({ activity: activityRes.items });
    setState({ subscription: summaryRes.subscription }, { silent: true });

    const { kpis, comparisonLabel } = summaryRes;

    container.innerHTML = `
      <section class="stack-lg">
        <div class="page-header">
          <div>
            <h1 class="page-title">Overview</h1>
            <p class="page-subtitle">Monitor your API performance, usage, and spending.</p>
          </div>
          <div class="page-header-actions">
            <label class="sr-only" for="overview-range-select">Date range</label>
            <select id="overview-range-select" class="form-select" style="width: 158px; height: 34px; font-size: 13px;">
              ${DATE_RANGES.map(
                (r) =>
                  `<option value="${r.value}" ${r.value === state.dateRange ? 'selected' : ''}>${escapeHtml(r.label)}</option>`
              ).join('')}
            </select>
            <button type="button" class="btn btn-secondary" id="overview-export-btn">
              ${ICONS.download}
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-4">
          ${renderStatCard({
            label: 'Total API Requests',
            value: formatNumber(kpis.totalRequests.value),
            delta: kpis.totalRequests.delta,
            comparison: comparisonLabel,
            sparkline: kpis.totalRequests.sparkline,
            sparklineColor: '#635BDB',
            targetRoute: 'usage'
          })}
          ${renderStatCard({
            label: 'Total Tokens Used',
            value: formatCompact(kpis.totalTokens.value),
            delta: kpis.totalTokens.delta,
            comparison: comparisonLabel,
            sparkline: kpis.totalTokens.sparkline,
            sparklineColor: '#2D7FF9',
            targetRoute: 'usage'
          })}
          ${renderStatCard({
            label: 'Estimated Spend',
            value: formatCurrency(kpis.estimatedSpend.value),
            delta: kpis.estimatedSpend.delta,
            comparison: comparisonLabel,
            sparkline: kpis.estimatedSpend.sparkline,
            sparklineColor: '#D99432',
            targetRoute: 'billing'
          })}
          ${renderStatCard({
            label: 'Success Rate',
            value: formatPercent(kpis.successRate.value),
            delta: kpis.successRate.delta,
            comparison: comparisonLabel,
            sparkline: kpis.successRate.sparkline,
            sparklineColor: '#16A36A',
            targetRoute: 'usage'
          })}
        </div>

        <div class="grid grid-overview-charts">
          <div class="surface-card">
            <div class="surface-card-header">
              <div>
                <h2 class="card-title">API Requests Over Time</h2>
                <p class="card-subtitle">Hover data points to inspect request counts for ${escapeHtml(
                  DATE_RANGES.find((r) => r.value === state.dateRange)?.label || 'selected range'
                ).toLowerCase()}.</p>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" id="overview-view-analytics">
                Detailed analytics →
              </button>
            </div>
            <div class="surface-card-body">
              <div id="overview-usage-chart"></div>
            </div>
          </div>

          <div class="surface-card">
            <div class="surface-card-header">
              <div>
                <h2 class="card-title">Usage by Model</h2>
                <p class="card-subtitle">Request share and token volume</p>
              </div>
            </div>
            <div class="surface-card-body">
              <div id="overview-model-breakdown"></div>
            </div>
          </div>
        </div>

        <div class="surface-card">
          <div class="surface-card-header">
            <div>
              <h2 class="card-title">Recent Activity</h2>
              <p class="card-subtitle">Click an event row to inspect audit metadata.</p>
            </div>
          </div>
          <div id="overview-activity-table"></div>
        </div>
      </section>
    `;

    renderTimeSeriesChart(container.querySelector('#overview-usage-chart'), {
      points: timeseriesRes.points,
      valueKey: 'requests',
      valueType: 'number',
      unitLabel: 'requests'
    });

    renderModelBreakdown(container.querySelector('#overview-model-breakdown'), modelsRes.models);

    renderDataTable(container.querySelector('#overview-activity-table'), {
      rows: activityRes.items,
      onRowClick: openActivityDetailModal,
      emptyTitle: 'No recent workspace activity',
      emptyDescription: 'Events such as API key generation, plan updates, and team changes will appear here.',
      columns: [
        {
          key: 'event',
          label: 'Event',
          render: (row) => `<span style="font-weight: 500;">${escapeHtml(row.event)}</span>`
        },
        {
          key: 'description',
          label: 'Description',
          render: (row) => `<span class="text-secondary">${escapeHtml(row.description)}</span>`
        },
        {
          key: 'resource',
          label: 'Resource',
          render: (row) => `<span class="code-pill">${escapeHtml(row.resource)}</span>`
        },
        {
          key: 'timestamp',
          label: 'Time',
          render: (row) =>
            `<span class="text-secondary tabular-nums">${escapeHtml(formatDateTime(row.timestamp))}</span>`
        },
        {
          key: 'status',
          label: 'Status',
          align: 'right',
          render: (row) =>
            `<span class="badge ${statusBadgeClass(row.status)}"><span class="badge-dot"></span>${escapeHtml(row.status)}</span>`
        }
      ]
    });

    // Interactions
    container.querySelector('#overview-range-select').addEventListener('change', (e) => {
      setState({ dateRange: e.target.value }, { persist: true });
      renderOverviewView(container);
    });

    container.querySelector('#overview-view-analytics').addEventListener('click', () => {
      navigate('usage');
    });

    container.querySelectorAll('[data-nav-target]').forEach((card) => {
      const go = () => navigate(card.dataset.navTarget);
      card.addEventListener('click', go);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          go();
        }
      });
    });

    const exportBtn = container.querySelector('#overview-export-btn');
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      try {
        const filename = await api.downloadUsageCsv(getState().dateRange, 'all');
        showToast({
          type: 'success',
          title: 'Usage report exported',
          description: `Downloaded ${filename}`
        });
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Export failed',
          description: err.message
        });
      } finally {
        exportBtn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Failed to load dashboard overview',
      message: err.message
    });
    const retry = container.querySelector('#view-retry-btn');
    if (retry) retry.addEventListener('click', () => renderOverviewView(container));
  }
}
