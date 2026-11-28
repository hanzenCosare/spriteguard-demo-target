const assert = require('node:assert/strict');
const http = require('node:http');
const createApp = require('../src/app');
const store = require('../src/services/mockStore');

function requestJson(baseUrl, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request(
      `${baseUrl}${urlPath}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            : {})
        }
      },
      (res) => {
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
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runApiTests() {
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
    console.log('\n[API Behavior Tests]');

    await test('Dashboard summary and Usage summary report consistent spend and requests', async () => {
      const dash = await requestJson(baseUrl, 'GET', '/api/dashboard/summary?range=30d');
      const usage = await requestJson(baseUrl, 'GET', '/api/usage/summary?range=30d');
      assert.equal(dash.status, 200);
      assert.equal(usage.status, 200);
      assert.equal(dash.body.kpis.totalRequests.value, usage.body.summary.totalRequests);
      assert.equal(dash.body.kpis.estimatedSpend.value, usage.body.summary.estimatedCost);
    });

    await test('Usage CSV export generates downloadable CSV content', async () => {
      const res = await requestJson(baseUrl, 'GET', '/api/usage/export?range=7d');
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/csv/);
      assert.match(res.headers['content-disposition'], /pulsemetrics-usage-7d\.csv/);
      assert.ok(res.body.startsWith('Date,Model,Requests,Input Tokens,Output Tokens,Total Tokens,Estimated Cost (USD)'));
      assert.ok(res.body.split('\n').length > 5);
    });

    let createdKeyId = null;

    await test('Creating a fictional API key succeeds with pm_test_ prefix', async () => {
      const res = await requestJson(baseUrl, 'POST', '/api/keys', {
        name: 'CI Analytics Worker',
        description: 'Automated test key',
        environment: 'testing',
        permissions: 'read_only'
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.plainTextOnce.startsWith('pm_test_'));
      assert.equal(res.body.key.status, 'active');
      createdKeyId = res.body.key.id;
    });

    await test('Empty API key name is rejected with 400 VALIDATION_ERROR', async () => {
      const res = await requestJson(baseUrl, 'POST', '/api/keys', {
        name: '   ',
        environment: 'development',
        permissions: 'read_write'
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    await test('Revoking an API key updates its status immediately', async () => {
      const res = await requestJson(baseUrl, 'POST', `/api/keys/${createdKeyId}/revoke`);
      assert.equal(res.status, 200);
      assert.equal(res.body.key.status, 'revoked');

      const detail = await requestJson(baseUrl, 'GET', `/api/keys/${createdKeyId}`);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.key.status, 'revoked');
    });

    await test('Mock checkout initialization and confirmation update subscription and history', async () => {
      const initRes = await requestJson(baseUrl, 'POST', '/api/billing/checkout', {
        plan: 'pro',
        billingPeriod: 'annual'
      });
      assert.equal(initRes.status, 201);
      assert.equal(initRes.body.ok, true);
      assert.ok(initRes.body.session.id.startsWith('cs_demo_'));
      assert.equal(initRes.body.session.billingPeriod, 'annual');

      const confirmRes = await requestJson(baseUrl, 'POST', '/api/billing/checkout/confirm', {
        sessionId: initRes.body.session.id
      });
      assert.equal(confirmRes.status, 200);
      assert.equal(confirmRes.body.subscription.plan, 'pro');
      assert.equal(confirmRes.body.subscription.billingPeriod, 'annual');
      assert.equal(confirmRes.body.invoice.status, 'Paid');
    });

    await test('Invalid checkout requests and card payloads are rejected', async () => {
      const invalidPlan = await requestJson(baseUrl, 'POST', '/api/billing/checkout', {
        plan: 'nonexistent',
        billingPeriod: 'monthly'
      });
      assert.equal(invalidPlan.status, 400);
      assert.equal(invalidPlan.body.ok, false);

      const cardAttempt = await requestJson(baseUrl, 'POST', '/api/billing/checkout', {
        plan: 'pro',
        billingPeriod: 'monthly',
        cardNumber: '4242'
      });
      assert.equal(cardAttempt.status, 400);
      assert.equal(cardAttempt.body.error.code, 'UNSUPPORTED_PAYMENT_DATA');
    });

    let inviteId = null;

    await test('Team invitations succeed and reject invalid or duplicate emails', async () => {
      const badEmail = await requestJson(baseUrl, 'POST', '/api/team/invitations', {
        email: 'not-an-email',
        role: 'Developer'
      });
      assert.equal(badEmail.status, 400);
      assert.equal(badEmail.body.error.code, 'VALIDATION_ERROR');

      const validInvite = await requestJson(baseUrl, 'POST', '/api/team/invitations', {
        email: 'jordan.lee@acme-ai.example',
        role: 'Viewer',
        message: 'Welcome aboard'
      });
      assert.equal(validInvite.status, 201);
      assert.equal(validInvite.body.invitation.status, 'Pending');
      inviteId = validInvite.body.invitation.id;

      const duplicate = await requestJson(baseUrl, 'POST', '/api/team/invitations', {
        email: 'jordan.lee@acme-ai.example',
        role: 'Viewer'
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.error.code, 'DUPLICATE_INVITATION');
    });

    await test('Team role updates and invitation cancellation work cleanly', async () => {
      const roleRes = await requestJson(baseUrl, 'POST', '/api/team/mem_03/role', {
        role: 'Admin'
      });
      assert.equal(roleRes.status, 200);
      assert.equal(roleRes.body.member.role, 'Admin');

      const cancelRes = await requestJson(baseUrl, 'DELETE', `/api/team/${inviteId}`);
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.kind, 'invitation');
    });

    await test('Workspace settings persist updates and validate input', async () => {
      const badRes = await requestJson(baseUrl, 'PATCH', '/api/settings', {
        general: { workspaceName: '' }
      });
      assert.equal(badRes.status, 400);

      const okRes = await requestJson(baseUrl, 'PATCH', '/api/settings', {
        general: {
          workspaceName: 'Acme AI Platform',
          workspaceId: 'acme-ai-platform',
          timezone: 'UTC'
        },
        notifications: {
          productUpdates: true
        }
      });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.settings.general.workspaceName, 'Acme AI Platform');
      assert.equal(okRes.body.settings.notifications.productUpdates, true);

      const reload = await requestJson(baseUrl, 'GET', '/api/settings');
      assert.equal(reload.body.settings.general.workspaceName, 'Acme AI Platform');
    });

    console.log(`Passed ${passed} API behavior tests.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.resetStore();
  }
}

if (require.main === module) {
  runApiTests().catch((err) => {
    console.error('API tests failed:', err);
    process.exit(1);
  });
}

module.exports = { runApiTests };
