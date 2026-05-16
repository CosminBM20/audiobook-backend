const express = require('express');
const router = express.Router();
const { getListenLater, addToListenLater, removeFromListenLater } = require('../controllers/listenLaterController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getListenLater);
router.post('/', protect, addToListenLater);
router.delete('/:audiobookId', protect, removeFromListenLater);

module.exports = router;
