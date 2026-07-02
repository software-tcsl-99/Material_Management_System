const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(auth);
router.get('/', requirePermission('audit:view', 'audit:view_all'), auditController.getAuditLogs);

module.exports = router;
