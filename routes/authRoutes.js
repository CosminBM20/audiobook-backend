// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/authValidators');

// authLimiter throttles brute-force attempts; validate enforces input shape
// before the controller runs. Both are additive — valid requests behave as before.
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login',    authLimiter, validate(loginSchema),    login);

module.exports = router;