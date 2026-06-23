import { defineConfig } from 'vitest/config';

// Integration tests run against the real exported Express app (Supertest) and
// the configured database. NODE_ENV=test disables the rate limiters so the
// suite can fire many requests freely (see middleware/rateLimiter.js).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: { NODE_ENV: 'test' },
  },
});
