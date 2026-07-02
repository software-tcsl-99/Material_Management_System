const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const auth = require('../middleware/auth');

router.use(auth);
router.post('/', uploadController.uploadMiddleware, uploadController.uploadFile);

module.exports = router;
