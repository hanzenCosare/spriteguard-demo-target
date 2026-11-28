const express = require('express');
const store = require('../services/mockStore');

const router = express.Router();

router.get('/summary', (req, res) => {
  const range = store.getValidRange(req.query.range);
  const dataset = store.getUsageDataset(range);
  const state = store.getState();

  const sparklineStep = Math.max(1, Math.floor(dataset.points.length / 10));
  const sampled = dataset.points.filter((_, idx) => idx % sparklineStep === 0);

  res.json({
    ok: true,
    range,
    comparisonLabel: dataset.comparisonLabel,
    kpis: {
      totalRequests: {
        value: dataset.summary.totalRequests,
        delta: dataset.deltas.requests,
        sparkline: sampled.map((p) => p.requests)
      },
      totalTokens: {
        value: dataset.summary.totalTokens,
        delta: dataset.deltas.tokens,
        sparkline: sampled.map((p) => p.tokens)
      },
      estimatedSpend: {
        value: dataset.summary.estimatedCost,
        delta: dataset.deltas.spend,
        sparkline: sampled.map((p) => p.cost)
      },
      successRate: {
        value: dataset.summary.successRate,
        delta: dataset.deltas.successRate,
        sparkline: sampled.map((p) => Number((100 - p.errorRate).toFixed(2)))
      }
    },
    workspace: state.settings.general,
    subscription: store.getSubscriptionSummary()
  });
});

router.get('/activity', (req, res) => {
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 15;
  const items = store.getState().activity.slice(0, limit);

  res.json({
    ok: true,
    items
  });
});

module.exports = router;
