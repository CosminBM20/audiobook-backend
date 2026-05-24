const express = require('express');
const router  = express.Router();
const {
  uploadPersonalPdf,
  getMyPersonalBooks,
  getPersonalBookContent,
  deletePersonalBook,
} = require('../controllers/personalBookController');
const { getProgress, upsertProgress } = require('../controllers/personalBookProgressController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/',                    protect, getMyPersonalBooks);
router.get('/:id/progress',        protect, getProgress);
router.post('/:id/progress',       protect, upsertProgress);
router.get('/:id/content',         protect, getPersonalBookContent);
router.post('/upload',             protect, upload.single('pdfFile'), uploadPersonalPdf);
router.delete('/:id',              protect, deletePersonalBook);

module.exports = router;
