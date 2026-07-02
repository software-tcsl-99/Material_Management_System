const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getInternalReceipts, createInternalReceipt,
  getExternalReceipts, createExternalReceipt, getReceipt,
  exportReceiptToExcel, exportReceiptToPDF,
} = require('../controllers/receiving.controller');

router.use(auth);

router.get('/internal', getInternalReceipts);
router.post('/internal', createInternalReceipt);
router.get('/external', getExternalReceipts);
router.post('/external', createExternalReceipt);
router.get('/:id', getReceipt);
router.get('/:id/export/excel', exportReceiptToExcel);
router.get('/:id/export/pdf', exportReceiptToPDF);

module.exports = router;
