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
router.put('/return/:returnId/handler-action', barcodeController.handleReturnHandlerAction);
router.put('/return/:returnId/assign-handler', barcodeController.assignReturnHandler);
router.post('/split-request', requirePermission('material:view'), barcodeController.createSplitRequest);
router.get('/split-requests/pending', requirePermission('approval:view'), barcodeController.getPendingSplitRequests);
router.get('/returns/pending', requirePermission('approval:view'), barcodeController.getPendingReturns);
router.post('/approve-split', requirePermission('approval:approve'), barcodeController.approveSplitRequest);
router.post('/close-request', requirePermission('barcode:view'), barcodeController.createCloseRequest);
router.get('/close-requests/pending', requirePermission('approval:view'), barcodeController.getPendingCloseRequests);
router.post('/close-requests/:requestId/respond', requirePermission('approval:approve'), barcodeController.handleCloseRequest);

module.exports = router;
