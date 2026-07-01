const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Route imports
const authRoutes = require('./routes/auth.routes');
const employeeRoutes = require('./routes/employee.routes');
const transactionRoutes = require('./routes/transaction.routes');
const receivingRoutes = require('./routes/receiving.routes');
const masterRoutes = require('./routes/master.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const auditRoutes = require('./routes/audit.routes');
const searchRoutes = require('./routes/search.routes');
const uploadRoutes = require('./routes/upload.routes');
const barcodeRoutes = require('./routes/barcode.routes');

const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  message: { message: 'Too many login attempts. Please try again later.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads for local mock testing
const path = require('path');
// Serve uploads via Cloudinary only. Local static uploads are disabled to enforce
// cloud storage usage for production and cross-origin reliability.
if (process.env.CLOUDINARY_BASE_URL) {
  // Example CLOUDINARY_BASE_URL: https://res.cloudinary.com/<cloudName>/image/upload
  // Use a regex route to capture the remainder of the path in a way compatible
  // with the installed path-to-regexp version.
  app.get(/^\/uploads\/(.*)$/, (req, res) => {
    const key = req.params[0] || '';
    const normalizedKey = key.replace(/^\/+/, '');
    const base = String(process.env.CLOUDINARY_BASE_URL).replace(/\/+$/g, '');
    const url = `${base}/${normalizedKey}`;
    return res.redirect(302, url);
  });
} else {
  // When Cloudinary is not configured, respond with a clear error to guide setup.
  app.get(/^\/uploads\/(.*)$/, (req, res) => {
    res.status(503).json({
      message:
        'Cloud storage not configured. Set CLOUDINARY_BASE_URL to a valid Cloudinary base URL to serve uploads.',
    });
  });
}

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/receiving', receivingRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/barcodes', barcodeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err.name === 'MulterError' || err.message?.includes('Only image files')) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

module.exports = app;
