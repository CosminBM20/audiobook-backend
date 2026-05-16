const jwt = require('jsonwebtoken');

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

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: "Acces interzis." });
  next();
};

module.exports = { protect, isAdmin };
