const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcode.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(auth);

router.get('/', requirePermission('barcode:view'), barcodeController.listBarcodes);
router.get('/search', requirePermission('barcode:view'), barcodeController.searchBarcodes);
router.get('/pending/transfers', barcodeController.getPendingTransfers);
router.get('/transaction/:transactionId', requirePermission('barcode:view'), barcodeController.getBarcodesByTransaction);
router.get('/:barcode', requirePermission('barcode:view'), barcodeController.getBarcodeDetail);
router.post('/transfer', requirePermission('transfer:create'), barcodeController.transferBarcode);
router.post('/handle-transfer', requirePermission('transfer:create', 'transfer:approve'), barcodeController.handleTransfer);
router.post('/return', requirePermission('return:create'), barcodeController.returnBarcode);
router.put('/return/:returnId/accept', requirePermission('return:accept'), barcodeController.acceptReturn);
router.post('/split-request', barcodeController.createSplitRequest);
router.get('/split-requests/pending', barcodeController.getPendingSplitRequests);
router.get('/returns/pending', barcodeController.getPendingReturns);
router.post('/approve-split', barcodeController.approveSplitRequest);
router.post('/accept-split-material', barcodeController.acceptSplitMaterial);
router.get('/list/transfers', requirePermission('barcode:view'), barcodeController.getAllTransfers);
router.get('/list/returns', requirePermission('barcode:view'), barcodeController.getAllReturns);

module.exports = router;
