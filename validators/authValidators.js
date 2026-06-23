// Zod schemas for the authentication endpoints.
//
// Design note: the schemas accept everything the current frontend already
// sends, so no existing flow breaks. They ADD guards:
//   - register enforces a valid email and a minimum password length (the
//     "password strength" recommendation from the audit), applied only to NEW
//     accounts so existing users are never affected.
//   - login intentionally does NOT enforce password strength — that would lock
//     out any account created before this rule existed.

const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Numele este obligatoriu.').max(120),
  email: z.string().trim().email('Adresă de email invalidă.').max(254),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere.').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email('Adresă de email invalidă.').max(254),
  password: z.string().min(1, 'Parola este obligatorie.').max(200),
});

module.exports = { registerSchema, loginSchema };
