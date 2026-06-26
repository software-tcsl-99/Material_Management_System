const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getTransactions, getTransaction, createTransaction, updateTransaction,
  deleteTransaction, acceptTransaction, rejectTransaction, resubmitTransaction,
  exportSingleTransaction, exportSingleTransactionPDF,
} = require('../controllers/transaction.controller');

router.get('/', authenticate, getTransactions);
router.get('/:id', authenticate, getTransaction);
router.post('/', authenticate, createTransaction);
router.put('/:id', authenticate, updateTransaction);
router.delete('/:id', authenticate, deleteTransaction);
router.patch('/:id/accept', authenticate, acceptTransaction);
router.patch('/:id/reject', authenticate, rejectTransaction);
router.post('/:id/resubmit', authenticate, resubmitTransaction);
router.get('/:id/export', authenticate, exportSingleTransaction);
router.get('/:id/export/pdf', authenticate, exportSingleTransactionPDF);

module.exports = router;
