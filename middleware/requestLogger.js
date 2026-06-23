// Lightweight request-logging middleware built on the shared Winston logger.
// Logs method, path, status code and response time for every request — the
// foundation of the observability discussion in the dissertation.

const logger = require('../lib/logger');

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
    };

    // 5xx → error, 4xx → warn, everything else → http/info.
    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl}`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl}`, meta);
    } else {
      logger.info(`${req.method} ${req.originalUrl}`, meta);
    }
  });

  next();
}

module.exports = requestLogger;
