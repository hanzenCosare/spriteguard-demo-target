async function request(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  };

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, config);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      (payload && payload.error && payload.error.message) ||
      `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.code = (payload && payload.error && payload.error.code) || 'API_ERROR';
    throw err;
  }

  return payload;
}

async function triggerFileDownload(url, fallbackFilename) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download file (status ${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match ? match[1] : fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return filename;
}

export const api = {
  getHealth: () => request('/health'),

  // Dashboard
  getDashboardSummary: (range = '30d') =>
    request(`/api/dashboard/summary?range=${encodeURIComponent(range)}`),
  getDashboardActivity: (limit = 15) =>
    request(`/api/dashboard/activity?limit=${encodeURIComponent(limit)}`),

  // Usage
  getUsageSummary: (range = '30d') =>
    request(`/api/usage/summary?range=${encodeURIComponent(range)}`),
  getUsageTimeseries: (range = '30d', model = 'all') =>
    request(
      `/api/usage/timeseries?range=${encodeURIComponent(range)}&model=${encodeURIComponent(model)}`
    ),
  getUsageModels: (range = '30d') =>
    request(`/api/usage/models?range=${encodeURIComponent(range)}`),
  downloadUsageCsv: (range = '30d', model = 'all') =>
    triggerFileDownload(
      `/api/usage/export?range=${encodeURIComponent(range)}&model=${encodeURIComponent(model)}`,
      `pulsemetrics-usage-${range}.csv`
    ),

  // API Keys
  getKeys: () => request('/api/keys'),
  getKey: (id) => request(`/api/keys/${encodeURIComponent(id)}`),
  createKey: (payload) => request('/api/keys', { method: 'POST', body: payload }),
  revokeKey: (id) => request(`/api/keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),

  // Billing
  getBillingSummary: () => request('/api/billing/summary'),
  getBillingPlans: () => request('/api/billing/plans'),
  getBillingHistory: () => request('/api/billing/history'),
  createCheckout: (payload) =>
    request('/api/billing/checkout', { method: 'POST', body: payload }),
  confirmCheckout: (sessionId) =>
    request('/api/billing/checkout/confirm', {
      method: 'POST',
      body: { sessionId }
    }),
  downloadInvoice: (invoiceId) =>
    triggerFileDownload(
      `/api/billing/invoices/${encodeURIComponent(invoiceId)}/download`,
      `${invoiceId}.txt`
    ),

  // Team
  getTeam: () => request('/api/team'),
  inviteMember: (payload) =>
    request('/api/team/invitations', { method: 'POST', body: payload }),
  updateMemberRole: (id, role) =>
    request(`/api/team/${encodeURIComponent(id)}/role`, {
      method: 'POST',
      body: { role }
    }),
  removeMemberOrInvite: (id) =>
    request(`/api/team/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (payload) =>
    request('/api/settings', { method: 'PATCH', body: payload })
};
