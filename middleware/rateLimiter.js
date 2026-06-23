// Rate limiting (express-rate-limit). The library was already a dependency but
// was never applied to any route; this wires it in.
//
// Two tiers:
//   apiLimiter   — generous global ceiling, protects the API from abuse/DoS.
//   authLimiter  — strict ceiling on auth endpoints, mitigates brute-force
//                  credential-stuffing against /login and /register.

const rateLimit = require('express-rate-limit');

// Disable limiting under the automated test runner so the integration suite
// can fire many requests without tripping the throttle. No effect on dev/prod.
const skipInTest = () => process.env.NODE_ENV === 'test';

// Global limiter: 1000 requests / 15 min per IP. Generous enough that an active
// listener (progress saved every ~10 s) is never affected, while still capping
// abusive traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,   // RateLimit-* headers
  legacyHeaders: false,
  skip: skipInTest,
  message: { success: false, message: 'Prea multe cereri. Încearcă din nou mai târziu.' },
});

// Auth limiter: 10 attempts / 15 min per IP on login & register.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Count only failed attempts so a legitimate user logging in repeatedly
  // (e.g. across devices) is not penalised.
  skipSuccessfulRequests: true,
  skip: skipInTest,
  message: { success: false, message: 'Prea multe încercări de autentificare. Încearcă din nou în 15 minute.' },
});

module.exports = { apiLimiter, authLimiter };
