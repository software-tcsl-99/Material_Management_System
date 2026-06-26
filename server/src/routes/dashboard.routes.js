const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getStats, getChartData, getRecentActivities, getPendingApprovals } = require('../controllers/dashboard.controller');

router.get('/stats', authenticate, getStats);
router.get('/charts', authenticate, getChartData);
router.get('/recent', authenticate, getRecentActivities);
router.get('/pending', authenticate, getPendingApprovals);

module.exports = router;
