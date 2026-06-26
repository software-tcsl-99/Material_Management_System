const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const { getAuditLogs } = require('../controllers/audit.controller');

router.get('/', authenticate, authorize('super_admin', 'admin'), getAuditLogs);

module.exports = router;
