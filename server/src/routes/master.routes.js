const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const upload = require('../middleware/upload.middleware');
const {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getDesignations, createDesignation, updateDesignation, deleteDesignation,
  getLocations, createLocation, updateLocation, deleteLocation,
  uploadMastersCSV,
} = require('../controllers/master.controller');

// Bulk CSV Upload
router.post('/upload-csv', authenticate, authorize('super_admin', 'admin'), upload.single('file'), uploadMastersCSV);

// Departments
router.get('/departments', authenticate, getDepartments);
router.post('/departments', authenticate, authorize('super_admin', 'admin'), createDepartment);
router.put('/departments/:id', authenticate, authorize('super_admin', 'admin'), updateDepartment);
router.delete('/departments/:id', authenticate, authorize('super_admin', 'admin'), deleteDepartment);

// Designations
router.get('/designations', authenticate, getDesignations);
router.post('/designations', authenticate, authorize('super_admin', 'admin'), createDesignation);
router.put('/designations/:id', authenticate, authorize('super_admin', 'admin'), updateDesignation);
router.delete('/designations/:id', authenticate, authorize('super_admin', 'admin'), deleteDesignation);

// Locations
router.get('/locations', authenticate, getLocations);
router.post('/locations', authenticate, authorize('super_admin', 'admin'), createLocation);
router.put('/locations/:id', authenticate, authorize('super_admin', 'admin'), updateLocation);
router.delete('/locations/:id', authenticate, authorize('super_admin', 'admin'), deleteLocation);

module.exports = router;
