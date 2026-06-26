const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const useMock = 
  !process.env.CLOUDINARY_CLOUD_NAME || 
  !process.env.CLOUDINARY_API_KEY || 
  process.env.CLOUDINARY_API_KEY.startsWith('your_');

if (!useMock) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.log('⚠️  Cloudinary not configured. Running in Local Disk Upload Mock mode.');
  // Ensure local uploads directory exists
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

const uploadToCloudinary = async (fileBuffer, folder = 'mms') => {
  if (useMock) {
    // Write buffer to local uploads folder
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
    const uploadPath = path.join(__dirname, '../../uploads', filename);
    
    await fs.promises.writeFile(uploadPath, fileBuffer);
    
    const port = process.env.PORT || 5000;
    return {
      secure_url: `http://localhost:${port}/uploads/${filename}`,
      public_id: filename,
      width: 800,
      height: 600,
      format: 'jpg',
    };
  }

  try {
    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(fileBuffer);
    });
  } catch (cloudinaryError) {
    console.error('⚠️ Cloudinary upload failed. Falling back to Local Disk Upload Mock mode:', cloudinaryError.message);
    
    // Ensure local uploads directory exists
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
    const uploadPath = path.join(__dirname, '../../uploads', filename);
    
    await fs.promises.writeFile(uploadPath, fileBuffer);
    
    const port = process.env.PORT || 5000;
    return {
      secure_url: `http://localhost:${port}/uploads/${filename}`,
      public_id: filename,
      width: 800,
      height: 600,
      format: 'jpg',
    };
  }
};

module.exports = { cloudinary, uploadToCloudinary, useMock };

