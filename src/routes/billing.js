const express = require('express');
const store = require('../services/mockStore');
const paymentService = require('../services/payment');

const router = express.Router();

router.get('/summary', (_req, res) => {
  res.json({
    ok: true,
    subscription: store.getSubscriptionSummary()
  });
});

router.get('/plans', (_req, res) => {
  res.json({
    ok: true,
    plans: store.getPlans()
  });
});

router.get('/history', (_req, res) => {
  res.json({
    ok: true,
    items: store.getState().invoices
  });
});

router.get('/invoices/:id/download', (req, res) => {
  const state = store.getState();
  const invoice = state.invoices.find((inv) => inv.id === req.params.id);

  if (!invoice) {
    return res.status(404).json({
      ok: false,
      error: {
        code: 'INVOICE_NOT_FOUND',
        message: 'Requested invoice record was not found.'
      }
    });
  }

  const lines = [
    '============================================================',
    'PULSEMETRICS — MOCK INVOICE STATEMENT (DEMONSTRATION ONLY)',
    '============================================================',
    `Invoice ID:    ${invoice.id}`,
    `Issue Date:    ${invoice.date.slice(0, 10)}`,
    `Status:        ${invoice.status}`,
    `Workspace:     ${state.settings.general.workspaceName}`,
    `Account Owner: ${state.settings.profile.name} <${state.settings.profile.email}>`,
    '------------------------------------------------------------',
    `Description:   ${invoice.description}`,
    `Billing Cycle: ${invoice.period}`,
    `Amount Due:    $${invoice.amount.toFixed(2)} USD`,
    '------------------------------------------------------------',
    'Notice: This is a fictional invoice generated for demo use.',
    'No real payment was processed or charged.',
    '============================================================'
  ];

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.id}.txt"`);
  return res.send(lines.join('\n'));
});

router.post('/checkout', (req, res, next) => {
  try {
    const body = req.body || {};

    if (body.cardNumber || body.cvc || body.card) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'UNSUPPORTED_PAYMENT_DATA',
          message: 'Mock checkout does not accept payment card information.'
        }
      });
    }

    const { plan, billingPeriod = 'monthly' } = body;
    if (!plan || typeof plan !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid plan identifier is required.'
        }
      });
    }

    const session = paymentService.createMockCheckoutSession({ plan, billingPeriod });

    return res.status(201).json({
      ok: true,
      session
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/checkout/confirm', (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid mock checkout sessionId is required.'
        }
      });
    }

    const result = paymentService.confirmMockCheckoutSession(sessionId);
    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
