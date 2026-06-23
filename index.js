// ╔══════════════════════════════════════════════════════════════╗
// ║  SCREENSHOT: Anexa B — Serverul Backend Principal           ║
// ║  Capturați întregul fișier index.js                          ║
// ╚══════════════════════════════════════════════════════════════╝
require('dotenv').config();
console.log("DB URL Check:", process.env.DATABASE_URL ? "Defined" : "UNDEFINED");
console.log("JWT Check:", process.env.JWT_SECRET ? "Defined" : "UNDEFINED");
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const prisma = require('./lib/prisma');
const logger = require('./lib/logger');
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { swaggerSpec } = require('./lib/swagger');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],  // needed by some email clients / PDFs
      imgSrc:     ["'self'", 'data:', 'https://res.cloudinary.com', 'https://placehold.co'],
      mediaSrc:   ["'self'", 'https://res.cloudinary.com'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'", 'data:'],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // allows Cloudinary media
}));

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
  : ['http://localhost:3000', 'http://192.168.1.184:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// Structured request logging (method, path, status, response time).
app.use(requestLogger);

// Global rate limiter — protects the whole API from abuse/DoS. Auth routes add
// a second, stricter limiter on top (see authRoutes.js).
app.use('/api', apiLimiter);

const audiobookRoutes    = require('./routes/audiobookRoutes');
const authRoutes         = require('./routes/authRoutes');
const userRoutes         = require('./routes/userRoutes');
const personalBookRoutes = require('./routes/personalBookRoutes');
const bookmarkRoutes     = require('./routes/bookmarkRoutes');
const listenLaterRoutes  = require('./routes/listenLaterRoutes');
const favoriteRoutes     = require('./routes/favoriteRoutes');
const summaryRoutes      = require('./routes/summaryRoutes');
const challengeRoutes    = require('./routes/challengeRoutes');
const reviewRoutes       = require('./routes/reviewRoutes');

app.use('/api/auth',           authRoutes);
app.use('/api/user',           userRoutes);
app.use('/api/audiobooks',     audiobookRoutes);
app.use('/api/personal-books', personalBookRoutes);
app.use('/api/bookmarks',      bookmarkRoutes);
app.use('/api/listen-later',   listenLaterRoutes);
app.use('/api/favorites',      favoriteRoutes);
app.use('/api/summarize',      summaryRoutes);
app.use('/api/challenges',     challengeRoutes);
app.use('/api/reviews',        reviewRoutes);

app.get('/api/test', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json({ message: 'Serverul funcționează perfect!', data: categories });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la conectarea cu baza de date.' });
  }
});

// ── Interactive API documentation (OpenAPI 3.0 / Swagger UI) ────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Grai API Docs' }));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ── Health probe — verifies the process is up and the database reachable ────
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
});

// ── Fallback handlers — must be registered last ─────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// Only start listening when run directly (`node index.js`). When the file is
// imported (e.g. by the integration test suite via Supertest) the configured
// app is exported without binding a port.
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Serverul rulează pe http://localhost:${PORT}`);
  });
}

module.exports = app;
