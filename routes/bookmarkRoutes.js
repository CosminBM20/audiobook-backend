const express = require('express');
const router = express.Router();
const { addBookmark, getBookmarks, deleteBookmark } = require('../controllers/bookmarkController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, addBookmark);
router.get('/:audiobookId', protect, getBookmarks);
router.delete('/:id', protect, deleteBookmark);

module.exports = router;
