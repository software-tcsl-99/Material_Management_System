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

    // Find all return requests (even completed/delivered ones) where the user was the return handler
    const ReturnModel = require('../models/Return');
    const returnDocs = await ReturnModel.find({ returnHandler: req.user._id });
    const returnTxnIds = returnDocs.map(r => r.transactionId);

    // Employees can only see transactions they are part of (requester, receiver, handler) or own barcodes for
    const userConditions = [
      { requester: req.user._id },
      { receiver: req.user._id },
      { handler: req.user._id },
      { transactionId: { $in: [...txnIds, ...returnTxnIds] } }
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
    const { reportType = 'transaction' } = req.query;

    if (reportType === 'returns') {
      const Return = require('../models/Return');
      const { status, barcode, startDate, endDate, handler } = req.query;
      const returnFilter = {};

      if (req.user.role === 'employee') {
        returnFilter.returnHandler = req.user._id;
      }

      if (status && status !== 'all' && status !== '') {
        returnFilter.status = status;
      }
      if (barcode && barcode.trim()) {
        returnFilter.barcode = { $regex: barcode.trim().toUpperCase(), $options: 'i' };
      }
      if (handler) {
        returnFilter.returnHandler = handler;
      }
      if (startDate && endDate) {
        returnFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const returns = await Return.find(returnFilter)
        .populate('fromUser', 'fullName employeeId')
        .populate('returnHandler', 'fullName employeeId')
        .sort({ createdAt: -1 });

      return res.json({
        data: returns,
        report: returns,
        summary: {
          totalTransactions: returns.length,
          totalValue: returns.filter(r => r.condition === 'good').length,
          avgValue: returns.filter(r => r.condition !== 'good').length
        },
        total: returns.length
      });
    }

    if (reportType === 'handler') {
      const { handler } = req.query;
      const filter = await buildReportFilter(req);

      delete filter.$or;
      delete filter.$and;

      if (req.user.role === 'employee') {
        filter.handler = req.user._id;
      } else if (handler) {
        filter.handler = handler;
      } else {
        filter.handler = { $ne: null };
      }

      const transactions = await Transaction.find(filter)
        .populate('requester', 'fullName employeeId')
        .populate('receiver', 'fullName employeeId department')
        .populate('handler', 'fullName employeeId')
        .populate('department', 'name')
        .sort({ createdAt: -1 });

      return res.json({
        data: transactions,
        report: transactions,
        summary: {
          totalTransactions: transactions.length,
          totalValue: transactions.filter(t => ['received', 'completed', 'closed'].includes(t.status)).length,
          avgValue: transactions.filter(t => !['received', 'completed', 'closed', 'rejected'].includes(t.status)).length
        },
        total: transactions.length
      });
    }

    // Default: Transaction Report
    const filter = await buildReportFilter(req);
    const transactions = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId')
      .populate('receiver', 'fullName employeeId department')
      .populate('handler', 'fullName employeeId')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

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
    const { reportType = 'transaction' } = req.query;
    const workbook = new ExcelJS.Workbook();

    if (reportType === 'returns') {
      const Return = require('../models/Return');
      const { status, barcode, startDate, endDate, handler } = req.query;
      const returnFilter = {};

      if (req.user.role === 'employee') {
        returnFilter.returnHandler = req.user._id;
      }

      if (status && status !== 'all' && status !== '') {
        returnFilter.status = status;
      }
      if (barcode && barcode.trim()) {
        returnFilter.barcode = { $regex: barcode.trim().toUpperCase(), $options: 'i' };
      }
      if (handler) {
        returnFilter.returnHandler = handler;
      }
      if (startDate && endDate) {
        returnFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      const returns = await Return.find(returnFilter)
        .populate('fromUser', 'fullName employeeId')
        .populate('returnHandler', 'fullName employeeId')
        .sort({ createdAt: -1 });

      const sheet = workbook.addWorksheet('Returns');
      sheet.columns = [
        { header: 'Transaction ID', key: 'transactionId', width: 20 },
        { header: 'Barcode', key: 'barcode', width: 15 },
        { header: 'Returned By', key: 'fromUser', width: 25 },
        { header: 'Return Handler', key: 'returnHandler', width: 25 },
        { header: 'Condition', key: 'condition', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Reason', key: 'reason', width: 30 },
        { header: 'Remarks', key: 'remarks', width: 30 },
        { header: 'Created Date', key: 'createdAt', width: 20 }
      ];

      returns.forEach(r => {
        sheet.addRow({
          transactionId: r.transactionId,
          barcode: r.barcode,
          fromUser: r.fromUser?.fullName || 'N/A',
          returnHandler: r.returnHandler?.fullName || 'N/A',
          condition: r.condition,
          status: r.status,
          reason: r.reason,
          remarks: r.remarks,
          createdAt: r.createdAt.toLocaleDateString()
        });
      });
      sheet.getRow(1).font = { bold: true };
    } else if (reportType === 'handler') {
      const { handler } = req.query;
      const filter = await buildReportFilter(req);

      delete filter.$or;
      delete filter.$and;

      if (req.user.role === 'employee') {
        filter.handler = req.user._id;
      } else if (handler) {
        filter.handler = handler;
      } else {
        filter.handler = { $ne: null };
      }

      const transactions = await Transaction.find(filter)
        .populate('requester', 'fullName employeeId')
        .populate('receiver', 'fullName employeeId department')
        .populate('handler', 'fullName employeeId')
        .populate('department', 'name')
        .sort({ createdAt: -1 });

      const sheet = workbook.addWorksheet('Handler Sourcing');
      sheet.columns = [
        { header: 'Transaction ID', key: 'transactionId', width: 20 },
        { header: 'Handler Name', key: 'handler', width: 25 },
        { header: 'Requester', key: 'requester', width: 25 },
        { header: 'Receiver', key: 'receiver', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Created Date', key: 'createdAt', width: 20 }
      ];

      transactions.forEach(t => {
        sheet.addRow({
          transactionId: t.transactionId,
          handler: t.handler?.fullName || 'N/A',
          requester: t.requester?.fullName || 'N/A',
          receiver: t.receiver?.fullName || t.otherReceiverName || 'N/A',
          status: t.status,
          grandTotal: t.grandTotal || 0,
          createdAt: t.createdAt.toLocaleDateString()
        });
      });
      sheet.getRow(1).font = { bold: true };
    } else {
      // Default: Transaction Report
      const filter = await buildReportFilter(req);
      const transactions = await Transaction.find(filter)
        .populate('requester', 'fullName employeeId')
        .populate('receiver', 'fullName employeeId department')
        .populate('handler', 'fullName employeeId')
        .populate('department', 'name');

      const sheet = workbook.addWorksheet('Transactions');
      sheet.columns = [
        { header: 'Transaction ID', key: 'transactionId', width: 20 },
        { header: 'Requester', key: 'requester', width: 25 },
        { header: 'Receiver', key: 'receiver', width: 25 },
        { header: 'Handler', key: 'handler', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Grand Total', key: 'grandTotal', width: 15 },
        { header: 'Created Date', key: 'createdAt', width: 20 }
      ];

      transactions.forEach(t => {
        sheet.addRow({
          transactionId: t.transactionId,
          requester: t.requester?.fullName || 'N/A',
          receiver: t.receiver?.fullName || t.otherReceiverName || 'N/A',
          handler: t.handler?.fullName || 'N/A',
          status: t.status,
          grandTotal: t.grandTotal || 0,
          createdAt: t.createdAt.toLocaleDateString()
        });
      });
      sheet.getRow(1).font = { bold: true };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=MMS_Report_${reportType}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
