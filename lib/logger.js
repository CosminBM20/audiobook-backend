// Centralised structured logger (Winston).
// Single shared instance, imported wherever logging is needed — mirrors the
// singleton pattern already used for the Prisma client in lib/prisma.js.

const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

// Human-readable colourised output for local development; JSON in production
// so logs can be ingested by log aggregators (ELK, Loki, CloudWatch, etc.).
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${rest}`;
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  // Never let a logging failure crash the API.
  exitOnError: false,
});

module.exports = logger;
