// Centralised error handling. These run ONLY on unmatched routes or when an
// error reaches Express — every existing controller still handles its own
// try/catch and sends its own response, so successful and already-handled
// requests are completely unaffected. This simply replaces Express's default
// HTML error/404 pages with consistent JSON envelopes and proper logging.

const multer = require('multer');
const logger = require('../lib/logger');

// 404 — mounted after all routes.
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.method} ${req.originalUrl} nu există.`,
  });
}

// Final error handler — must keep the 4-argument signature for Express.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Multer surfaces upload problems (size limit, invalid file type) as errors.
  if (err instanceof multer.MulterError) {
    logger.warn(`Upload error: ${err.message}`, { code: err.code, path: req.originalUrl });
    return res.status(400).json({ success: false, message: `Eroare la încărcare: ${err.message}` });
  }

  // The custom fileFilter in config/cloudinary.js throws a plain Error.
  if (err && /Tip de fișier invalid/.test(err.message || '')) {
    logger.warn(err.message, { path: req.originalUrl });
    return res.status(400).json({ success: false, message: err.message });
  }

  // If headers were already sent, delegate to Express's default handler.
  if (res.headersSent) return next(err);

  logger.error(err.message || 'Eroare necunoscută', { stack: err.stack, path: req.originalUrl });
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Eroare internă de server.' : (err.message || 'Eroare internă de server.'),
  });
}

module.exports = { notFoundHandler, errorHandler };
