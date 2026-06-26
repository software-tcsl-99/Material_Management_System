const { uploadToCloudinary, useMock } = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists for local mock storage
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// POST /api/upload
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const folder = req.body.folder || 'mms/photos';
    const result = await uploadToCloudinary(req.file.buffer, folder);

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed.', error: error.message });
  }
};

// POST /api/upload/base64
const uploadBase64 = async (req, res) => {
  try {
    const { image, folder = 'mms/photos' } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'No image data provided.' });
    }

    if (useMock) {
      // Decode base64 image data
      // e.g. "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let extension = 'jpg';
      
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
        const mimeType = matches[1];
        if (mimeType.includes('png')) extension = 'png';
      } else {
        // Fallback if not a data URI format, just standard base64 string
        buffer = Buffer.from(image, 'base64');
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
      const uploadPath = path.join(__dirname, '../../uploads', filename);
      
      await fs.promises.writeFile(uploadPath, buffer);
      
      const port = process.env.PORT || 5000;
      return res.json({
        url: `http://localhost:${port}/uploads/${filename}`,
        publicId: filename,
      });
    }

    try {
      const result = await new Promise((resolve, reject) => {
        require('cloudinary').v2.uploader.upload(
          image,
          { folder, resource_type: 'image' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
      });
    } catch (cloudinaryErr) {
      console.warn('⚠️ Cloudinary base64 upload failed. Falling back to local storage:', cloudinaryErr.message);
      
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let extension = 'jpg';
      
      if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
        const mimeType = matches[1];
        if (mimeType.includes('png')) extension = 'png';
      } else {
        buffer = Buffer.from(image, 'base64');
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
      const uploadPath = path.join(__dirname, '../../uploads', filename);
      
      await fs.promises.writeFile(uploadPath, buffer);
      
      const port = process.env.PORT || 5000;
      res.json({
        url: `http://localhost:${port}/uploads/${filename}`,
        publicId: filename,
      });
    }
  } catch (error) {
    console.error('Base64 upload error:', error);
    res.status(500).json({ message: 'Upload failed.', error: error.message });
  }
};

module.exports = { uploadImage, uploadBase64 };

