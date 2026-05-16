const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = {
  coverImage: ['image/jpeg', 'image/png', 'image/webp'],
  audioFile:  ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'],
  pdfFile:    ['application/pdf'],
};

const fileFilter = (req, file, cb) => {
  const allowed = ALLOWED_TYPES[file.fieldname];
  if (!allowed || allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tip de fișier invalid pentru câmpul "${file.fieldname}".`));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter,
});

module.exports = { cloudinary, upload };
