const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const upload = require('../middleware/upload.middleware');
const {
  getEmployees, getEmployee, createEmployee, updateEmployee,
  toggleEmployeeStatus, resetPassword, updateProfile, uploadProfilePhoto,
  uploadEmployeesCSV,
} = require('../controllers/employee.controller');

// Self routes (must be before parameterized /:id routes)
router.put('/profile/update', authenticate, updateProfile);
router.post('/profile/photo', authenticate, upload.single('photo'), uploadProfilePhoto);

// Admin routes
// Allow any authenticated user to fetch the employees list (used by transaction forms)
router.get('/', authenticate, getEmployees);
router.get('/:id', authenticate, getEmployee);
router.post('/', authenticate, authorize('super_admin', 'admin'), createEmployee);
router.put('/:id', authenticate, authorize('super_admin', 'admin'), updateEmployee);
router.patch('/:id/status', authenticate, authorize('super_admin', 'admin'), toggleEmployeeStatus);
router.patch('/:id/reset-password', authenticate, authorize('super_admin', 'admin'), resetPassword);
router.post('/upload-csv', authenticate, authorize('super_admin', 'admin'), upload.single('file'), uploadEmployeesCSV);

module.exports = router;

