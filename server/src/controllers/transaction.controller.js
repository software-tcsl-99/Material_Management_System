const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Barcode = require('../models/Barcode');
const BarcodeChat = require('../models/BarcodeChat');
const User = require('../models/User');
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
      priority,
      dueDate,
      costCenter,
      dcType,
    } = req.body;

    const processedMaterials = (materials || []).map((m) => {
      const barcodeStr = Array.isArray(m.barcodes) ? (m.barcodes[0] || '') : (m.barcode || '');
      return {
        name: m.name || '',
        description: m.description || '',
        quantity: Number(m.quantity || m.qty || 0),
        qty: Number(m.quantity || m.qty || 0),
        unit: m.unit || 'Nos',
        price: Number(m.price || 0),
        barcode: barcodeStr,
        total: Number(m.price || 0) * Number(m.quantity || m.qty || 0),
        photos: m.photos || []
      };
    });

    const barcodeStrings = [];
    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      const barcodes = m.barcodes || (m.barcode ? [m.barcode] : []);
      if (barcodes.length === 0 || barcodes.some(b => !b.trim())) {
        return res.status(400).json({ message: `Material ${i + 1} requires barcode scan for each unit.` });
      }
      barcodeStrings.push(...barcodes);
    }

    const existingActive = await Barcode.find({
      barcode: { $in: barcodeStrings },
      status: 'Active'
    });
    if (existingActive.length > 0) {
      return res.status(400).json({
        message: `The following barcodes are already active in the system: ${existingActive.map(b => b.barcode).join(', ')}`
      });
    }

    const grandTotal = processedMaterials.reduce((sum, m) => sum + (m.total || 0), 0);
    const isOther = receiver === 'other';

    let crossDepartment = false;
    if (!isOther && receiver) {
      const receiverUser = await User.findById(receiver);
      if (receiverUser && req.user.department) {
        if (receiverUser.department.toString() !== req.user.department.toString()) {
          crossDepartment = true;
        }
      }
    }

    const isTeamLead = req.user.role === 'team_lead';
    const status = isOther ? 'completed' : 'submitted';

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
      documentPhotos: req.body.documentPhotos || [],
      approvalScreenshot: approvalScreenshot || '',
      grandTotal,
      priority: priority || 'medium',
      dueDate,
      costCenter,
      crossDepartment,
      dcType: dcType || 'DC-Internal',
      status,
    });

    const generateTxnId = () => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(Math.random() * 900000) + 100000;
      return `TXN-${dateStr}-${String(rand).padStart(6, '0')}`;
    };

    transaction.transactionId = generateTxnId();

    let saved = null;
    let attempts = 0;
    while (!saved && attempts < 5) {
      attempts += 1;
      try {
        saved = await transaction.save();
      } catch (err) {
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.transactionId) {
          transaction.transactionId = generateTxnId();
          continue;
        }
        throw err;
      }
    }

    if (!saved) throw new Error('Failed to create transaction after multiple attempts');

    for (const m of materials) {
      const barcodes = m.barcodes || (m.barcode ? [m.barcode] : []);
      for (const bc of barcodes) {
        const barcodeDoc = new Barcode({
          barcode: bc,
          transactionId: transaction.transactionId,
          materialName: m.name,
          status: 'Active',
          owner: req.user._id,
          gps: senderGeo,
          history: [
            {
              action: 'Created',
              user: req.user._id,
              remarks: `Registered in transaction request ${transaction.transactionId}`,
              gps: senderGeo
            }
          ]
        });
        await barcodeDoc.save();
      }
    }

    if (!isOther && receiver) {
      let notifyUsers = [];
      if (isTeamLead || crossDepartment) {
        notifyUsers = await User.find({ role: 'department_admin', departmentAdminType: 'management' });
      } else {
        notifyUsers = await User.find({ role: 'team_lead', department: req.user.department });
      }

      for (const recipientUser of notifyUsers) {
        const notification = await Notification.create({
          recipient: recipientUser._id,
          type: 'assigned',
          title: 'Approval Required',
          message: `${req.user.fullName} submitted transaction ${transaction.transactionId} requiring your approval.`,
          relatedTransaction: transaction._id,
        });
        emitToUser(recipientUser._id.toString(), 'notification:new', notification);
      }
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'Created transaction',
      details: `Transaction ${transaction.transactionId} created and approvals initiated`,
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
    const { remarks } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const oldData = transaction.toObject();

    if (req.user.role === 'team_lead') {
      if (transaction.status !== 'submitted') {
        return res.status(400).json({ message: 'Transaction is not awaiting Team Lead approval.' });
      }

      transaction.approvalChain.push({
        user: req.user._id,
        role: 'team_lead',
        action: 'approved',
        remarks: remarks || 'Team Lead Approved',
        timestamp: new Date()
      });

      const senderUser = await User.findById(transaction.sender);
      const reqsMgt = (senderUser && senderUser.role === 'team_lead') || transaction.crossDepartment;

      if (reqsMgt) {
        transaction.status = 'tl_approved';
        const managers = await User.find({ role: 'department_admin', departmentAdminType: 'management' });
        for (const manager of managers) {
          const notification = await Notification.create({
            recipient: manager._id,
            type: 'assigned',
            title: 'Management Approval Required',
            message: `Transaction ${transaction.transactionId} approved by Team Lead; awaits Management approval.`,
            relatedTransaction: transaction._id,
          });
          emitToUser(manager._id.toString(), 'notification:new', notification);
        }
      } else {
        transaction.status = 'ready_for_dispatch';
        const storeAdmins = await User.find({ role: 'department_admin', departmentAdminType: 'store' });
        for (const store of storeAdmins) {
          const notification = await Notification.create({
            recipient: store._id,
            type: 'assigned',
            title: 'Material Sourcing Pending',
            message: `Transaction ${transaction.transactionId} approved and ready for store action.`,
            relatedTransaction: transaction._id,
          });
          emitToUser(store._id.toString(), 'notification:new', notification);
        }
      }

    } else if (req.user.role === 'super_admin' || (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management')) {
      if (!['submitted', 'tl_approved'].includes(transaction.status)) {
        return res.status(400).json({ message: 'Transaction does not require management approval.' });
      }

      transaction.approvalChain.push({
        user: req.user._id,
        role: 'management',
        action: 'approved',
        remarks: remarks || 'Management Approved',
        timestamp: new Date()
      });

      transaction.status = 'ready_for_dispatch';
      
      const storeAdmins = await User.find({ role: 'department_admin', departmentAdminType: 'store' });
      for (const store of storeAdmins) {
        const notification = await Notification.create({
          recipient: store._id,
          type: 'assigned',
          title: 'Material Sourcing Pending',
          message: `Transaction ${transaction.transactionId} approved by Management and ready for store action.`,
          relatedTransaction: transaction._id,
        });
        emitToUser(store._id.toString(), 'notification:new', notification);
      }
    } else {
      return res.status(403).json({ message: 'You do not have approval permissions.' });
    }

    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'approve',
    });

    await transaction.save();
    res.json({ data: transaction, message: 'Transaction approved successfully.' });
  } catch (error) {
    console.error('Accept transaction error:', error);
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

    const canReject = req.user.role === 'super_admin' || 
      req.user.role === 'team_lead' || 
      (req.user.role === 'department_admin' && ['management', 'store'].includes(req.user.departmentAdminType));

    if (!canReject) {
      return res.status(403).json({ message: 'Access denied. You cannot reject this transaction.' });
    }

    const oldData = transaction.toObject();
    transaction.status = 'rejected';
    transaction.rejectionReason = rejectionReason || 'Rejected by Approver';
    
    transaction.approvalChain.push({
      user: req.user._id,
      role: req.user.role,
      action: 'rejected',
      remarks: rejectionReason || 'Rejected',
      timestamp: new Date()
    });

    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'reject',
    });

    await transaction.save();

    const notification = await Notification.create({
      recipient: transaction.sender,
      type: 'rejected',
      title: 'Transaction Rejected',
      message: `Transaction ${transaction.transactionId} was rejected. Reason: ${rejectionReason}`,
      relatedTransaction: transaction._id,
    });
    emitToUser(transaction.sender.toString(), 'notification:new', notification);

    res.json({ data: transaction, message: 'Transaction rejected successfully.' });
  } catch (error) {
    console.error('Reject transaction error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/transactions/:id/store-action
const storeActionTransaction = async (req, res) => {
  try {
    const { actionType, handlerId, remarks } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const oldData = transaction.toObject();

    if (actionType === 'accept') {
      transaction.status = 'store_accepted';
    } else if (actionType === 'assign_handler') {
      if (!handlerId) {
        return res.status(400).json({ message: 'Handler ID is required.' });
      }
      transaction.status = 'handler_assigned';
      transaction.receiver = handlerId;
      
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { 
          $set: { owner: handlerId },
          $push: { 
            history: { 
              action: 'Handler Assigned', 
              user: req.user._id, 
              remarks: `Assigned to handler` 
            } 
          }
        }
      );

      const notification = await Notification.create({
        recipient: handlerId,
        type: 'assigned',
        title: 'Delivery Job Assigned',
        message: `You are assigned to deliver materials for ${transaction.transactionId}.`,
        relatedTransaction: transaction._id,
      });
      emitToUser(handlerId, 'notification:new', notification);

    } else if (actionType === 'direct_dispatch') {
      transaction.status = 'dispatched';
      
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { 
          $push: { 
            history: { 
              action: 'Store Dispatched', 
              user: req.user._id, 
              remarks: `Materials directly dispatched by Store` 
            } 
          }
        }
      );

      const notification = await Notification.create({
        recipient: transaction.sender,
        type: 'assigned',
        title: 'Materials Dispatched',
        message: `Store has dispatched materials for ${transaction.transactionId}.`,
        relatedTransaction: transaction._id,
      });
      emitToUser(transaction.sender.toString(), 'notification:new', notification);
    }

    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'store_action',
    });

    await transaction.save();
    res.json({ data: transaction, message: 'Store action completed.' });
  } catch (error) {
    console.error('Store action error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/transactions/:id/handler-action
const handlerActionTransaction = async (req, res) => {
  try {
    const { actionType, newHandlerId, remarks } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const oldData = transaction.toObject();

    if (actionType === 'accept') {
      // confirm acceptance
    } else if (actionType === 'transfer') {
      if (!newHandlerId) {
        return res.status(400).json({ message: 'New handler ID is required.' });
      }
      transaction.receiver = newHandlerId;
      
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { 
          $set: { owner: newHandlerId },
          $push: { 
            history: { 
              action: 'Handler Transferred', 
              user: req.user._id, 
              remarks: `Transferred to new handler` 
            } 
          }
        }
      );

      const notification = await Notification.create({
        recipient: newHandlerId,
        type: 'assigned',
        title: 'Delivery Job Transferred',
        message: `You are the new assigned handler for ${transaction.transactionId}.`,
        relatedTransaction: transaction._id,
      });
      emitToUser(newHandlerId, 'notification:new', notification);
    } else if (actionType === 'dispatch') {
      transaction.status = 'dispatched';

      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { 
          $push: { 
            history: { 
              action: 'Dispatched', 
              user: req.user._id, 
              remarks: `Materials in transit` 
            } 
          }
        }
      );

      const notification = await Notification.create({
        recipient: transaction.sender,
        type: 'assigned',
        title: 'Materials Dispatched',
        message: `Handler has dispatched materials for ${transaction.transactionId}.`,
        relatedTransaction: transaction._id,
      });
      emitToUser(transaction.sender.toString(), 'notification:new', notification);
    }

    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'handler_action',
    });

    await transaction.save();
    res.json({ data: transaction, message: 'Handler action completed.' });
  } catch (error) {
    console.error('Handler action error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/transactions/:id/receive
const receiveTransaction = async (req, res) => {
  try {
    const { receiverGeo, materialCondition, remarks, photo } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const oldData = transaction.toObject();
    transaction.status = 'received';
    transaction.receiver = transaction.sender;

    const originalRequester = transaction.sender;

    await Barcode.updateMany(
      { transactionId: transaction.transactionId },
      {
        $set: { 
          owner: originalRequester,
          gps: receiverGeo
        },
        $push: {
          history: {
            action: 'Received',
            user: originalRequester,
            remarks: remarks || `Received. Condition: ${materialCondition || 'Good'}`,
            gps: receiverGeo,
            photo: photo || ''
          }
        }
      }
    );

    if (photo) {
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        {
          $push: {
            photos: {
              url: photo,
              lat: receiverGeo?.lat,
              lng: receiverGeo?.lng,
              address: receiverGeo?.address
            }
          }
        }
      );
    }

    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'receive',
    });

    await transaction.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'Received materials',
      details: `Materials for transaction ${transaction.transactionId} received`,
      entityType: 'Transaction',
      entityId: transaction.transactionId,
    });

    res.json({ data: transaction, message: 'Materials received and barcode ownership established.' });
  } catch (error) {
    console.error('Receive transaction error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/transactions/:id/invoice-match
const invoiceMatchTransaction = async (req, res) => {
  try {
    const { invoiceNumber, invoiceDate, invoiceTotal } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    const oldData = transaction.toObject();
    const isMatched = Math.abs(transaction.grandTotal - Number(invoiceTotal)) < 0.01;

    transaction.invoiceNumber = invoiceNumber;
    transaction.invoiceDate = invoiceDate;
    transaction.invoiceTotal = Number(invoiceTotal);
    transaction.invoiceMatchStatus = isMatched ? 'matched' : 'discrepant';
    transaction.rdcStatus = isMatched ? 'matched' : 'discrepant';

    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'invoice_match',
    });

    await transaction.save();

    res.json({
      data: transaction,
      message: isMatched 
        ? 'RDC 3-Way match successful.' 
        : 'Discrepancy detected between invoice total and expected grand total.'
    });
  } catch (error) {
    console.error('Invoice matching error:', error);
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
    const { materials, ...updateData } = req.body;
    
    if (materials) {
      const processedMaterials = (materials || []).map((m) => {
        const barcodeStr = Array.isArray(m.barcodes) ? (m.barcodes[0] || '') : (m.barcode || '');
        return {
          name: m.name || '',
          description: m.description || '',
          quantity: Number(m.quantity || m.qty || 0),
          qty: Number(m.quantity || m.qty || 0),
          unit: m.unit || 'Nos',
          price: Number(m.price || 0),
          barcode: barcodeStr,
          total: (Number(m.quantity || m.qty || 0)) * (Number(m.price || 0)),
          photos: m.photos || []
        };
      });

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

    transaction.status = 'submitted';
    transaction.rejectionReason = '';
    transaction.versions.push({
      data: oldData,
      modifiedBy: req.user._id,
      action: 'resubmit',
    });

    await transaction.save();
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
  storeActionTransaction,
  handlerActionTransaction,
  receiveTransaction,
  invoiceMatchTransaction,
};
