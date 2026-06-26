const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { uploadImage, uploadBase64 } = require('../controllers/upload.controller');

// Wrap multer in error-catching middleware so any multer error
// returns a clean 400 instead of a raw 500
router.post('/', authenticate, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    next();
  });
}, uploadImage);

router.post('/base64', authenticate, uploadBase64);

module.exports = router;
