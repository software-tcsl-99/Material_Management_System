const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(auth);

// Departments
router.get('/departments', requirePermission('master:view'), masterController.getDepartments);
router.post('/departments', requirePermission('master:create'), masterController.createDepartment);
router.put('/departments/:id', requirePermission('master:edit'), masterController.updateDepartment);
router.delete('/departments/:id', requirePermission('master:delete'), masterController.deleteDepartment);

// Designations
router.get('/designations', requirePermission('master:view'), masterController.getDesignations);
router.post('/designations', requirePermission('master:create'), masterController.createDesignation);
router.put('/designations/:id', requirePermission('master:edit'), masterController.updateDesignation);
router.delete('/designations/:id', requirePermission('master:delete'), masterController.deleteDesignation);

// Locations
router.get('/locations', requirePermission('master:view'), masterController.getLocations);
router.post('/locations', requirePermission('master:create'), masterController.createLocation);
router.put('/locations/:id', requirePermission('master:edit'), masterController.updateLocation);
router.delete('/locations/:id', requirePermission('master:delete'), masterController.deleteLocation);

module.exports = router;
