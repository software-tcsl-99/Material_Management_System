const Transaction = require('../models/Transaction');
const Barcode = require('../models/Barcode');
const ExcelJS = require('exceljs');

exports.getTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate, department, status } = req.query;
    const filter = {};

    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (department) filter.department = department;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    res.json({
      data: transactions, // Added for frontend compatibility
      report: transactions,
      total: transactions.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.exportTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate, department, status } = req.query;
    const filter = {};

    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (department) filter.department = department;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId')
      .populate('department', 'name');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Transaction ID', key: 'transactionId', width: 20 },
      { header: 'Requester', key: 'requester', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Total Items', key: 'totalItems', width: 12 },
      { header: 'Active', key: 'activeItems', width: 10 },
      { header: 'Returned', key: 'returnedItems', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    for (const txn of transactions) {
      sheet.addRow({
        transactionId: txn.transactionId,
        requester: txn.requester?.fullName || 'N/A',
        department: txn.department?.name || 'N/A',
        status: txn.status,
        priority: txn.priority,
        totalItems: txn.totalItems,
        activeItems: txn.activeItems,
        returnedItems: txn.returnedItems,
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
