const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(auth);

router.get('/transactions', requirePermission('report:view'), reportController.getTransactionReport);
router.get('/transactions/export', requirePermission('report:export'), reportController.exportTransactionReport);
router.get('/', requirePermission('report:view'), reportController.getTransactionReport);
router.get('/export', requirePermission('report:export'), reportController.exportTransactionReport);

module.exports = router;
