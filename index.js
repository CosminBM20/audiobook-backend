require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prisma = require('./lib/prisma');

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
  : ['process.env.NEXT_PUBLIC_API_URL', 'http://192.168.1.184:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Prea multe încercări. Revino în 15 minute.' },
});

const audiobookRoutes    = require('./routes/audiobookRoutes');
const authRoutes         = require('./routes/authRoutes');
const personalBookRoutes = require('./routes/personalBookRoutes');
const bookmarkRoutes     = require('./routes/bookmarkRoutes');
const listenLaterRoutes  = require('./routes/listenLaterRoutes');
const favoriteRoutes     = require('./routes/favoriteRoutes');

app.use('/api/auth',           authLimiter, authRoutes);
app.use('/api/audiobooks',     audiobookRoutes);
app.use('/api/personal-books', personalBookRoutes);
app.use('/api/bookmarks',      bookmarkRoutes);
app.use('/api/listen-later',   listenLaterRoutes);
app.use('/api/favorites',      favoriteRoutes);

app.get('/api/test', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json({ message: 'Serverul funcționează perfect!', data: categories });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la conectarea cu baza de date.' });
  }
});

app.listen(PORT, () => {
  console.log(`Serverul rulează pe http://localhost:${PORT}`);
});
