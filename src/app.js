const path = require('path');
const express = require('express');

const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const usageRoutes = require('./routes/usage');
const keysRoutes = require('./routes/keys');
const billingRoutes = require('./routes/billing');
const teamRoutes = require('./routes/team');
const settingsRoutes = require('./routes/settings');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // API and service health endpoints
  app.use('/health', healthRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/usage', usageRoutes);
  app.use('/api/keys', keysRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/settings', settingsRoutes);

  // Static frontend assets
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // Unmatched API routes return structured JSON 404
  app.use('/api', notFound);

  // SPA fallback for client-side dashboard routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      return notFound(req, res);
    }
    return res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
