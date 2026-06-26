const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getInternalReceipts, createInternalReceipt,
  getExternalReceipts, createExternalReceipt, getReceipt,
  exportReceiptToExcel, exportReceiptToPDF,
} = require('../controllers/receiving.controller');

router.get('/internal', authenticate, getInternalReceipts);
router.post('/internal', authenticate, createInternalReceipt);
router.get('/external', authenticate, getExternalReceipts);
router.post('/external', authenticate, createExternalReceipt);
router.get('/:id', authenticate, getReceipt);
router.get('/:id/export/excel', authenticate, exportReceiptToExcel);
router.get('/:id/export/pdf', authenticate, exportReceiptToPDF);

module.exports = router;
