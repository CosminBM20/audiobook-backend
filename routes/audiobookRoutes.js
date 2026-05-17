const express = require('express');
const router = express.Router();

const {
  getAllAudiobooks,
  getAudiobookById,
  saveProgress,
  getProgress,
  getUserDashboard,
  getUserStats,
  getActivity,
  createAudiobook,
  createMultiChapterAudiobook,
  updateAudiobook,
  deleteAudiobook,
} = require('../controllers/audiobookController');

const { protect, isAdmin } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/', getAllAudiobooks);
router.post('/progress', protect, saveProgress);
router.get('/progress/:audiobookId', protect, getProgress);
router.get('/my-books', protect, getUserDashboard);
router.get('/stats', protect, getUserStats);
router.get('/activity', protect, getActivity);
router.post('/', protect, isAdmin, upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'audioFile', maxCount: 1 }]), createAudiobook);
router.post('/multi', protect, isAdmin, upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'audioFiles', maxCount: 20 }]), createMultiChapterAudiobook);
router.patch('/:id', protect, isAdmin, upload.fields([{ name: 'coverImage', maxCount: 1 }]), updateAudiobook);
router.delete('/:id', protect, isAdmin, deleteAudiobook);
router.get('/:id', getAudiobookById);

module.exports = router;
