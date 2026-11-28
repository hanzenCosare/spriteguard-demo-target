const crypto = require('crypto');

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For individual developers prototyping AI integrations.',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualTotal: 0,
    customPricing: false,
    requestLimit: 100000,
    requestLimitLabel: '100,000 requests / mo',
    seatLimit: 1,
    features: [
      '100,000 requests per month',
      'Basic analytics and 7-day retention',
      'One team member',
      'Community support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For growing engineering teams shipping AI products.',
    monthlyPrice: 29,
    annualMonthlyPrice: 24,
    annualTotal: 288,
    annualSavingsPercent: 17,
    customPricing: false,
    highlighted: true,
    requestLimit: 2000000,
    requestLimitLabel: '2,000,000 requests / mo',
    seatLimit: 5,
    features: [
      '2,000,000 requests per month',
      'Advanced analytics and 90-day retention',
      'Five team members',
      'Exportable CSV usage reports',
      'Priority support'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For organizations with strict scale and governance needs.',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    annualTotal: null,
    customPricing: true,
    requestLimit: 25000000,
    requestLimitLabel: 'Custom usage limits',
    seatLimit: 50,
    features: [
      'Custom usage limits and SLAs',
      'Advanced team management and RBAC',
      'Dedicated solutions support',
      'Custom telemetry integrations'
    ]
  }
];

const MODEL_PROFILES = [
  {
    id: 'gpt-4.1',
    model: 'GPT-4.1',
    color: '#635BDB',
    requestWeight: 0.34,
    avgInputTokens: 54,
    avgOutputTokens: 28,
    inputCostPer1M: 3.1,
    outputCostPer1M: 9.8
  },
  {
    id: 'gpt-4.1-mini',
    model: 'GPT-4.1 Mini',
    color: '#2D7FF9',
    requestWeight: 0.29,
    avgInputTokens: 42,
    avgOutputTokens: 20,
    inputCostPer1M: 0.65,
    outputCostPer1M: 1.9
  },
  {
    id: 'claude-sonnet',
    model: 'Claude Sonnet',
    color: '#16A36A',
    requestWeight: 0.2,
    avgInputTokens: 51,
    avgOutputTokens: 26,
    inputCostPer1M: 2.8,
    outputCostPer1M: 8.6
  },
  {
    id: 'claude-haiku',
    model: 'Claude Haiku',
    color: '#D99432',
    requestWeight: 0.12,
    avgInputTokens: 35,
    avgOutputTokens: 16,
    inputCostPer1M: 0.45,
    outputCostPer1M: 1.4
  },
  {
    id: 'other',
    model: 'Other',
    color: '#8E95A9',
    requestWeight: 0.05,
    avgInputTokens: 30,
    avgOutputTokens: 14,
    inputCostPer1M: 0.8,
    outputCostPer1M: 2.1
  }
];

const RANGE_CONFIGS = {
  '24h': {
    points: 24,
    stepUnit: 'hour',
    targetRequests: 46820,
    comparisonLabel: 'vs. previous 24 hours',
    deltas: { requests: 9.4, tokens: 7.1, spend: 4.8, successRate: 0.08 },
    baseErrorRate: 0.16
  },
  '7d': {
    points: 7,
    stepUnit: 'day',
    targetRequests: 312480,
    comparisonLabel: 'vs. previous 7 days',
    deltas: { requests: 11.2, tokens: 7.9, spend: 4.9, successRate: 0.11 },
    baseErrorRate: 0.17
  },
  '30d': {
    points: 30,
    stepUnit: 'day',
    targetRequests: 1284392,
    comparisonLabel: 'vs. previous 30 days',
    deltas: { requests: 12.8, tokens: 8.4, spend: 5.2, successRate: 0.14 },
    baseErrorRate: 0.18
  },
  '90d': {
    points: 30,
    stepUnit: '3day',
    targetRequests: 3648910,
    comparisonLabel: 'vs. previous 90 days',
    deltas: { requests: 21.6, tokens: 18.2, spend: 14.5, successRate: 0.22 },
    baseErrorRate: 0.21
  }
};

function deterministicWave(index, seed) {
  const s1 = Math.sin((index + 1) * 0.62 + seed);
  const s2 = Math.cos((index + 1) * 0.29 + seed * 1.7);
  return 1 + s1 * 0.14 + s2 * 0.08;
}

function buildUsageDataset(rangeKey) {
  const cfg = RANGE_CONFIGS[rangeKey] || RANGE_CONFIGS['30d'];
  const anchor = new Date('2026-11-28T12:00:00.000Z');
  const seed = rangeKey.length * 1.9;

  const rawWeights = [];
  let weightSum = 0;
  for (let i = 0; i < cfg.points; i += 1) {
    const trend = 0.9 + (i / Math.max(1, cfg.points - 1)) * 0.22;
    const w = deterministicWave(i, seed) * trend;
    rawWeights.push(w);
    weightSum += w;
  }

  const points = [];
  const modelTotals = MODEL_PROFILES.map((m) => ({
    id: m.id,
    model: m.model,
    color: m.color,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0
  }));

  let assignedRequests = 0;

  for (let i = 0; i < cfg.points; i += 1) {
    const offset = cfg.points - 1 - i;
    const date = new Date(anchor.getTime());
    if (cfg.stepUnit === 'hour') {
      date.setUTCHours(date.getUTCHours() - offset);
    } else if (cfg.stepUnit === '3day') {
      date.setUTCDate(date.getUTCDate() - offset * 3);
    } else {
      date.setUTCDate(date.getUTCDate() - offset);
    }

    const label =
      cfg.stepUnit === 'hour'
        ? `${String(date.getUTCHours()).padStart(2, '0')}:00`
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

    const reqCount =
      i === cfg.points - 1
        ? Math.max(100, cfg.targetRequests - assignedRequests)
        : Math.round((rawWeights[i] / weightSum) * cfg.targetRequests);
    assignedRequests += reqCount;

    const byModel = {};
    let pointInputTokens = 0;
    let pointOutputTokens = 0;
    let pointCost = 0;
    let assignedModelReq = 0;

    MODEL_PROFILES.forEach((profile, mIdx) => {
      const mReq =
        mIdx === MODEL_PROFILES.length - 1
          ? Math.max(0, reqCount - assignedModelReq)
          : Math.round(reqCount * profile.requestWeight);
      assignedModelReq += mReq;

      const variance = 0.97 + ((i + mIdx) % 5) * 0.015;
      const inTok = Math.round(mReq * profile.avgInputTokens * variance);
      const outTok = Math.round(mReq * profile.avgOutputTokens * variance);
      const cost =
        (inTok / 1_000_000) * profile.inputCostPer1M +
        (outTok / 1_000_000) * profile.outputCostPer1M;

      byModel[profile.id] = {
        requests: mReq,
        inputTokens: inTok,
        outputTokens: outTok,
        tokens: inTok + outTok,
        cost: Number(cost.toFixed(2))
      };

      pointInputTokens += inTok;
      pointOutputTokens += outTok;
      pointCost += cost;

      modelTotals[mIdx].requests += mReq;
      modelTotals[mIdx].inputTokens += inTok;
      modelTotals[mIdx].outputTokens += outTok;
      modelTotals[mIdx].totalTokens += inTok + outTok;
      modelTotals[mIdx].estimatedCost += cost;
    });

    const errJitter = ((i % 4) - 1.5) * 0.02;
    const errorRate = Number(Math.max(0.06, cfg.baseErrorRate + errJitter).toFixed(2));

    points.push({
      timestamp: date.toISOString(),
      label,
      requests: reqCount,
      inputTokens: pointInputTokens,
      outputTokens: pointOutputTokens,
      tokens: pointInputTokens + pointOutputTokens,
      cost: Number(pointCost.toFixed(2)),
      errorRate,
      byModel
    });
  }

  const totalRequests = modelTotals.reduce((acc, m) => acc + m.requests, 0);
  const inputTokens = modelTotals.reduce((acc, m) => acc + m.inputTokens, 0);
  const outputTokens = modelTotals.reduce((acc, m) => acc + m.outputTokens, 0);
  const totalTokens = inputTokens + outputTokens;
  const estimatedCost = Number(
    modelTotals.reduce((acc, m) => acc + m.estimatedCost, 0).toFixed(2)
  );
  const errorRate = cfg.baseErrorRate;
  const successRate = Number((100 - errorRate).toFixed(2));

  const models = modelTotals.map((m) => ({
    ...m,
    estimatedCost: Number(m.estimatedCost.toFixed(2)),
    percentage: Number(((m.requests / Math.max(1, totalRequests)) * 100).toFixed(1))
  }));

  return {
    range: rangeKey,
    comparisonLabel: cfg.comparisonLabel,
    deltas: cfg.deltas,
    summary: {
      totalRequests,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      errorRate,
      successRate
    },
    points,
    models
  };
}

function createInitialState() {
  const usageByRange = {
    '24h': buildUsageDataset('24h'),
    '7d': buildUsageDataset('7d'),
    '30d': buildUsageDataset('30d'),
    '90d': buildUsageDataset('90d')
  };

  return {
    workspaces: [
      { id: 'acme-ai-studio', name: 'Acme AI Studio', plan: 'pro', region: 'us-east-1' },
      { id: 'acme-staging', name: 'Acme Staging', plan: 'free', region: 'us-west-2' }
    ],
    activeWorkspaceId: 'acme-ai-studio',
    usageByRange,
    subscription: {
      plan: 'pro',
      planName: 'Pro',
      status: 'Active',
      billingPeriod: 'monthly',
      nextBillingDate: '2026-12-28T00:00:00.000Z',
      currency: 'USD'
    },
    checkoutSessions: new Map(),
    invoices: [
      {
        id: 'INV-2026-1104',
        date: '2026-11-01T08:00:00.000Z',
        description: 'Pro Plan — Monthly Subscription (Nov 2026)',
        amount: 29.0,
        status: 'Paid',
        plan: 'pro',
        period: 'monthly'
      },
      {
        id: 'INV-2026-1004',
        date: '2026-10-01T08:00:00.000Z',
        description: 'Pro Plan — Monthly Subscription (Oct 2026)',
        amount: 29.0,
        status: 'Paid',
        plan: 'pro',
        period: 'monthly'
      },
      {
        id: 'INV-2026-0912',
        date: '2026-09-14T15:20:00.000Z',
        description: 'Overage Compute Buffer — 150k extra requests',
        amount: 14.5,
        status: 'Paid',
        plan: 'pro',
        period: 'one-time'
      },
      {
        id: 'INV-2026-0901',
        date: '2026-09-01T08:00:00.000Z',
        description: 'Pro Plan — Monthly Subscription (Sep 2026)',
        amount: 29.0,
        status: 'Pending',
        plan: 'pro',
        period: 'monthly'
      },
      {
        id: 'INV-2026-0801',
        date: '2026-08-01T08:00:00.000Z',
        description: 'Pro Plan — Retry Charge (Demo Card Expired)',
        amount: 29.0,
        status: 'Failed',
        plan: 'pro',
        period: 'monthly'
      }
    ],
    apiKeys: [
      {
        id: 'key_prod_01',
        name: 'Production Backend',
        description: 'Primary inference gateway service for customer workflows',
        prefix: 'pm_test_prod_8f2a',
        maskedValue: 'pm_test_prod_8f2a••••••••••••9d1c',
        environment: 'production',
        permissions: 'read_write',
        status: 'active',
        createdAt: '2026-09-12T10:15:00.000Z',
        lastUsedAt: '2026-11-28T11:42:00.000Z',
        requestsCount: 842910
      },
      {
        id: 'key_dev_02',
        name: 'Development Environment',
        description: 'Local engineering sandboxes and prompt evaluation runners',
        prefix: 'pm_test_dev_4b9e',
        maskedValue: 'pm_test_dev_4b9e••••••••••••2a7f',
        environment: 'development',
        permissions: 'full_access',
        status: 'active',
        createdAt: '2026-10-03T14:30:00.000Z',
        lastUsedAt: '2026-11-28T10:05:00.000Z',
        requestsCount: 214550
      },
      {
        id: 'key_mob_03',
        name: 'Mobile Application',
        description: 'Read-only analytics feed for internal iOS status widget',
        prefix: 'pm_test_mob_1c7d',
        maskedValue: 'pm_test_mob_1c7d••••••••••••6e3b',
        environment: 'staging',
        permissions: 'read_only',
        status: 'active',
        createdAt: '2026-10-21T09:10:00.000Z',
        lastUsedAt: '2026-11-27T21:18:00.000Z',
        requestsCount: 169420
      },
      {
        id: 'key_qa_04',
        name: 'Testing Integration',
        description: 'Legacy CI integration key retired after token rotation',
        prefix: 'pm_test_qa_9e0f',
        maskedValue: 'pm_test_qa_9e0f••••••••••••4b10',
        environment: 'testing',
        permissions: 'read_write',
        status: 'revoked',
        createdAt: '2026-08-19T16:45:00.000Z',
        lastUsedAt: '2026-10-11T08:04:00.000Z',
        requestsCount: 57512
      }
    ],
    members: [
      {
        id: 'mem_01',
        name: 'Alex Morgan',
        email: 'alex@acme-ai.example',
        initials: 'AM',
        role: 'Owner',
        status: 'Active',
        title: 'Head of AI Platform',
        joinedAt: '2026-06-04T09:00:00.000Z'
      },
      {
        id: 'mem_02',
        name: 'Priya Nair',
        email: 'priya.nair@acme-ai.example',
        initials: 'PN',
        role: 'Admin',
        status: 'Active',
        title: 'Staff Backend Engineer',
        joinedAt: '2026-07-12T11:30:00.000Z'
      },
      {
        id: 'mem_03',
        name: 'Marcus Chen',
        email: 'marcus.chen@acme-ai.example',
        initials: 'MC',
        role: 'Developer',
        status: 'Active',
        title: 'ML Infrastructure Engineer',
        joinedAt: '2026-08-22T15:10:00.000Z'
      }
    ],
    invitations: [
      {
        id: 'inv_01',
        email: 'elena.rodriguez@acme-ai.example',
        role: 'Developer',
        status: 'Pending',
        message: 'Welcome to the Acme AI Studio analytics workspace.',
        invitedBy: 'Alex Morgan',
        createdAt: '2026-11-26T16:20:00.000Z'
      }
    ],
    activity: [
      {
        id: 'act_01',
        event: 'API key created',
        description: 'Created mock key "Mobile Application" with read_only scope.',
        resource: 'pm_test_mob_1c7d',
        actor: 'Alex Morgan',
        timestamp: '2026-11-28T09:40:00.000Z',
        status: 'Success',
        metadata: { environment: 'staging', permissions: 'read_only' }
      },
      {
        id: 'act_02',
        event: 'Pro plan activated',
        description: 'Workspace subscription confirmed on Pro (Monthly).',
        resource: 'sub_acme_pro',
        actor: 'Alex Morgan',
        timestamp: '2026-11-27T18:15:00.000Z',
        status: 'Success',
        metadata: { plan: 'Pro', billingPeriod: 'monthly', amount: '$29.00' }
      },
      {
        id: 'act_03',
        event: 'Usage threshold reached',
        description: 'Monthly API request volume crossed 60% of the Pro quota.',
        resource: 'quota/requests',
        actor: 'System Monitor',
        timestamp: '2026-11-27T11:05:00.000Z',
        status: 'Warning',
        metadata: { utilization: '64.2%', limit: '2,000,000 requests' }
      },
      {
        id: 'act_04',
        event: 'Team member invited',
        description: 'Pending Developer invitation sent to elena.rodriguez@acme-ai.example.',
        resource: 'inv_01',
        actor: 'Alex Morgan',
        timestamp: '2026-11-26T16:20:00.000Z',
        status: 'Pending',
        metadata: { email: 'elena.rodriguez@acme-ai.example', role: 'Developer' }
      },
      {
        id: 'act_05',
        event: 'Billing configuration updated',
        description: 'Updated invoice notification recipients and currency display.',
        resource: 'billing/config',
        actor: 'Priya Nair',
        timestamp: '2026-11-24T13:52:00.000Z',
        status: 'Success',
        metadata: { currency: 'USD', notifications: 'enabled' }
      }
    ],
    settings: {
      general: {
        workspaceName: 'Acme AI Studio',
        workspaceId: 'acme-ai-studio',
        timezone: 'America/Los_Angeles',
        dateFormat: 'MMM D, YYYY'
      },
      profile: {
        name: 'Alex Morgan',
        email: 'alex@acme-ai.example',
        avatarInitials: 'AM',
        jobTitle: 'Head of AI Platform'
      },
      notifications: {
        usageThresholdAlerts: true,
        billingNotifications: true,
        securityNotifications: true,
        weeklyUsageReports: true,
        productUpdates: false
      },
      security: {
        sessionTimeoutMinutes: 60,
        loginNotifications: true,
        apiKeyRotationDays: 90
      },
      activeSessions: [
        {
          id: 'sess_local_01',
          device: 'macOS — Chrome 131 (Current session)',
          location: 'San Francisco, US (Demo)',
          lastActive: 'Active now',
          current: true
        },
        {
          id: 'sess_local_02',
          device: 'Ubuntu Linux — CLI Token Inspector',
          location: 'Oregon, US (Demo)',
          lastActive: '2 hours ago',
          current: false
        }
      ]
    }
  };
}

let state = createInitialState();

function resetStore() {
  state = createInitialState();
}

function getPlans() {
  return PLANS;
}

function getPlanById(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

function getValidRange(range) {
  return Object.prototype.hasOwnProperty.call(state.usageByRange, range) ? range : '30d';
}

function getUsageDataset(range) {
  return state.usageByRange[getValidRange(range)];
}

function addActivity({ event, description, resource, actor, status = 'Success', metadata = {} }) {
  const entry = {
    id: `act_${crypto.randomBytes(4).toString('hex')}`,
    event,
    description,
    resource,
    actor: actor || state.settings.profile.name,
    timestamp: new Date().toISOString(),
    status,
    metadata
  };
  state.activity.unshift(entry);
  if (state.activity.length > 50) {
    state.activity.pop();
  }
  return entry;
}

function getSubscriptionSummary() {
  const planConfig = getPlanById(state.subscription.plan) || PLANS[1];
  const usage30d = state.usageByRange['30d'].summary;
  const seatsUsed = state.members.length + state.invitations.length;
  const seatLimit = planConfig.seatLimit;

  return {
    plan: state.subscription.plan,
    planName: planConfig.name,
    status: state.subscription.status,
    billingPeriod: state.subscription.billingPeriod,
    nextBillingDate: state.subscription.nextBillingDate,
    estimatedMonthlyUsage: usage30d.estimatedCost,
    requestsUsed: usage30d.totalRequests,
    requestLimit: planConfig.requestLimit,
    seatsUsed,
    seatLimit,
    availableSeats: Math.max(0, seatLimit - seatsUsed),
    currency: state.subscription.currency
  };
}

function getTeamSummary() {
  const planConfig = getPlanById(state.subscription.plan) || PLANS[1];
  const seatLimit = planConfig.seatLimit;
  const activeMembers = state.members.length;
  const pendingInvitations = state.invitations.length;
  const usedSeats = activeMembers + pendingInvitations;

  return {
    totalMembers: activeMembers,
    pendingInvitations,
    seatLimit,
    usedSeats,
    availableSeats: Math.max(0, seatLimit - usedSeats),
    plan: planConfig.name
  };
}

function getState() {
  return state;
}

module.exports = {
  getState,
  resetStore,
  getPlans,
  getPlanById,
  getValidRange,
  getUsageDataset,
  addActivity,
  getSubscriptionSummary,
  getTeamSummary
};
