const Transaction = require('../models/Transaction');
const Barcode = require('../models/Barcode');
const ExcelJS = require('exceljs');

// Helper function to build transaction filter based on query parameters and user role permissions
const buildReportFilter = async (req) => {
  const { 
    startDate, 
    endDate, 
    department, 
    status, 
    documentType, 
    sender, 
    receiver, 
    handler, 
    barcode, 
    expectedReturnDate,
    flow,
    scope
  } = req.query;

  const filter = {};

  // Status Filter
  if (status && status !== 'all' && status !== '') {
    filter.status = status;
  }

  // Document Type Filter
  if (documentType && documentType !== 'all' && documentType !== '') {
    filter.documentType = documentType;
  }

  // Date Range (Created At)
  if (startDate && endDate) {
    filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  } else if (startDate) {
    filter.createdAt = { $gte: new Date(startDate) };
  } else if (endDate) {
    filter.createdAt = { $lte: new Date(endDate) };
  }

  // Expected Return Date Filter
  if (expectedReturnDate) {
    const targetDate = new Date(expectedReturnDate);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    filter.expectedReturnDate = { $gte: startOfDay, $lte: endOfDay };
  }

  // Department Filter
  if (department && department !== 'all' && department !== '') {
    filter.department = department;
  }

  // Sender (Requester) Filter
  if (sender) {
    filter.requester = sender;
  }

  // Receiver Filter
  if (receiver) {
    if (receiver === 'other') {
      filter.receiver = null;
    } else {
      filter.receiver = receiver;
    }
  }

  // Handler Filter
  if (handler) {
    filter.handler = handler;
  }

  // Flow Filter (Sent / Received)
  if (flow === 'sent') {
    filter.requester = req.user._id;
  } else if (flow === 'received') {
    filter.receiver = req.user._id;
  }

  // Scope (Internal / External)
  if (scope === 'internal') {
    filter.receiver = { $ne: null };
  } else if (scope === 'external') {
    filter.receiver = null;
  }

  // Barcode Search
  if (barcode && barcode.trim()) {
    filter['materials.barcodes.barcode'] = { $regex: barcode.trim(), $options: 'i' };
  }

  // Role-based visibility checks
  if (req.user.role === 'employee') {
    const userBarcodes = await Barcode.find({ owner: req.user._id });
    const txnIds = userBarcodes.map(b => b.transactionId);

    // Employees can only see transactions they are part of (requester, receiver, handler) or own barcodes for
    const userConditions = [
      { requester: req.user._id },
      { receiver: req.user._id },
      { handler: req.user._id },
      { transactionId: { $in: txnIds } }
    ];

    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        { $or: userConditions }
      ];
      delete filter.$or;
    } else {
      filter.$or = userConditions;
    }
  } else if (req.user.role === 'team_lead') {
    // Team lead only sees department's transactions
    filter.department = req.user.department._id || req.user.department;
  } else if (req.user.role === 'department_admin') {
    if (req.user.departmentAdminType === 'store' || req.user.departmentAdminType === 'management' || req.user.departmentAdminType === 'accounts') {
      // Global department admins can view all transactions
    } else {
      // Other department admins see their own department
      filter.department = req.user.department._id || req.user.department;
    }
  }

  return filter;
};

exports.getTransactionReport = async (req, res) => {
  try {
    const filter = await buildReportFilter(req);

    const transactions = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId')
      .populate('receiver', 'fullName employeeId department')
      .populate('handler', 'fullName employeeId')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    // Calculate report dynamic summary stats
    const totalTransactions = transactions.length;
    const totalValue = transactions.reduce((sum, t) => sum + (t.grandTotal || 0), 0);
    const avgValue = totalTransactions > 0 ? totalValue / totalTransactions : 0;

    res.json({
      data: transactions,
      report: transactions,
      summary: {
        totalTransactions,
        totalValue,
        avgValue
      },
      total: totalTransactions
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.exportTransactionReport = async (req, res) => {
  try {
    const filter = await buildReportFilter(req);

    const transactions = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId')
      .populate('receiver', 'fullName employeeId department')
      .populate('handler', 'fullName employeeId')
      .populate('department', 'name');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Transaction ID', key: 'transactionId', width: 20 },
      { header: 'Requester', key: 'requester', width: 25 },
      { header: 'Receiver', key: 'receiver', width: 25 },
      { header: 'Handler', key: 'handler', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Doc Type', key: 'documentType', width: 15 },
      { header: 'Doc Number', key: 'documentNumber', width: 15 },
      { header: 'Expected Return Date', key: 'expectedReturnDate', width: 20 },
      { header: 'Grand Total (₹)', key: 'grandTotal', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total Items', key: 'totalItems', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    for (const txn of transactions) {
      sheet.addRow({
        transactionId: txn.transactionId,
        requester: txn.requester?.fullName || 'N/A',
        receiver: txn.receiver?.fullName || txn.otherReceiverName || 'External',
        handler: txn.handler?.fullName || 'N/A',
        department: txn.department?.name || 'N/A',
        documentType: txn.documentType || 'RDC',
        documentNumber: txn.documentNumber || 'N/A',
        expectedReturnDate: txn.expectedReturnDate ? txn.expectedReturnDate.toLocaleDateString() : 'N/A',
        grandTotal: txn.grandTotal || 0,
        status: txn.status,
        totalItems: txn.totalItems,
        createdAt: txn.createdAt?.toISOString(),
      });
    }

    // Style header
    sheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
