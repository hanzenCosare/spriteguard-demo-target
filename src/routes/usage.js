const express = require('express');
const store = require('../services/mockStore');

const router = express.Router();

router.get('/summary', (req, res) => {
  const range = store.getValidRange(req.query.range);
  const dataset = store.getUsageDataset(range);

  res.json({
    ok: true,
    range,
    comparisonLabel: dataset.comparisonLabel,
    summary: dataset.summary
  });
});

router.get('/timeseries', (req, res) => {
  const range = store.getValidRange(req.query.range);
  const modelFilter = req.query.model || 'all';
  const dataset = store.getUsageDataset(range);

  const points = dataset.points.map((point) => {
    if (modelFilter && modelFilter !== 'all' && point.byModel[modelFilter]) {
      const m = point.byModel[modelFilter];
      return {
        timestamp: point.timestamp,
        label: point.label,
        requests: m.requests,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        tokens: m.tokens,
        cost: m.cost,
        errorRate: point.errorRate
      };
    }

    return {
      timestamp: point.timestamp,
      label: point.label,
      requests: point.requests,
      inputTokens: point.inputTokens,
      outputTokens: point.outputTokens,
      tokens: point.tokens,
      cost: point.cost,
      errorRate: point.errorRate
    };
  });

  res.json({
    ok: true,
    range,
    model: modelFilter,
    points
  });
});

router.get('/models', (req, res) => {
  const range = store.getValidRange(req.query.range);
  const dataset = store.getUsageDataset(range);

  res.json({
    ok: true,
    range,
    models: dataset.models
  });
});

router.get('/export', (req, res) => {
  const range = store.getValidRange(req.query.range);
  const modelFilter = req.query.model || 'all';
  const dataset = store.getUsageDataset(range);

  const header = [
    'Date',
    'Model',
    'Requests',
    'Input Tokens',
    'Output Tokens',
    'Total Tokens',
    'Estimated Cost (USD)'
  ];

  const rows = [header.join(',')];
  const modelsToExport =
    modelFilter === 'all'
      ? dataset.models
      : dataset.models.filter((m) => m.id === modelFilter);

  dataset.points.forEach((point) => {
    modelsToExport.forEach((m) => {
      const entry = point.byModel[m.id];
      if (!entry) return;
      const csvRow = [
        point.timestamp.slice(0, 10),
        `"${m.model}"`,
        entry.requests,
        entry.inputTokens,
        entry.outputTokens,
        entry.tokens,
        entry.cost.toFixed(2)
      ];
      rows.push(csvRow.join(','));
    });
  });

  const filename = `pulsemetrics-usage-${range}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(rows.join('\n'));
});

module.exports = router;
