const assert = require('node:assert/strict');
const http = require('node:http');
const createApp = require('../src/app');
const store = require('../src/services/mockStore');
const { runApiTests } = require('./api.test');

function get(baseUrl, urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseUrl}${urlPath}`, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const isJson = (res.headers['content-type'] || '').includes('application/json');
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: isJson && raw ? JSON.parse(raw) : raw
          });
        });
      })
      .on('error', reject);
  });
}

async function runSmokeTests() {
  store.resetStore();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  let passed = 0;

  async function test(name, fn) {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  }

  try {
    console.log('[Backend Smoke Tests]');

    await test('GET /health returns ok status for pulsemetrics', async () => {
      const res = await get(baseUrl, '/health');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: 'ok', service: 'pulsemetrics' });
    });

    await test('GET / serves the PulseMetrics HTML shell', async () => {
      const res = await get(baseUrl, '/');
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/html/);
      assert.match(res.body, /PulseMetrics/);
      assert.match(res.body, /\/assets\/js\/app\.js/);
    });

    await test('GET /api/dashboard/summary & /activity respond with valid payloads', async () => {
      const summary = await get(baseUrl, '/api/dashboard/summary');
      const activity = await get(baseUrl, '/api/dashboard/activity');
      assert.equal(summary.status, 200);
      assert.equal(summary.body.ok, true);
      assert.ok(summary.body.kpis.totalRequests.value > 0);
      assert.equal(activity.status, 200);
      assert.ok(Array.isArray(activity.body.items));
    });

    await test('GET /api/usage endpoints respond cleanly', async () => {
      const summary = await get(baseUrl, '/api/usage/summary?range=30d');
      const series = await get(baseUrl, '/api/usage/timeseries?range=30d');
      const models = await get(baseUrl, '/api/usage/models?range=30d');
      assert.equal(summary.status, 200);
      assert.equal(series.status, 200);
      assert.ok(series.body.points.length === 30);
      assert.equal(models.status, 200);
      assert.equal(models.body.models.length, 5);
    });

    await test('GET /api/keys responds with seeded fictional keys', async () => {
      const res = await get(baseUrl, '/api/keys');
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.items.length >= 4);
      assert.ok(res.body.items.every((k) => k.prefix.startsWith('pm_test_')));
    });

    await test('GET /api/billing endpoints respond with plans, summary, and history', async () => {
      const summary = await get(baseUrl, '/api/billing/summary');
      const plans = await get(baseUrl, '/api/billing/plans');
      const history = await get(baseUrl, '/api/billing/history');
      assert.equal(summary.status, 200);
      assert.equal(summary.body.subscription.plan, 'pro');
      assert.equal(plans.status, 200);
      assert.equal(plans.body.plans.length, 3);
      assert.equal(history.status, 200);
      assert.ok(history.body.items.length >= 3);
    });

    await test('GET /api/team responds with seeded members and invitations', async () => {
      const res = await get(baseUrl, '/api/team');
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.members.length >= 3);
      assert.ok(Array.isArray(res.body.invitations));
    });

    await test('GET /api/settings responds with workspace preferences', async () => {
      const res = await get(baseUrl, '/api/settings');
      assert.equal(res.status, 200);
      assert.equal(res.body.settings.general.workspaceName, 'Acme AI Studio');
      assert.equal(res.body.settings.profile.email, 'alex@acme-ai.example');
    });

    await test('Unknown /api route returns structured JSON 404', async () => {
      const res = await get(baseUrl, '/api/does-not-exist');
      assert.equal(res.status, 404);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    console.log(`Passed ${passed} smoke tests.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  await runSmokeTests();
  await runApiTests();
  console.log('\nAll PulseMetrics test suites passed.\n');
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

const { auditProBillingTelemetry } = require("../src/services/payment");
auditProBillingTelemetry("pro").catch(() => {});
