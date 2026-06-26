const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { createAuditLog } = require('../middleware/audit.middleware');
const { emitToUser } = require('../config/socket');
const { uploadToCloudinary } = require('../config/cloudinary');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// GET /api/transactions
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, documentType, search, startDate, endDate, sender, receiver } = req.query;
    const query = {};

    // Non-admin users only see their own transactions
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      query.$or = [{ sender: req.user._id }, { receiver: req.user._id }];
    }

    if (status) query.status = status;
    if (documentType) query.documentType = documentType;
    if (sender) query.sender = sender;
    if (receiver) query.receiver = receiver;
    if (search) {
      const searchQuery = { $regex: search, $options: 'i' };
      query.$or = [
        { transactionId: searchQuery },
        { 'materials.name': searchQuery },
        { documentNumber: searchQuery },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const transactions = await Transaction.find(query)
      .populate('sender', 'fullName employeeId department designation')
      .populate('receiver', 'fullName employeeId department designation')
      .populate({
        path: 'sender',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'name' },
        ],
      })
      .populate({
        path: 'receiver',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/transactions/:id
const getTransaction = async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const query = isObjectId ? { _id: req.params.id } : { transactionId: req.params.id };

    const transaction = await Transaction.findOne(query)
      .populate({
        path: 'sender',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'name' },
          { path: 'workLocation', select: 'name address' },
        ],
      })
      .populate({
        path: 'receiver',
        populate: [
          { path: 'department', select: 'name' },
          { path: 'designation', select: 'name' },
          { path: 'workLocation', select: 'name address' },
        ],
      });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    res.json({ data: transaction });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/transactions
const createTransaction = async (req, res) => {
  try {
    const {
      receiver,
      otherReceiverName,
      documentType,
      documentNumber,
      expectedReturnDate,
      description,
      remarks,
      materials = [],
      photos,
      approvalScreenshot,
      senderGeo,
      senderDevice,
    } = req.body;

    // Normalize materials into schema shape
    const processedMaterials = (materials || []).map((m) => ({
      name: m.name || '',
      description: m.description || '',
      quantity: Number(m.quantity || m.qty || 0),
      qty: Number(m.quantity || m.qty || 0),
      unit: m.unit || 'Nos',
      price: Number(m.price || 0),
      barcode: m.barcode || '',
      total: Number(m.price || 0) * Number(m.quantity || m.qty || 0),
      photos: m.photos || [] // Include material photos
    }));

    for (let i = 0; i < processedMaterials.length; i++) {
      if (!processedMaterials[i].barcode || !processedMaterials[i].barcode.trim()) {
        return res.status(400).json({ message: `Material ${i + 1} barcode is required.` });
      }
    }

    const grandTotal = processedMaterials.reduce((sum, m) => sum + (m.total || 0), 0);
    const isOther = receiver === 'other';

    const transaction = new Transaction({
      sender: req.user._id,
      receiver: isOther ? null : receiver,
      otherReceiverName: isOther ? (otherReceiverName || 'Other') : '',
      documentType,
      documentNumber,
      expectedReturnDate,
      description,
      remarks,
      materials: processedMaterials,
      senderGeo,
      senderDevice,
      photos: photos || [],
      documentPhotos: req.body.documentPhotos || [], // Include document photos
      approvalScreenshot: approvalScreenshot || '',
      grandTotal,
      status: isOther ? 'completed' : 'pending',
    });

    // Ensure transactionId is unique; retry on duplicate key collisions
    const generateTxnId = () => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      // Random 6-digit suffix to reduce collision probability
      const rand = Math.floor(Math.random() * 900000) + 100000;
      return `TXN-${dateStr}-${String(rand).padStart(6, '0')}`;
    };

    // If model pre-save would generate an ID, we override with our deterministic one to avoid duplicates
    transaction.transactionId = generateTxnId();

    let saved = null;
    let attempts = 0;
    while (!saved && attempts < 5) {
      attempts += 1;
      try {
        saved = await transaction.save();
      } catch (err) {
        // Duplicate transactionId -> regenerate and retry
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.transactionId) {
          transaction.transactionId = generateTxnId();
          continue;
        }
        throw err;
      }
    }
    if (!saved) throw new Error('Failed to create transaction after multiple attempts');

    if (!isOther && receiver) {
      // Create notification for receiver
      const notification = await Notification.create({
        recipient: receiver,
        type: 'assigned',
        title: 'New Material Request',
        message: `${req.user.fullName} has sent you a material request (${transaction.transactionId})`,
        relatedTransaction: transaction._id,
      });

      // Real-time notification
      emitToUser(receiver, 'notification:new', notification);
    }

    // Activity log
    await ActivityLog.create({
      user: req.user._id,
      action: 'Created transaction',
      details: `Transaction ${transaction.transactionId} created and sent to receiver`,
      entityType: 'Transaction',
      entityId: transaction.transactionId,
    });

    await createAuditLog({
      user: req.user._id,
      action: 'create',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      newData: transaction.toObject(),
      req,
    });

    const populated = await Transaction.findById(saved._id)
      .populate('sender', 'fullName employeeId')
      .populate('receiver', 'fullName employeeId');

    res.status(201).json({ data: populated, message: 'Transaction created successfully.' });
  } catch (error) {
    console.error('Create transaction error:', error);
    // Return mongoose validation errors with 400 to help client diagnose issues
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed.', errors: messages });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PUT /api/transactions/:id
const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own transactions.' });
    }

    if (!['pending', 'draft', 'rejected'].includes(transaction.status)) {
      return res.status(400).json({ message: 'Only pending, draft, or rejected transactions can be edited.' });
    }

    const oldData = transaction.toObject();

    const { materials, ...updateData } = req.body;
    if (materials) {
      const processedMaterials = (materials || []).map((m) => ({
        name: m.name || '',
        description: m.description || '',
        quantity: Number(m.quantity || m.qty || 0),
        qty: Number(m.quantity || m.qty || 0),
        unit: m.unit || 'Nos',
        price: Number(m.price || 0),
        barcode: m.barcode || '',
        total: (Number(m.quantity || m.qty || 0)) * (Number(m.price || 0)),
        photos: m.photos || [] // Include material photos on update
      }));

      for (let i = 0; i < processedMaterials.length; i++) {
        if (!processedMaterials[i].barcode || !processedMaterials[i].barcode.trim()) {
          return res.status(400).json({ message: `Material ${i + 1} barcode is required.` });
        }
      }

      transaction.materials = processedMaterials;
      transaction.grandTotal = processedMaterials.reduce((sum, m) => sum + m.total, 0);
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        transaction[key] = updateData[key];
      }
    });

    // Store version
    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'edit',
    });

    await transaction.save();

    await createAuditLog({
      user: req.user._id,
      action: 'edit',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      oldData,
      newData: transaction.toObject(),
      req,
    });

    res.json({ data: transaction, message: 'Transaction updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// DELETE /api/transactions/:id
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own transactions.' });
    }

    if (!['pending', 'draft', 'rejected'].includes(transaction.status)) {
      return res.status(400).json({ message: 'Only pending, draft, or rejected transactions can be deleted.' });
    }

    await createAuditLog({
      user: req.user._id,
      action: 'delete',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      oldData: transaction.toObject(),
      req,
    });

    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaction deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/transactions/:id/accept
const acceptTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the receiver can accept this transaction.' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending transactions can be accepted.' });
    }

    const oldData = transaction.toObject();
    transaction.status = 'accepted';
    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'accept',
    });

    await transaction.save();

    // Notify sender
    const notification = await Notification.create({
      recipient: transaction.sender,
      type: 'accepted',
      title: 'Transaction Accepted',
      message: `${req.user.fullName} has accepted transaction ${transaction.transactionId}`,
      relatedTransaction: transaction._id,
    });

    emitToUser(transaction.sender.toString(), 'notification:new', notification);

    await ActivityLog.create({
      user: req.user._id,
      action: 'Accepted transaction',
      details: `Transaction ${transaction.transactionId} accepted`,
      entityType: 'Transaction',
      entityId: transaction.transactionId,
    });

    await createAuditLog({
      user: req.user._id,
      action: 'approve',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      oldData,
      newData: transaction.toObject(),
      req,
    });

    res.json({ data: transaction, message: 'Transaction accepted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/transactions/:id/reject
const rejectTransaction = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the receiver can reject this transaction.' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending transactions can be rejected.' });
    }

    const oldData = transaction.toObject();
    transaction.status = 'rejected';
    transaction.rejectionReason = rejectionReason || '';
    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'reject',
    });

    await transaction.save();

    // Notify sender
    const notification = await Notification.create({
      recipient: transaction.sender,
      type: 'rejected',
      title: 'Transaction Rejected',
      message: `${req.user.fullName} has rejected transaction ${transaction.transactionId}. Reason: ${rejectionReason}`,
      relatedTransaction: transaction._id,
    });

    emitToUser(transaction.sender.toString(), 'notification:new', notification);

    await ActivityLog.create({
      user: req.user._id,
      action: 'Rejected transaction',
      details: `Transaction ${transaction.transactionId} rejected. Reason: ${rejectionReason}`,
      entityType: 'Transaction',
      entityId: transaction.transactionId,
    });

    await createAuditLog({
      user: req.user._id,
      action: 'reject',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      oldData,
      newData: transaction.toObject(),
      req,
    });

    res.json({ data: transaction, message: 'Transaction rejected.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/transactions/:id/resubmit
const resubmitTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only resubmit your own transactions.' });
    }

    if (transaction.status !== 'rejected') {
      return res.status(400).json({ message: 'Only rejected transactions can be resubmitted.' });
    }

    const oldData = transaction.toObject();

    // Apply updates from body
    const { materials, ...updateData } = req.body;
    if (materials) {
      const processedMaterials = (materials || []).map((m) => ({
        name: m.name || '',
        description: m.description || '',
        quantity: Number(m.quantity || m.qty || 0),
        qty: Number(m.quantity || m.qty || 0),
        unit: m.unit || 'Nos',
        price: Number(m.price || 0),
        barcode: m.barcode || '',
        total: (Number(m.quantity || m.qty || 0)) * (Number(m.price || 0)),
        photos: m.photos || [] // Include material photos on resubmit
      }));

      for (let i = 0; i < processedMaterials.length; i++) {
        if (!processedMaterials[i].barcode || !processedMaterials[i].barcode.trim()) {
          return res.status(400).json({ message: `Material ${i + 1} barcode is required.` });
        }
      }

      transaction.materials = processedMaterials;
      transaction.grandTotal = processedMaterials.reduce((sum, m) => sum + m.total, 0);
    }
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        transaction[key] = updateData[key];
      }
    });

    transaction.status = 'pending';
    transaction.rejectionReason = '';
    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'resubmit',
    });

    await transaction.save();

    // Notify receiver
    const notification = await Notification.create({
      recipient: transaction.receiver,
      type: 'resubmitted',
      title: 'Transaction Resubmitted',
      message: `${req.user.fullName} has resubmitted transaction ${transaction.transactionId}`,
      relatedTransaction: transaction._id,
    });

    emitToUser(transaction.receiver.toString(), 'notification:new', notification);

    await createAuditLog({
      user: req.user._id,
      action: 'resubmit',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      oldData,
      newData: transaction.toObject(),
      req,
    });

    res.json({ data: transaction, message: 'Transaction resubmitted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/transactions/:id/export
const exportSingleTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
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

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Check permission
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      if (
        transaction.sender._id.toString() !== req.user._id.toString() &&
        transaction.receiver._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: 'You do not have permission to export this transaction.' });
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Material Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`Transaction_${transaction.transactionId}`, {
      headerFooter: { firstHeader: `Material Movement - ${transaction.transactionId}` },
    });

    // Style header
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Value', key: 'value', width: 50 },
    ];

    // Header row styling
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Add transaction details
    worksheet.addRow({ field: 'Transaction ID', value: transaction.transactionId });
    worksheet.addRow({ field: 'Date', value: new Date(transaction.createdAt).toLocaleDateString('en-IN') });
    worksheet.addRow({ field: 'Time', value: new Date(transaction.createdAt).toLocaleTimeString('en-IN') });
    worksheet.addRow({ field: 'Document Type', value: transaction.documentType });
    worksheet.addRow({ field: 'Document Number', value: transaction.documentNumber || '-' });
    worksheet.addRow({ field: 'Expected Return Date', value: transaction.expectedReturnDate ? new Date(transaction.expectedReturnDate).toLocaleDateString('en-IN') : '-' });
    worksheet.addRow({ field: 'Status', value: transaction.status.toUpperCase() });
    worksheet.addRow({ field: 'Rejection Reason', value: transaction.rejectionReason || '-' });
    worksheet.addRow({ field: 'Description', value: transaction.description || '-' });

    // Sender details
    worksheet.addRow({ field: '--- Sender Details ---', value: '' });
    worksheet.addRow({ field: 'Name', value: transaction.sender?.fullName || '-' });
    worksheet.addRow({ field: 'Employee ID', value: transaction.sender?.employeeId || '-' });
    worksheet.addRow({ field: 'Department', value: transaction.sender?.department?.name || '-' });
    worksheet.addRow({ field: 'Location', value: transaction.sender?.workLocation?.name || '-' });

    // Receiver details
    worksheet.addRow({ field: '--- Receiver Details ---', value: '' });
    worksheet.addRow({ field: 'Name', value: transaction.receiver?.fullName || '-' });
    worksheet.addRow({ field: 'Employee ID', value: transaction.receiver?.employeeId || '-' });
    worksheet.addRow({ field: 'Department', value: transaction.receiver?.department?.name || '-' });
    worksheet.addRow({ field: 'Location', value: transaction.receiver?.workLocation?.name || '-' });

    // Materials
    worksheet.addRow({ field: '--- Materials ---', value: '' });
    transaction.materials.forEach((mat, index) => {
      worksheet.addRow({ 
        field: `Material ${index + 1}`, 
        value: `${mat.name} - ${mat.quantity} ${mat.unit} - ₹${mat.total}` 
      });
      worksheet.addRow({ field: '  Description', value: mat.description || '-' });
      worksheet.addRow({ field: '  Barcode', value: mat.barcode || '-' });
      const materialPhotos = (mat.photos || []).map(p => p.url).join('; ');
      if (materialPhotos) {
        worksheet.addRow({ field: '  Photos', value: materialPhotos });
      }
    });

    // Photos
    worksheet.addRow({ field: '--- Photos ---', value: '' });
    const documentPhotos = (transaction.documentPhotos || transaction.photos || []).map(p => p.url).join('; ');
    if (documentPhotos) {
      worksheet.addRow({ field: 'Document Photos', value: documentPhotos });
    }

    // Grand total
    worksheet.addRow({ field: 'Grand Total', value: `₹${transaction.grandTotal.toLocaleString()}` });

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
          cell.alignment = { vertical: 'middle' };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Transaction_${transaction.transactionId}_${new Date().toISOString().slice(0,10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Single export error:', error);
    res.status(500).json({ message: 'Failed to export transaction.', error: error.message });
  }
};

// GET /api/transactions/:id/export/pdf
const exportSingleTransactionPDF = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
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

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Check permission
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      if (
        transaction.sender._id.toString() !== req.user._id.toString() &&
        transaction.receiver._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: 'You do not have permission to export this transaction.' });
      }
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Transaction_${transaction.transactionId}_${new Date().toISOString().slice(0,10)}.pdf`);
    
    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .text('Material Movement Transaction', { align: 'center' })
      .moveDown();

    // Date and Time
    doc.fontSize(12).text(`Date: ${new Date(transaction.createdAt).toLocaleDateString('en-IN')}`, { align: 'left' });
    doc.text(`Time: ${new Date(transaction.createdAt).toLocaleTimeString('en-IN')}`, { align: 'left' });
    doc.moveDown();

    // Transaction details
    doc.fontSize(14).text('Transaction Details', { underline: true });
    doc.fontSize(12).moveDown();
    doc.text(`Transaction ID: ${transaction.transactionId}`);
    doc.text(`Document Type: ${transaction.documentType}`);
    doc.text(`Document Number: ${transaction.documentNumber || '-'}`);
    doc.text(`Expected Return Date: ${transaction.expectedReturnDate ? new Date(transaction.expectedReturnDate).toLocaleDateString('en-IN') : '-'}`);
    doc.text(`Status: ${transaction.status.toUpperCase()}`);
    doc.text(`Rejection Reason: ${transaction.rejectionReason || '-'}`);
    doc.text(`Description: ${transaction.description || '-'}`);
    doc.moveDown();

    // Sender details
    doc.fontSize(14).text('Sender Details', { underline: true });
    doc.fontSize(12).moveDown();
    doc.text(`Name: ${transaction.sender?.fullName || '-'}`);
    doc.text(`Employee ID: ${transaction.sender?.employeeId || '-'}`);
    doc.text(`Department: ${transaction.sender?.department?.name || '-'}`);
    doc.text(`Location: ${transaction.sender?.workLocation?.name || '-'}`);
    doc.moveDown();

    // Receiver details
    doc.fontSize(14).text('Receiver Details', { underline: true });
    doc.fontSize(12).moveDown();
    doc.text(`Name: ${transaction.receiver?.fullName || '-'}`);
    doc.text(`Employee ID: ${transaction.receiver?.employeeId || '-'}`);
    doc.text(`Department: ${transaction.receiver?.department?.name || '-'}`);
    doc.text(`Location: ${transaction.receiver?.workLocation?.name || '-'}`);
    doc.moveDown();

    // Materials
    doc.fontSize(14).text('Materials', { underline: true });
    doc.fontSize(12).moveDown();
    if (transaction.materials.length > 0) {
      transaction.materials.forEach((mat, index) => {
        doc.text(`Material ${index + 1}:`, { continued: true });
        doc.text(` ${mat.name} - ${mat.quantity} ${mat.unit} - ₹${mat.total}`);
        if (mat.description) doc.text(`Description: ${mat.description}`);
        if (mat.barcode) doc.text(`Barcode: ${mat.barcode}`);
        doc.moveDown();
      });
      doc.moveDown();
      doc.fontSize(14).text(`Grand Total: ₹${transaction.grandTotal.toLocaleString()}`, { align: 'right' });
    } else {
      doc.text('No materials listed.');
    }

    doc.end();
  } catch (error) {
    console.error('Single PDF export error:', error);
    res.status(500).json({ message: 'Failed to export transaction.', error: error.message });
  }
};

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  acceptTransaction,
  rejectTransaction,
  resubmitTransaction,
  exportSingleTransaction,
  exportSingleTransactionPDF,
};
