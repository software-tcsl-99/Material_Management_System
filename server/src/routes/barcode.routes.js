const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getBarcodes,
  getBarcodeByCode,
  transferBarcode,
  approveTransfer,
  rejectTransfer,
  returnBarcode,
  confirmReturnBarcode,
  splitBarcode,
  getBarcodeChat,
  createBarcodeChat
} = require('../controllers/barcode.controller');

router.get('/', authenticate, getBarcodes);
router.get('/:barcode', authenticate, getBarcodeByCode);
router.post('/:barcode/transfer', authenticate, transferBarcode);
router.post('/:barcode/approve-transfer', authenticate, approveTransfer);
router.post('/:barcode/reject-transfer', authenticate, rejectTransfer);
router.post('/:barcode/return', authenticate, returnBarcode);
router.post('/:barcode/confirm-return', authenticate, confirmReturnBarcode);
router.post('/:barcode/split', authenticate, splitBarcode);
router.get('/:barcode/chat', authenticate, getBarcodeChat);
router.post('/:barcode/chat', authenticate, createBarcodeChat);

module.exports = router;
