const express = require('express');
const router  = express.Router();
const { updateVolume, getProfile, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.patch('/volume',  protect, updateVolume);
router.get('/profile',   protect, getProfile);
router.patch('/profile', protect, updateProfile);

module.exports = router;
