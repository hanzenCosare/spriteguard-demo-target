function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message =
    statusCode >= 500 && !err.expose
      ? 'An unexpected server error occurred.'
      : err.message || 'Request could not be processed.';

  if (statusCode >= 500) {
    console.error(`[pulsemetrics] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message
    }
  });
}

module.exports = errorHandler;
