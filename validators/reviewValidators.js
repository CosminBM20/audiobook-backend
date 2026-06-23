// Zod schema for the review endpoints. Mirrors the checks already performed
// inside reviewController.upsertReview so behaviour is identical on the happy
// path; the controller keeps its own checks as defence in depth.

const { z } = require('zod');

const upsertReviewSchema = z.object({
  // Accept numeric strings too (forms may send "5") then coerce to int.
  rating: z.coerce.number().int('Evaluarea trebuie să fie un număr întreg.')
    .min(1, 'Evaluarea minimă este 1.')
    .max(5, 'Evaluarea maximă este 5.'),
  comment: z.string().max(2000, 'Comentariul poate avea cel mult 2000 de caractere.').optional().nullable(),
});

module.exports = { upsertReviewSchema };
