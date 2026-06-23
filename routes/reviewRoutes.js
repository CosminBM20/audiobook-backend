const express = require('express');
const router = express.Router();
const { getReviews, getUserReview, upsertReview, deleteReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { upsertReviewSchema } = require('../validators/reviewValidators');

router.get('/:audiobookId',       protect, getReviews);
router.get('/:audiobookId/mine',  protect, getUserReview);
router.post('/:audiobookId',      protect, validate(upsertReviewSchema), upsertReview);
router.delete('/:audiobookId',    protect, deleteReview);

module.exports = router;
