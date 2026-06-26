const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getReportData, exportReport } = require('../controllers/report.controller');

router.get('/', authenticate, getReportData);
router.get('/export', authenticate, exportReport);

module.exports = router;
