const express    = require('express');
const router     = express.Router();
const { updateVolume } = require('../controllers/userController');
const { protect }      = require('../middleware/authMiddleware');

router.patch('/volume', protect, updateVolume);

module.exports = router;
