// Generic Zod validation middleware.
//
// Usage: router.post('/login', validate(loginSchema), loginController)
//
// On success the parsed (and coerced) value replaces req.body so controllers
// receive clean, typed data. On failure it returns 400 with a consistent
// error envelope — the existing controllers' own checks remain in place as a
// second line of defence, so behaviour on the happy path is unchanged.

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map(i => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Date invalide.',
        errors,
      });
    }
    // Replace with the parsed value (coercions applied) without dropping
    // properties the schema passes through.
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
