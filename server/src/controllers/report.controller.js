const Transaction = require('../models/Transaction');
const ExternalReceipt = require('../models/ExternalReceipt');
const ExcelJS = require('exceljs');

// GET /api/reports
const getReportData = async (req, res) => {
  try {
    const {
      page = 1, limit = 50, startDate, endDate, status, documentType,
      department, employee, sender, receiver, material, location, reportType,
      flow, scope,
    } = req.query;

    const User = require('../models/User');
    const superAdmins = await User.find({ role: 'super_admin' }).select('_id');
    const superAdminIds = superAdmins.map(u => u._id);

    const query = {
      $and: [
        { sender: { $nin: superAdminIds } },
        { receiver: { $nin: superAdminIds } }
      ]
    };

    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);

    if (isAdmin && flow === 'received') {
      const txnQuery = {
        $and: [
          { sender: { $nin: superAdminIds } },
          { receiver: { $nin: superAdminIds } }
        ]
      };
      
      txnQuery.receiver = { $ne: null };
      
      if (status) {
        txnQuery.status = status;
      } else {
        txnQuery.status = 'completed';
      }
      
      if (documentType) txnQuery.documentType = documentType;
      if (sender) txnQuery.sender = sender;
      if (receiver) {
        if (receiver === 'other') {
          txnQuery.receiver = null;
        } else {
          txnQuery.receiver = receiver;
        }
      }
      if (material) txnQuery['materials.name'] = { $regex: material, $options: 'i' };
      if (startDate || endDate) {
        txnQuery.createdAt = {};
        if (startDate) txnQuery.createdAt.$gte = new Date(startDate);
        if (endDate) txnQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      const extQuery = {};
      if (status && status !== 'completed') {
        extQuery._id = null;
      }
      if (documentType) {
        extQuery._id = null;
      }
      if (sender) {
        extQuery.orderedBy = sender;
      }
      if (receiver) {
        if (receiver === 'other') {
          extQuery._id = null;
        } else {
          extQuery.receiver = receiver;
        }
      }
      if (material) extQuery['materials.name'] = { $regex: material, $options: 'i' };
      if (startDate || endDate) {
        extQuery.createdAt = {};
        if (startDate) extQuery.createdAt.$gte = new Date(startDate);
        if (endDate) extQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      let merged = [];

      if (scope !== 'external') {
        const txs = await Transaction.find(txnQuery)
          .populate({
            path: 'sender',
            select: 'fullName employeeId',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'designation', select: 'name' },
              { path: 'workLocation', select: 'name' },
            ],
          })
          .populate({
            path: 'receiver',
            select: 'fullName employeeId',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'designation', select: 'name' },
              { path: 'workLocation', select: 'name' },
            ],
          });
        
        merged.push(...txs.map(t => {
          const obj = t.toObject ? t.toObject() : t;
          return { ...obj, isExternal: false };
        }));
      }

      if (scope !== 'internal') {
        const exts = await ExternalReceipt.find(extQuery)
          .populate('orderedBy', 'fullName employeeId')
          .populate({
            path: 'receiver',
            select: 'fullName employeeId',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'designation', select: 'name' },
              { path: 'workLocation', select: 'name' },
            ]
          });
        
        merged.push(...exts.map(e => {
          const obj = e.toObject ? e.toObject() : e;
          return {
            _id: obj._id,
            transactionId: obj.receiptId,
            documentType: `External (${obj.type})`,
            documentNumber: obj.documentNumber || 'N/A',
            createdAt: obj.createdAt,
            sender: obj.orderedBy ? {
              fullName: obj.orderedBy.fullName,
              employeeId: obj.orderedBy.employeeId,
              department: { name: 'External Order' }
            } : {
              fullName: obj.type === 'vendor' ? obj.vendorName : obj.customerName,
              employeeId: 'External',
              department: { name: 'External' }
            },
            receiver: obj.receiver,
            materials: obj.materials,
            grandTotal: obj.grandTotal || 0,
            status: 'completed',
            isExternal: true
          };
        }));
      }

      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = merged.length;
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const paginated = merged.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      const totalValue = merged.reduce((sum, item) => sum + (item.grandTotal || 0), 0);
      const avgValue = total > 0 ? totalValue / total : 0;
      const summary = {
        totalTransactions: total,
        totalValue,
        avgValue
      };

      res.json({
        data: paginated,
        summary,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
      });
    } else if (!isAdmin && flow === 'received') {
      // Non-admin user requesting received transactions: merge internal txns + external receipts
      const txnQuery = {
        $and: [
          { sender: { $nin: superAdminIds } },
          { receiver: { $nin: superAdminIds } }
        ]
      };
      txnQuery.receiver = req.user._id;

      if (status) {
        txnQuery.status = status;
      }
      if (documentType) txnQuery.documentType = documentType;
      if (sender) txnQuery.sender = sender;
      if (startDate || endDate) {
        txnQuery.createdAt = {};
        if (startDate) txnQuery.createdAt.$gte = new Date(startDate);
        if (endDate) txnQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      const extQuery = { receiver: req.user._id };
      if (status && status !== 'completed') {
        extQuery._id = null; // no external matches non-completed status
      }
      if (documentType) {
        extQuery._id = null;
      }
      if (sender) {
        extQuery.orderedBy = sender;
      }
      if (startDate || endDate) {
        extQuery.createdAt = {};
        if (startDate) extQuery.createdAt.$gte = new Date(startDate);
        if (endDate) extQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      let merged = [];

      if (scope !== 'external') {
        const txs = await Transaction.find(txnQuery)
          .populate({
            path: 'sender',
            select: 'fullName employeeId',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'designation', select: 'name' },
              { path: 'workLocation', select: 'name' },
            ],
          })
          .populate({
            path: 'receiver',
            select: 'fullName employeeId',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'designation', select: 'name' },
              { path: 'workLocation', select: 'name' },
            ],
          });
        
        merged.push(...txs.map(t => {
          const obj = t.toObject ? t.toObject() : t;
          return { ...obj, isExternal: false };
        }));
      }

      if (scope !== 'internal') {
        const exts = await ExternalReceipt.find(extQuery)
          .populate('orderedBy', 'fullName employeeId')
          .populate({
            path: 'receiver',
            select: 'fullName employeeId',
            populate: [
              { path: 'department', select: 'name' },
              { path: 'designation', select: 'name' },
              { path: 'workLocation', select: 'name' },
            ]
          });
        
        merged.push(...exts.map(e => {
          const obj = e.toObject ? e.toObject() : e;
          return {
            _id: obj._id,
            transactionId: obj.receiptId,
            documentType: `External (${obj.type})`,
            documentNumber: obj.documentNumber || 'N/A',
            createdAt: obj.createdAt,
            sender: obj.orderedBy ? {
              fullName: obj.orderedBy.fullName,
              employeeId: obj.orderedBy.employeeId,
              department: { name: 'External Order' }
            } : {
              fullName: obj.type === 'vendor' ? obj.vendorName : obj.customerName,
              employeeId: 'External',
              department: { name: 'External' }
            },
            receiver: obj.receiver,
            materials: obj.materials,
            grandTotal: obj.grandTotal || 0,
            status: 'completed',
            isExternal: true
          };
        }));
      }

      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = merged.length;
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const paginated = merged.slice((pageNum - 1) * limitNum, pageNum * limitNum);

      const totalValue = merged.reduce((sum, item) => sum + (item.grandTotal || 0), 0);
      const avgValue = total > 0 ? totalValue / total : 0;
      const summary = {
        totalTransactions: total,
        totalValue,
        avgValue
      };

      res.json({
        data: paginated,
        summary,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
      });
    } else {
      // Flow filter (Sent / Received relative to logged-in user)
      if (flow === 'sent') {
        query.sender = req.user._id;
      } else {
        if (!['super_admin', 'admin'].includes(req.user.role)) {
          query.$and.push({
            $or: [{ sender: req.user._id }, { receiver: req.user._id }]
          });
        }
      }

      // Scope filter (Internal vs External)
      if (scope === 'internal') {
        query.receiver = { $ne: null };
      } else if (scope === 'external') {
        query.receiver = null;
      }

      if (status) query.status = status;
      if (documentType) query.documentType = documentType;
      if (sender) query.sender = sender;
      if (receiver) {
        if (receiver === 'other') {
          query.receiver = null;
        } else {
          query.receiver = receiver;
        }
      }
      if (material) query['materials.name'] = { $regex: material, $options: 'i' };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      const transactions = await Transaction.find(query)
        .populate({
          path: 'sender',
          select: 'fullName employeeId',
          populate: [
            { path: 'department', select: 'name' },
            { path: 'designation', select: 'name' },
            { path: 'workLocation', select: 'name' },
          ],
        })
        .populate({
          path: 'receiver',
          select: 'fullName employeeId',
          populate: [
            { path: 'department', select: 'name' },
            { path: 'designation', select: 'name' },
            { path: 'workLocation', select: 'name' },
          ],
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Transaction.countDocuments(query);

      // Summary aggregation
      const summaryAgg = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalValue: { $sum: '$grandTotal' },
            avgValue: { $avg: '$grandTotal' },
          },
        },
      ]);

      res.json({
        data: transactions,
        summary: summaryAgg[0] || { totalTransactions: 0, totalValue: 0, avgValue: 0 },
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/reports/export
const exportReport = async (req, res) => {
  try {
    const { startDate, endDate, status, documentType, sender, receiver, flow, scope } = req.query;
    
    const User = require('../models/User');
    const superAdmins = await User.find({ role: 'super_admin' }).select('_id');
    const superAdminIds = superAdmins.map(u => u._id);

    const query = {
      $and: [
        { sender: { $nin: superAdminIds } },
        { receiver: { $nin: superAdminIds } }
      ]
    };

    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    let transactions = [];

    if (isAdmin && flow === 'received') {
      const txnQuery = {
        $and: [
          { sender: { $nin: superAdminIds } },
          { receiver: { $nin: superAdminIds } }
        ]
      };
      
      txnQuery.receiver = { $ne: null };
      
      if (status) {
        txnQuery.status = status;
      } else {
        txnQuery.status = 'completed';
      }
      
      if (documentType) txnQuery.documentType = documentType;
      if (sender) txnQuery.sender = sender;
      if (receiver) {
        if (receiver === 'other') {
          txnQuery.receiver = null;
        } else {
          txnQuery.receiver = receiver;
        }
      }
      if (startDate || endDate) {
        txnQuery.createdAt = {};
        if (startDate) txnQuery.createdAt.$gte = new Date(startDate);
        if (endDate) txnQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      const extQuery = {};
      if (status && status !== 'completed') {
        extQuery._id = null;
      }
      if (documentType) {
        extQuery._id = null;
      }
      if (sender) {
        extQuery.orderedBy = sender;
      }
      if (receiver) {
        if (receiver === 'other') {
          extQuery._id = null;
        } else {
          extQuery.receiver = receiver;
        }
      }
      if (startDate || endDate) {
        extQuery.createdAt = {};
        if (startDate) extQuery.createdAt.$gte = new Date(startDate);
        if (endDate) extQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      let merged = [];

      if (scope !== 'external') {
        const txs = await Transaction.find(txnQuery)
          .populate({
            path: 'sender',
            select: 'fullName employeeId',
            populate: [{ path: 'department', select: 'name' }, { path: 'workLocation', select: 'name' }],
          })
          .populate({
            path: 'receiver',
            select: 'fullName employeeId',
            populate: [{ path: 'department', select: 'name' }, { path: 'workLocation', select: 'name' }],
          });
        
        merged.push(...txs.map(t => {
          const obj = t.toObject ? t.toObject() : t;
          return { ...obj, isExternal: false };
        }));
      }

      if (scope !== 'internal') {
        const exts = await ExternalReceipt.find(extQuery)
          .populate('orderedBy', 'fullName employeeId')
          .populate({
            path: 'receiver',
            select: 'fullName employeeId',
            populate: [{ path: 'department', select: 'name' }, { path: 'workLocation', select: 'name' }]
          });
        
        merged.push(...exts.map(e => {
          const obj = e.toObject ? e.toObject() : e;
          return {
            _id: obj._id,
            transactionId: obj.receiptId,
            documentType: `External (${obj.type})`,
            documentNumber: obj.documentNumber || 'N/A',
            createdAt: obj.createdAt,
            sender: obj.orderedBy ? {
              fullName: obj.orderedBy.fullName,
              employeeId: obj.orderedBy.employeeId,
              department: { name: 'External Order' }
            } : {
              fullName: obj.type === 'vendor' ? obj.vendorName : obj.customerName,
              employeeId: 'External',
              department: { name: 'External' }
            },
            receiver: obj.receiver,
            materials: obj.materials,
            grandTotal: obj.grandTotal || 0,
            status: 'completed',
            isExternal: true,
            senderGeo: obj.receiverGeo
          };
        }));
      }

      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      transactions = merged;
    } else {
      // Flow filter (Sent / Received relative to logged-in user)
      if (flow === 'sent') {
        query.sender = req.user._id;
      } else if (flow === 'received') {
        query.receiver = req.user._id;
      } else {
        if (!['super_admin', 'admin'].includes(req.user.role)) {
          query.$and.push({
            $or: [{ sender: req.user._id }, { receiver: req.user._id }]
          });
        }
      }

      // Scope filter (Internal vs External)
      if (scope === 'internal') {
        query.receiver = { $ne: null };
      } else if (scope === 'external') {
        query.receiver = null;
      }

      if (status) query.status = status;
      if (documentType) query.documentType = documentType;
      if (sender) query.sender = sender;
      if (receiver) {
        if (receiver === 'other') {
          query.receiver = null;
        } else {
          query.receiver = receiver;
        }
      }
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      transactions = await Transaction.find(query)
        .populate({
          path: 'sender',
          select: 'fullName employeeId',
          populate: [{ path: 'department', select: 'name' }, { path: 'workLocation', select: 'name' }],
        })
        .populate({
          path: 'receiver',
          select: 'fullName employeeId',
          populate: [{ path: 'department', select: 'name' }, { path: 'workLocation', select: 'name' }],
        })
        .sort({ createdAt: -1 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Material Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Transactions Report', {
      headerFooter: { firstHeader: 'Material Management System - Transaction Report' },
    });

    // Style header - add image URL columns
    worksheet.columns = [
      { header: 'Transaction ID', key: 'txnId', width: 22 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Time', key: 'time', width: 10 },
      { header: 'Sender Name', key: 'senderName', width: 20 },
      { header: 'Sender ID', key: 'senderId', width: 12 },
      { header: 'Sender Dept', key: 'senderDept', width: 18 },
      { header: 'Receiver Name', key: 'receiverName', width: 20 },
      { header: 'Receiver ID', key: 'receiverId', width: 12 },
      { header: 'Receiver Dept', key: 'receiverDept', width: 18 },
      { header: 'Doc Type', key: 'docType', width: 15 },
      { header: 'Doc Number', key: 'docNumber', width: 15 },
      { header: 'Materials', key: 'materials', width: 30 },
      { header: 'Grand Total', key: 'grandTotal', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Location', key: 'location', width: 18 },
      { header: 'Geo Lat', key: 'lat', width: 12 },
      { header: 'Geo Lng', key: 'lng', width: 12 },
      { header: 'Document Photos', key: 'docPhotos', width: 50 },
      { header: 'Material Photos', key: 'matPhotos', width: 50 },
    ];

    // Header row styling
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Add data rows
    transactions.forEach((txn) => {
      const materialsStr = txn.materials
        .map((m) => `${m.name} (${m.quantity} ${m.unit})`)
        .join(', ');
      
      // Collect document photo URLs
      const docPhotoUrls = (txn.documentPhotos || txn.photos || [])
        .map(ph => ph.url)
        .join('; ');
      
      // Collect material photo URLs
      const matPhotoUrls = txn.materials
        .flatMap(m => (m.photos || []).map(ph => `${m.name}: ${ph.url}`))
        .join('; ');

      worksheet.addRow({
        txnId: txn.transactionId,
        date: new Date(txn.createdAt).toLocaleDateString('en-IN'),
        time: new Date(txn.createdAt).toLocaleTimeString('en-IN'),
        senderName: txn.sender?.fullName || '',
        senderId: txn.sender?.employeeId || '',
        senderDept: txn.sender?.department?.name || '',
        receiverName: txn.receiver?.fullName || txn.otherReceiverName || '',
        receiverId: txn.receiver?.employeeId || (txn.otherReceiverName ? 'Other (Non-Employee)' : ''),
        receiverDept: txn.receiver?.department?.name || '',
        docType: txn.documentType,
        docNumber: txn.documentNumber,
        materials: materialsStr,
        grandTotal: txn.grandTotal,
        status: txn.status.toUpperCase(),
        location: txn.sender?.workLocation?.name || '',
        lat: txn.senderGeo?.lat || '',
        lng: txn.senderGeo?.lng || '',
        docPhotos: docPhotoUrls,
        matPhotos: matPhotoUrls,
      });
    });

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          };
          cell.alignment = { vertical: 'middle' };
        });
        if (rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          });
        }
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 19 },
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=MMS_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Export failed.', error: error.message });
  }
};

module.exports = { getReportData, exportReport };
