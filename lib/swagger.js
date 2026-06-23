// OpenAPI 3.0 specification for the Grai API, served via Swagger UI at /api/docs.
// Defined as a standalone document so the existing route files are left
// untouched. Covers the core resources; the gamification, favourites,
// listen-later and personal-book routes follow the same conventions.

const swaggerJsdoc = require('swagger-jsdoc');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Grai Audiobook Platform API',
    version: '1.0.0',
    description:
      'REST API for the Grai audiobook & PDF-to-speech platform. ' +
      'Authentication uses JWT Bearer tokens. Endpoints marked with a lock require a valid token.',
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Local development' },
  ],
  tags: [
    { name: 'Auth', description: 'Registration and login' },
    { name: 'Audiobooks', description: 'Public library, playback progress and stats' },
    { name: 'Reviews', description: 'Ratings and reviews per audiobook' },
    { name: 'System', description: 'Operational endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
      Audiobook: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          coverImageUrl: { type: 'string', nullable: true },
          audioFileUrl: { type: 'string' },
          durationSeconds: { type: 'integer' },
          language: { type: 'string', example: 'ro' },
          author: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
          category: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
        },
      },
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          user: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness & readiness probe',
        responses: {
          200: { description: 'Service healthy' },
          503: { description: 'Database unreachable' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a new account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Maria Pop' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created' },
          400: { description: 'Validation error or email already used', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          429: { description: 'Too many attempts (rate limited)' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT token and user profile returned' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Too many attempts (rate limited)' },
        },
      },
    },
    '/api/audiobooks': {
      get: {
        tags: ['Audiobooks'],
        summary: 'List audiobooks (optional pagination & search)',
        description:
          'With no query parameters the full library is returned (backward-compatible default). ' +
          'Providing page/limit enables pagination; providing search filters by title, description, author or category.',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Page number (enables pagination)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 }, description: 'Items per page' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Full-text-ish filter across title/description/author/category' },
        ],
        responses: {
          200: {
            description: 'Array of audiobooks (plus a pagination object when paginated)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Audiobook' } },
                    pagination: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        page: { type: 'integer' }, limit: { type: 'integer' },
                        total: { type: 'integer' }, totalPages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/audiobooks/{id}': {
      get: {
        tags: ['Audiobooks'],
        summary: 'Get a single audiobook with its chapters',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Audiobook found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Audiobook' } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/audiobooks/progress': {
      post: {
        tags: ['Audiobooks'],
        summary: 'Save listening position',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['audiobookId', 'currentPosition'],
                properties: {
                  audiobookId: { type: 'string', format: 'uuid' },
                  currentPosition: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Progress saved' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/reviews/{audiobookId}': {
      get: {
        tags: ['Reviews'],
        summary: 'List reviews + average rating for a book',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'audiobookId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Reviews, count and average',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        reviews: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
                        count: { type: 'integer' },
                        averageRating: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Reviews'],
        summary: 'Create or update the current user\'s review',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'audiobookId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rating'],
                properties: {
                  rating: { type: 'integer', minimum: 1, maximum: 5 },
                  comment: { type: 'string', maxLength: 2000, nullable: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Review saved' }, 400: { description: 'Validation error' }, 401: { description: 'Unauthorized' } },
      },
      delete: {
        tags: ['Reviews'],
        summary: 'Delete the current user\'s review',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'audiobookId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' }, 401: { description: 'Unauthorized' } },
      },
    },
  },
};

// swagger-jsdoc lets the spec be extended later via JSDoc @openapi comments in
// route files if desired; for now the static definition above is the source.
const swaggerSpec = swaggerJsdoc({ definition, apis: [] });

module.exports = { swaggerSpec };
