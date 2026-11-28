const express = require('express');
const crypto = require('crypto');
const store = require('../services/mockStore');

const router = express.Router();

const VALID_ENVIRONMENTS = ['production', 'staging', 'development', 'testing'];
const VALID_PERMISSIONS = ['full_access', 'read_write', 'read_only'];

function buildKeysSummary(items) {
  const active = items.filter((k) => k.status === 'active').length;
  const revoked = items.filter((k) => k.status === 'revoked').length;
  const sortedByDate = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    total: items.length,
    active,
    revoked,
    lastCreatedAt: sortedByDate[0] ? sortedByDate[0].createdAt : null
  };
}

router.get('/', (_req, res) => {
  const items = store.getState().apiKeys;
  res.json({
    ok: true,
    summary: buildKeysSummary(items),
    items
  });
});

router.get('/:id', (req, res) => {
  const key = store.getState().apiKeys.find((k) => k.id === req.params.id);
  if (!key) {
    return res.status(404).json({
      ok: false,
      error: {
        code: 'KEY_NOT_FOUND',
        message: 'API key record was not found.'
      }
    });
  }

  return res.json({
    ok: true,
    key
  });
});

router.post('/', (req, res) => {
  const { name, description = '', environment = 'development', permissions = 'read_write' } =
    req.body || {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'API key name is required.'
      }
    });
  }

  if (trimmedName.length > 64) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'API key name must be 64 characters or fewer.'
      }
    });
  }

  if (!VALID_ENVIRONMENTS.includes(environment)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Environment must be production, staging, development, or testing.'
      }
    });
  }

  if (!VALID_PERMISSIONS.includes(permissions)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Permissions must be full_access, read_write, or read_only.'
      }
    });
  }

  const envTag = environment.slice(0, 4);
  const randomPrefix = crypto.randomBytes(2).toString('hex');
  const randomBody = crypto.randomBytes(12).toString('hex');
  const plainTextKey = `pm_test_${envTag}_${randomPrefix}${randomBody}`;
  const prefix = plainTextKey.slice(0, 17);
  const suffix = plainTextKey.slice(-4);

  const record = {
    id: `key_${crypto.randomBytes(4).toString('hex')}`,
    name: trimmedName,
    description: typeof description === 'string' ? description.trim().slice(0, 180) : '',
    prefix,
    maskedValue: `${prefix}••••••••••••${suffix}`,
    environment,
    permissions,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    requestsCount: 0
  };

  const state = store.getState();
  state.apiKeys.unshift(record);

  store.addActivity({
    event: 'API key created',
    description: `Generated fictional test key "${record.name}" (${record.permissions}).`,
    resource: record.prefix,
    status: 'Success',
    metadata: { environment: record.environment, permissions: record.permissions }
  });

  return res.status(201).json({
    ok: true,
    key: record,
    plainTextOnce: plainTextKey,
    notice:
      'This fictional test key is generated strictly for demo purposes. It grants no authentication or production access and will not be shown again once dismissed.',
    summary: buildKeysSummary(state.apiKeys)
  });
});

router.post('/:id/revoke', (req, res) => {
  const state = store.getState();
  const key = state.apiKeys.find((k) => k.id === req.params.id);

  if (!key) {
    return res.status(404).json({
      ok: false,
      error: {
        code: 'KEY_NOT_FOUND',
        message: 'API key record was not found.'
      }
    });
  }

  if (key.status === 'revoked') {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'ALREADY_REVOKED',
        message: 'This API key has already been revoked.'
      }
    });
  }

  key.status = 'revoked';

  store.addActivity({
    event: 'API key revoked',
    description: `Revoked mock API key "${key.name}".`,
    resource: key.prefix,
    status: 'Warning',
    metadata: { environment: key.environment }
  });

  return res.json({
    ok: true,
    key,
    summary: buildKeysSummary(state.apiKeys)
  });
});

module.exports = router;
