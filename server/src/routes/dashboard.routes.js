const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const auth = require('../middleware/auth');

router.use(auth);
router.get('/stats', dashboardController.getStats);
router.get('/charts', dashboardController.getChartData);
router.get('/recent', dashboardController.getRecentActivities);
router.get('/', dashboardController.getDashboard);

module.exports = router;
