const createApp = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PulseMetrics mock SaaS server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
