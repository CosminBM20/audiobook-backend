const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { summarize } = require('../controllers/summaryController');

router.post('/', protect, summarize);

module.exports = router;
