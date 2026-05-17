const express = require('express');
const router = express.Router();
const { getFavorites, addFavorite, removeFavorite, toggleFavorite } = require('../controllers/favoriteController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getFavorites);
router.post('/toggle', protect, toggleFavorite);   // must be before /:audiobookId
router.post('/', protect, addFavorite);
router.delete('/:audiobookId', protect, removeFavorite);

module.exports = router;
