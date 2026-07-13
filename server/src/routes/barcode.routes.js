const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcode.controller');
const barcodeExportController = require('../controllers/barcodeExport.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(auth);

router.get('/store-available', barcodeController.getStoreAvailableBarcodes);
router.get('/', requirePermission('barcode:view'), barcodeController.listBarcodes);
router.get('/search', requirePermission('barcode:view'), barcodeController.searchBarcodes);
router.get('/pending/transfers', barcodeController.getPendingTransfers);
router.get('/list/transfers', barcodeController.getAllTransfers);
router.get('/list/returns', barcodeController.getAllReturns);
router.get('/split-requests/pending', requirePermission('approval:view'), barcodeController.getPendingSplitRequests);
router.get('/returns/pending', requirePermission('return:view'), barcodeController.getPendingReturns);
router.get('/close-requests/pending', requirePermission('approval:view'), barcodeController.getPendingCloseRequests);
router.get('/transaction/:transactionId', requirePermission('barcode:view'), barcodeController.getBarcodesByTransaction);
router.get('/:barcode', requirePermission('barcode:view'), barcodeController.getBarcodeDetail);
router.post('/transfer', requirePermission('transfer:create'), barcodeController.transferBarcode);
router.post('/handle-transfer', requirePermission('transfer:create', 'transfer:approve'), barcodeController.handleTransfer);
router.post('/return', requirePermission('return:create'), barcodeController.returnBarcode);
router.put('/return/:returnId/accept', requirePermission('return:accept'), barcodeController.acceptReturn);
router.put('/return/:returnId/handler-action', barcodeController.handleReturnHandlerAction);
router.put('/return/:returnId/assign-handler', barcodeController.assignReturnHandler);
router.post('/split-request', requirePermission('material:view'), barcodeController.createSplitRequest);
router.post('/approve-split', requirePermission('approval:approve'), barcodeController.approveSplitRequest);
router.post('/close-request', requirePermission('barcode:view'), barcodeController.createCloseRequest);
router.post('/close-requests/:requestId/respond', requirePermission('approval:approve'), barcodeController.handleCloseRequest);
router.get('/exchange-requests/pending', requirePermission('approval:view'), barcodeController.getPendingExchangeRequests);
router.post('/exchange-request', requirePermission('material:view'), barcodeController.createExchangeRequest);
router.post('/exchange-requests/:requestId/respond', requirePermission('approval:approve'), barcodeController.handleExchangeRequest);
router.get('/exchange-requests/transaction/:transactionId', requirePermission('barcode:view'), barcodeController.getExchangeRequestsByTransaction);
router.get('/:barcode/export/excel', requirePermission('barcode:view'), barcodeExportController.exportBarcodeToExcel);
router.get('/:barcode/export/pdf', requirePermission('barcode:view'), barcodeExportController.exportBarcodeToPDF);

module.exports = router;
