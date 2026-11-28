import { api } from '../api/client.js';
import { ICONS } from '../data/demo-data.js';
import { getState, setState } from '../core/state.js';
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  statusBadgeClass
} from '../core/formatters.js';
import { renderDataTable } from '../components/data-table.js';
import { renderErrorState, renderPageSkeleton } from '../components/loading.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

function openEnterpriseInquiryModal() {
  openModal({
    title: 'Contact Enterprise Sales',
    subtitle: 'Request custom API volume quotas, SSO, and dedicated support (Demo only).',
    size: 'md',
    bodyHtml: `
      <form id="enterprise-form" class="stack-md" novalidate>
        <div class="form-group">
          <label class="form-label" for="ent-company">Organization name<span class="form-required">*</span></label>
          <input type="text" id="ent-company" class="form-input" value="${escapeHtml(getState().workspace.workspaceName)}" required />
          <div class="form-error" id="ent-company-err"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="ent-volume">Expected monthly requests</label>
          <select id="ent-volume" class="form-select">
            <option value="5m">5M – 20M requests / month</option>
            <option value="20m">20M – 100M requests / month</option>
            <option value="100m">100M+ requests / month</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="ent-notes">Requirements</label>
          <textarea id="ent-notes" class="form-textarea" placeholder="Tell us about your team size, SLAs, or custom telemetry needs..."></textarea>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="submit" form="enterprise-form" class="btn btn-primary">Send Demo Inquiry</button>
    `,
    onMount: (root, close) => {
      const form = root.querySelector('#enterprise-form');
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const company = root.querySelector('#ent-company').value.trim();
        if (!company) {
          root.querySelector('#ent-company-err').textContent = 'Organization name is required.';
          return;
        }
        close();
        showToast({
          type: 'success',
          title: 'Demo Enterprise inquiry recorded',
          description: `Our fictional solutions team noted the request for ${company}.`
        });
      });
    }
  });
}

function openMockCheckoutModal(checkoutRes, onConfirmed) {
  const { session } = checkoutRes;
  const periodLabel = session.billingPeriod === 'annual' ? 'Annual' : 'Monthly';

  openModal({
    title: 'Local Mock Checkout',
    subtitle: 'Simulated checkout session — no external payment processor or card input.',
    size: 'md',
    bodyHtml: `
      <div class="checkout-summary-box">
        <div class="checkout-row">
          <span class="text-secondary">Checkout Session</span>
          <span class="code-pill">${escapeHtml(session.id)}</span>
        </div>
        <div class="checkout-row">
          <span class="text-secondary">Local Route</span>
          <span class="text-mono">${escapeHtml(session.url)}</span>
        </div>
        <div class="checkout-row">
          <span class="text-secondary">Selected Plan</span>
          <span>${escapeHtml(session.planName)} (${escapeHtml(periodLabel)})</span>
        </div>
        <div class="checkout-row">
          <span class="text-secondary">Session Status</span>
          <span class="badge badge-warning"><span class="badge-dot"></span>${escapeHtml(session.status)}</span>
        </div>
        <div class="checkout-row total">
          <span>Simulated Total</span>
          <span class="tabular-nums">${escapeHtml(formatCurrency(session.amount))} ${escapeHtml(session.currency)}</span>
        </div>
      </div>

      <div class="notice-box notice-box-info">
        <strong>Demonstration Only:</strong> Confirming this mock checkout updates the local in-memory subscription state and appends a fictional invoice. No real payment is collected.
      </div>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="button" class="btn btn-primary" id="confirm-mock-checkout-btn">
        Confirm Demo Subscription
      </button>
    `,
    onMount: (root, close) => {
      const confirmBtn = root.querySelector('#confirm-mock-checkout-btn');
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner"></span> Confirming...`;
        try {
          const result = await api.confirmCheckout(session.id);
          setState({ subscription: result.subscription });
          close();
          showToast({
            type: 'success',
            title: `${result.subscription.planName} plan active`,
            description: `Mock invoice ${result.invoice.id} added to billing history.`
          });
          await onConfirmed();
        } catch (err) {
          showToast({
            type: 'error',
            title: 'Checkout confirmation failed',
            description: err.message
          });
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Demo Subscription';
        }
      });
    }
  });
}

function renderPlanCard(plan, billingPeriod, subscription) {
  const isCurrentPlan = subscription.plan === plan.id;
  const isCurrentExact = isCurrentPlan && subscription.billingPeriod === billingPeriod;

  let priceDisplay = 'Custom';
  let unitDisplay = '';
  let billingNote = 'Annual contract · custom billing terms';

  if (!plan.customPricing) {
    const unitPrice = billingPeriod === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
    priceDisplay = `$${unitPrice}`;
    unitDisplay = '/month';

    if (plan.monthlyPrice === 0) {
      billingNote = 'Free forever · no payment method required';
    } else if (billingPeriod === 'annual') {
      billingNote = `Billed annually ($${plan.annualTotal}/yr) — save ${plan.annualSavingsPercent}%`;
    } else {
      billingNote = `Billed monthly · switch to annual to save ${plan.annualSavingsPercent}%`;
    }
  }

  let ctaHtml = '';
  if (plan.id === 'pro') {
    ctaHtml = `
      <button
        type="button"
        class="btn btn-primary btn-block"
        data-plan-action="checkout"
        data-plan-id="pro"
      >
        Upgrade to Pro
      </button>
    `;
  } else if (plan.id === 'free') {
    ctaHtml = isCurrentPlan
      ? `<button type="button" class="btn btn-secondary btn-block" disabled>Current Plan</button>`
      : `<button type="button" class="btn btn-secondary btn-block" data-plan-action="checkout" data-plan-id="free">Switch to Free</button>`;
  } else {
    ctaHtml = `
      <button type="button" class="btn btn-secondary btn-block" data-plan-action="enterprise">
        Contact Sales
      </button>
    `;
  }

  return `
    <article class="plan-card ${plan.highlighted ? 'highlighted' : ''}">
      <div class="plan-card-header">
        <div>
          <h3 class="plan-name">${escapeHtml(plan.name)}</h3>
          <p class="plan-tagline">${escapeHtml(plan.tagline)}</p>
        </div>
        ${
          isCurrentExact
            ? '<span class="badge badge-primary">Current</span>'
            : plan.highlighted
              ? '<span class="badge badge-neutral">Popular</span>'
              : ''
        }
      </div>

      <div>
        <div class="plan-price-row">
          <span class="plan-price">${escapeHtml(priceDisplay)}</span>
          ${unitDisplay ? `<span class="plan-price-unit">${escapeHtml(unitDisplay)}</span>` : ''}
        </div>
        <div class="plan-billing-note">${escapeHtml(billingNote)}</div>
      </div>

      <ul class="plan-features">
        ${plan.features
          .map(
            (feat) => `
          <li class="plan-feature-item">
            ${ICONS.check}
            <span>${escapeHtml(feat)}</span>
          </li>
        `
          )
          .join('')}
      </ul>

      <div>${ctaHtml}</div>
    </article>
  `;
}

export async function renderBillingView(container) {
  container.innerHTML = renderPageSkeleton();

  try {
    const [summaryRes, plansRes, historyRes] = await Promise.all([
      api.getBillingSummary(),
      api.getBillingPlans(),
      api.getBillingHistory()
    ]);

    const { subscription } = summaryRes;
    const { plans } = plansRes;
    const invoices = historyRes.items;
    const dateFmt = getState().workspace.dateFormat;

    setState({ subscription }, { silent: true });

    const drawView = () => {
      const billingPeriod = getState().billingPeriod || 'monthly';
      const proPlan = plans.find((p) => p.id === 'pro');
      const savingsPct = proPlan ? proPlan.annualSavingsPercent : 17;

      container.innerHTML = `
        <section class="stack-lg">
          <div class="page-header">
            <div>
              <h1 class="page-title">Billing & Plans</h1>
              <p class="page-subtitle">Manage your subscription and monitor your estimated usage costs.</p>
            </div>
          </div>

          <div class="surface-card">
            <div class="surface-card-header">
              <div>
                <h2 class="card-title">Subscription Summary</h2>
                <p class="card-subtitle">Active workspace subscription and quota status.</p>
              </div>
              <span class="badge ${statusBadgeClass(subscription.status)}">
                <span class="badge-dot"></span>${escapeHtml(subscription.status)}
              </span>
            </div>
            <div class="surface-card-body">
              <div class="subscription-summary-grid">
                <div class="summary-metric">
                  <span class="summary-metric-label">Current Plan</span>
                  <span class="summary-metric-value">${escapeHtml(subscription.planName)}</span>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">Status</span>
                  <span class="summary-metric-value">${escapeHtml(subscription.status)}</span>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">Billing Period</span>
                  <span class="summary-metric-value" style="text-transform: capitalize;">${escapeHtml(subscription.billingPeriod)}</span>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">Next Billing Date</span>
                  <span class="summary-metric-value">${escapeHtml(formatDate(subscription.nextBillingDate, dateFmt))}</span>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">Est. Monthly Usage</span>
                  <span class="summary-metric-value">${escapeHtml(formatCurrency(subscription.estimatedMonthlyUsage))}</span>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">Available Team Seats</span>
                  <span class="summary-metric-value">${escapeHtml(subscription.availableSeats)} of ${escapeHtml(subscription.seatLimit)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="stack-md">
            <div class="billing-toggle-row">
              <div>
                <h2 class="section-title">Compare Plans</h2>
                <p class="section-description">
                  Currently viewing <strong>${billingPeriod === 'annual' ? 'Annual' : 'Monthly'}</strong> pricing.
                </p>
              </div>
              <div class="billing-period-switch">
                <div class="segmented-control" role="tablist" aria-label="Billing period">
                  <button
                    type="button"
                    role="tab"
                    aria-selected="${billingPeriod === 'monthly'}"
                    class="segmented-btn ${billingPeriod === 'monthly' ? 'active' : ''}"
                    data-billing-period="monthly"
                  >Monthly</button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected="${billingPeriod === 'annual'}"
                    class="segmented-btn ${billingPeriod === 'annual' ? 'active' : ''}"
                    data-billing-period="annual"
                  >Annual</button>
                </div>
                <span class="savings-pill">Save ${escapeHtml(savingsPct)}% annually</span>
              </div>
            </div>

            <div class="pricing-grid">
              ${plans.map((p) => renderPlanCard(p, billingPeriod, subscription)).join('')}
            </div>
          </div>

          <div class="surface-card">
            <div class="surface-card-header">
              <div>
                <h2 class="card-title">Billing History</h2>
                <p class="card-subtitle">Fictional invoice records generated for your demo workspace.</p>
              </div>
            </div>
            <div id="billing-history-table"></div>
          </div>
        </section>
      `;

      renderDataTable(container.querySelector('#billing-history-table'), {
        rows: invoices,
        emptyTitle: 'No invoices yet',
        emptyDescription: 'Completed mock checkouts will generate invoice statements here.',
        columns: [
          {
            key: 'id',
            label: 'Invoice ID',
            render: (row) => `<span class="text-mono" style="font-weight: 500;">${escapeHtml(row.id)}</span>`
          },
          {
            key: 'date',
            label: 'Date',
            render: (row) => `<span class="tabular-nums text-secondary">${escapeHtml(formatDate(row.date, dateFmt))}</span>`
          },
          {
            key: 'description',
            label: 'Description',
            render: (row) => `<span>${escapeHtml(row.description)}</span>`
          },
          {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            render: (row) => `<span class="tabular-nums" style="font-weight: 500;">${escapeHtml(formatCurrency(row.amount))}</span>`
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) =>
              `<span class="badge ${statusBadgeClass(row.status)}"><span class="badge-dot"></span>${escapeHtml(row.status)}</span>`
          },
          {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (row) => `
              <button type="button" class="btn btn-secondary btn-sm" data-download-invoice="${escapeHtml(row.id)}">
                ${ICONS.download}
                <span>Download</span>
              </button>
            `
          }
        ]
      });

      // Toggle monthly / annual
      container.querySelectorAll('[data-billing-period]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setState({ billingPeriod: btn.dataset.billingPeriod }, { persist: true, silent: true });
          drawView();
        });
      });

      // Plan buttons
      container.querySelectorAll('[data-plan-action="checkout"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const planId = btn.dataset.planId;
          const period = getState().billingPeriod || 'monthly';
          const originalText = btn.textContent;
          btn.disabled = true;
          btn.innerHTML = `<span class="spinner"></span> Initializing checkout...`;

          try {
            const checkoutRes = await api.createCheckout({
              plan: planId,
              billingPeriod: period
            });
            openMockCheckoutModal(checkoutRes, () => renderBillingView(container));
          } catch (err) {
            showToast({
              type: 'error',
              title: 'Could not initialize checkout',
              description: err.message
            });
          } finally {
            btn.disabled = false;
            btn.textContent = originalText;
          }
        });
      });

      container.querySelectorAll('[data-plan-action="enterprise"]').forEach((btn) => {
        btn.addEventListener('click', openEnterpriseInquiryModal);
      });

      container.querySelectorAll('[data-download-invoice]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const invoiceId = btn.dataset.downloadInvoice;
          btn.disabled = true;
          try {
            const filename = await api.downloadInvoice(invoiceId);
            showToast({
              type: 'success',
              title: 'Invoice downloaded',
              description: `Saved ${filename}`
            });
          } catch (err) {
            showToast({
              type: 'error',
              title: 'Download failed',
              description: err.message
            });
          } finally {
            btn.disabled = false;
          }
        });
      });
    };

    drawView();
  } catch (err) {
    container.innerHTML = renderErrorState({
      title: 'Failed to load billing details',
      message: err.message
    });
    const retry = container.querySelector('#view-retry-btn');
    if (retry) retry.addEventListener('click', () => renderBillingView(container));
  }
}
