const express = require('express');
const router = express.Router();
const empController = require('../controllers/employee.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(auth);

router.get('/', requirePermission('user:view'), empController.getEmployees);
router.get('/:id', requirePermission('user:view'), empController.getEmployee);
router.post('/', requirePermission('user:create'), empController.createEmployee);
router.put('/:id', requirePermission('user:edit'), empController.updateEmployee);
router.put('/:id/toggle-status', requirePermission('user:edit'), empController.toggleStatus);

module.exports = router;
