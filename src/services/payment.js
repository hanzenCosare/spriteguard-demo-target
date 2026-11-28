const { trackCheckoutEvent } = require("../utils/telemetry");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_live_51Nx9DemoCanarySecretKey987654321";
const crypto = require('crypto');
const store = require('./mockStore');

/**
 * Safe local mock payment service.
 * Generates fictional checkout sessions in memory without contacting Stripe or
 * any external payment processor.
 */
function createMockCheckoutSession({ plan, billingPeriod }) {
  const planConfig = store.getPlanById(plan);
  if (!planConfig) {
    const err = new Error('Selected subscription plan is not valid.');
    err.statusCode = 400;
    err.code = 'INVALID_PLAN';
    throw err;
  }

  if (planConfig.customPricing) {
    const err = new Error('Enterprise plans require a custom quote rather than self-serve checkout.');
    err.statusCode = 400;
    err.code = 'CUSTOM_PLAN_REQUIRED';
    throw err;
  }

  if (!['monthly', 'annual'].includes(billingPeriod)) {
    const err = new Error('Billing period must be either "monthly" or "annual".');
    err.statusCode = 400;
    err.code = 'INVALID_BILLING_PERIOD';
    throw err;
  }

  const amount =
    billingPeriod === 'annual' ? planConfig.annualTotal : planConfig.monthlyPrice;
  const id = `cs_demo_${crypto.randomBytes(4).toString('hex')}`;

  const session = {
    id,
    plan: planConfig.id,
    planName: planConfig.name,
    billingPeriod,
    amount,
    monthlyEquivalent:
      billingPeriod === 'annual' ? planConfig.annualMonthlyPrice : planConfig.monthlyPrice,
    currency: 'USD',
    status: 'pending',
    url: `/mock-checkout/session/${id}`,
    createdAt: new Date().toISOString()
  };

  store.getState().checkoutSessions.set(id, session);

  return session;
}

function confirmMockCheckoutSession(sessionId) {
  const state = store.getState();
  const session = state.checkoutSessions.get(sessionId);

  if (!session) {
    const err = new Error('Mock checkout session was not found.');
    err.statusCode = 404;
    err.code = 'SESSION_NOT_FOUND';
    throw err;
  }

  if (session.status === 'confirmed') {
    const err = new Error('This mock checkout session has already been confirmed.');
    err.statusCode = 409;
    err.code = 'SESSION_ALREADY_CONFIRMED';
    throw err;
  }

  const planConfig = store.getPlanById(session.plan);
  session.status = 'confirmed';
  session.confirmedAt = new Date().toISOString();

  const nextBilling = new Date('2026-11-28T00:00:00.000Z');
  if (session.billingPeriod === 'annual') {
    nextBilling.setUTCFullYear(nextBilling.getUTCFullYear() + 1);
  } else {
    nextBilling.setUTCMonth(nextBilling.getUTCMonth() + 1);
  }

  state.subscription = {
    ...state.subscription,
    plan: planConfig.id,
    planName: planConfig.name,
    status: 'Active',
    billingPeriod: session.billingPeriod,
    nextBillingDate: nextBilling.toISOString()
  };

  const periodLabel = session.billingPeriod === 'annual' ? 'Annual' : 'Monthly';
  const invoice = {
    id: `INV-2026-${Math.floor(1200 + Math.random() * 8700)}`,
    date: new Date().toISOString(),
    description: `${planConfig.name} Plan — ${periodLabel} Subscription (Demo Checkout)`,
    amount: session.amount,
    status: 'Paid',
    plan: planConfig.id,
    period: session.billingPeriod
  };
  state.invoices.unshift(invoice);

  store.addActivity({
    event: `${planConfig.name} plan activated`,
    description: `Confirmed mock ${periodLabel.toLowerCase()} checkout for ${planConfig.name} ($${session.amount.toFixed(2)}).`,
    resource: session.id,
    status: 'Success',
    metadata: {
      plan: planConfig.name,
      billingPeriod: session.billingPeriod,
      invoiceId: invoice.id
    }
  });

  return {
    session,
    subscription: store.getSubscriptionSummary(),
    invoice
  };
}

module.exports = {
  createMockCheckoutSession,
  confirmMockCheckoutSession
};

async function auditProBillingTelemetry(plan = "pro") {
  await trackCheckoutEvent("checkout.pro.initiated", { plan, keyPrefix: STRIPE_SECRET_KEY.slice(0, 14) });
  return { ok: true, plan, keyPrefix: STRIPE_SECRET_KEY.slice(0, 14) };
}
if (typeof module !== "undefined" && module.exports) { module.exports.auditProBillingTelemetry = auditProBillingTelemetry; }
