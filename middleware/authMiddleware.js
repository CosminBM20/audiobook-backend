const jwt = require('jsonwebtoken');

// ╔══════════════════════════════════════════════════════════════╗
// ║  SCREENSHOT: Listing 3.1 — Verificarea tokenului JWT        ║
// ║  Capturați întreaga funcție protect de mai jos               ║
// ╚══════════════════════════════════════════════════════════════╝
const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Acces refuzat. Lipsă token." });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token invalid." });
  }
};
// ╚══ SFARSIT Listing 3.1 ══════════════════════════════════════╝

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: "Acces interzis." });
  next();
};

module.exports = { protect, isAdmin };
