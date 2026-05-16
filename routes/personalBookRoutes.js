const express = require('express');
const router  = express.Router();
const {
  uploadPersonalPdf,
  getMyPersonalBooks,
  getPersonalBookContent,
  deletePersonalBook,
} = require('../controllers/personalBookController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/',                    protect, getMyPersonalBooks);
router.get('/:id/content',         protect, getPersonalBookContent);  // lazy content load
router.post('/upload',             protect, upload.single('pdfFile'), uploadPersonalPdf);
router.delete('/:id',              protect, deletePersonalBook);

module.exports = router;
