const multer = require('multer');

const storage = multer.memoryStorage();

// Accept ALL files – validation is handled downstream if needed.
// This prevents multer from throwing 500-level errors for edge-case
// MIME types (e.g. blob uploads from canvas, WebKit quirks, etc.)
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = upload;
