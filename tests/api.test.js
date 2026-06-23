// Integration tests for the Grai API (Vitest + Supertest).
//
// These exercise the real Express app against the configured database. They
// focus on:
//   - backward compatibility of GET /api/audiobooks (no params == old behaviour)
//   - the new optional pagination & search
//   - input validation on auth and protected-route guards
//   - the full register → login lifecycle (with cleanup)
//
// Rate limiters are disabled under NODE_ENV=test (set by vitest.config.mjs).

const request = require('supertest');
const app = require('../index.js');
const prisma = require('../lib/prisma');

const uniqueEmail = `vitest-${Date.now()}@example.test`;
let createdUserId = null;

afterAll(async () => {
  // Clean up any user created by the lifecycle test so the DB is left pristine.
  if (createdUserId) {
    await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
  } else {
    await prisma.user.deleteMany({ where: { email: uniqueEmail } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('System', () => {
  it('GET /api/health returns ok with uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('unknown route returns a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/audiobooks — backward compatibility', () => {
  it('with no query params returns { success, data: [] } and NO pagination key', async () => {
    const res = await request(app).get('/api/audiobooks');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // The original contract had no pagination field — preserve it exactly.
    expect(res.body).not.toHaveProperty('pagination');
    // Each book still includes its author and category relations.
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('author');
      expect(res.body.data[0]).toHaveProperty('category');
    }
  });
});

describe('GET /api/audiobooks — optional pagination & search', () => {
  it('paginates when page & limit are supplied', async () => {
    const res = await request(app).get('/api/audiobooks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('filters case-insensitively when search is supplied', async () => {
    // Pull the full list first so the test is data-independent.
    const all = await request(app).get('/api/audiobooks');
    if (all.body.data.length === 0) return; // empty library — nothing to assert

    const target = all.body.data[0];
    // Use the longest, alphanumeric-only word of the title as a distinctive,
    // case-insensitive token (avoids spaces/punctuation that make matching fuzzy).
    const token = target.title
      .split(/\s+/)
      .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .sort((a, b) => b.length - a.length)[0]
      .toLowerCase();

    const res = await request(app).get(`/api/audiobooks?search=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // The originating book must appear in the filtered results...
    expect(res.body.data.map(b => b.id)).toContain(target.id);
    // ...and search must return a subset, never more than the full library.
    expect(res.body.data.length).toBeLessThanOrEqual(all.body.data.length);
  });

  it('returns 404 for a non-existent book id', async () => {
    const res = await request(app).get('/api/audiobooks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('Auth validation', () => {
  it('rejects login with missing fields (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('rejects registration with a weak password (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'weak@example.test', password: '12' });
    expect(res.status).toBe(400);
  });

  it('passes validation through to the controller for well-formed wrong credentials (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'whatever' });
    expect(res.status).toBe(401);
  });
});

describe('Protected routes', () => {
  it('GET /api/reviews/:id without a token returns 401', async () => {
    const res = await request(app).get('/api/reviews/some-id');
    expect(res.status).toBe(401);
  });
});

describe('Register → login lifecycle', () => {
  it('registers a new user then logs in successfully', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Vitest User', email: uniqueEmail, password: 'secret123' });
    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail, password: 'secret123' });
    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
    expect(typeof login.body.token).toBe('string');
    expect(login.body.user.email).toBe(uniqueEmail);

    createdUserId = login.body.user.id;
  });
});
