const Barcode = require('../models/Barcode');
const BarcodeChat = require('../models/BarcodeChat');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { createAuditLog } = require('../middleware/audit.middleware');
const { emitToUser } = require('../config/socket');

// GET /api/barcodes
const getBarcodes = async (req, res) => {
  try {
    const { status, search, transactionId, owner } = req.query;
    const query = {};

    if (status) query.status = status;
    if (transactionId) query.transactionId = transactionId;
    if (owner) query.owner = owner;

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { barcode: searchRegex },
        { materialName: searchRegex },
        { transactionId: searchRegex }
      ];
    }

    // Role-based visibility filtering
    if (req.user.role === 'employee') {
      // Employees see what they currently own
      query.owner = req.user._id;
    } else if (req.user.role === 'team_lead') {
      // Team Leads see what they own + their department's barcodes
      const teamUserIds = await User.find({ department: req.user.department }).select('_id');
      query.owner = { $in: teamUserIds.map(u => u._id) };
    } else if (req.user.role === 'department_admin') {
      // Dept admins see all barcodes in their department
      const deptUserIds = await User.find({ department: req.user.department }).select('_id');
      query.owner = { $in: deptUserIds.map(u => u._id) };
    }

    const barcodes = await Barcode.find(query)
      .populate('owner', 'fullName employeeId department designation')
      .populate({
        path: 'owner',
        populate: { path: 'department', select: 'name' }
      })
      .sort({ updatedAt: -1 });

    res.json({ data: barcodes });
  } catch (error) {
    console.error('Get barcodes error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/barcodes/:barcode
const getBarcodeByCode = async (req, res) => {
  try {
    const barcode = await Barcode.findOne({ barcode: req.params.barcode })
      .populate('owner', 'fullName employeeId department designation')
      .populate({
        path: 'owner',
        populate: { path: 'department', select: 'name' }
      })
      .populate('history.user', 'fullName employeeId role');

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    res.json({ data: barcode });
  } catch (error) {
    console.error('Get barcode error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/transfer
const transferBarcode = async (req, res) => {
  try {
    const { targetUserId, remarks, gps, photo } = req.body;
    const barcode = await Barcode.findOne({ barcode: req.params.barcode });

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    if (barcode.status !== 'Active') {
      return res.status(400).json({ message: 'Only active barcodes can be transferred.' });
    }

    if (barcode.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this barcode.' });
    }

    const targetUser = await User.findById(targetUserId).populate('department');
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const currentUser = await User.findById(req.user._id).populate('department');

    // Routing rule: internal department transfer = auto-accepted
    // Cross-department = requires management approval first
    const isCrossDept = currentUser.department._id.toString() !== targetUser.department._id.toString();

    if (!isCrossDept) {
      // Internal transfer: execute immediately
      const oldOwner = barcode.owner;
      barcode.owner = targetUserId;
      barcode.history.push({
        action: 'Transferred',
        user: req.user._id,
        remarks: remarks || `Transferred internally to ${targetUser.fullName}`,
        gps,
        photo
      });

      if (gps) barcode.gps = gps;
      if (photo) barcode.photos.push({ url: photo, lat: gps?.lat, lng: gps?.lng, address: gps?.address });

      await barcode.save();

      // Notify target user
      const notif = await Notification.create({
        recipient: targetUserId,
        type: 'assigned',
        title: 'Material Transferred',
        message: `${req.user.fullName} transferred barcode ${barcode.barcode} (${barcode.materialName}) to you.`,
        relatedTransaction: null,
      });
      emitToUser(targetUserId, 'notification:new', notif);

      return res.json({
        message: 'Internal transfer completed successfully.',
        data: barcode,
        autoApproved: true
      });
    } else {
      // Cross-department transfer: request approval
      barcode.history.push({
        action: 'Transfer Requested',
        user: req.user._id,
        remarks: `Cross-department transfer requested to ${targetUser.fullName} (${targetUser.department.name}). Awaiting management approval.`,
        gps,
        photo
      });

      // Update barcode with pending transfer flags
      // We can save these temporary details in the history or on a schema extension
      // To make it robust, we'll write it to history. In the controller we can approve.
      // Let's store temporary approval details on the barcode document
      // (Mongoose accepts ad-hoc fields if schema is mixed, or we can use the history as truth)
      await barcode.save();

      // Notify all Management Admins in the company
      const managers = await User.find({ role: 'department_admin', departmentAdminType: 'management' });
      for (const manager of managers) {
        const notif = await Notification.create({
          recipient: manager._id,
          type: 'assigned',
          title: 'Cross-Dept Transfer Pending Approval',
          message: `${req.user.fullName} requested cross-department transfer of ${barcode.barcode} to ${targetUser.fullName}.`,
          relatedTransaction: null,
        });
        emitToUser(manager._id, 'notification:new', notif);
      }

      return res.json({
        message: 'Cross-department transfer request submitted. Awaiting management approval.',
        data: barcode,
        autoApproved: false
      });
    }
  } catch (error) {
    console.error('Transfer barcode error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/approve-transfer
const approveTransfer = async (req, res) => {
  try {
    const { targetUserId, remarks } = req.body;
    const barcode = await Barcode.findOne({ barcode: req.params.barcode });

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    // Only Management Admins or Super Admins can approve cross-dept transfers
    const isManager = req.user.role === 'super_admin' || 
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management');

    if (!isManager) {
      return res.status(403).json({ message: 'Access denied. Management approval required.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const oldOwner = barcode.owner;
    barcode.owner = targetUserId;
    barcode.history.push({
      action: 'Mgt Approved',
      user: req.user._id,
      remarks: remarks || `Management approved transfer to ${targetUser.fullName}`
    });

    await barcode.save();

    // Notify old owner and new owner
    const notifNew = await Notification.create({
      recipient: targetUserId,
      type: 'assigned',
      title: 'Transfer Approved',
      message: `Management approved transfer of ${barcode.barcode} to you. You are now the owner.`,
    });
    emitToUser(targetUserId, 'notification:new', notifNew);

    const notifOld = await Notification.create({
      recipient: oldOwner,
      type: 'completed',
      title: 'Transfer Approved',
      message: `Your transfer request for ${barcode.barcode} to ${targetUser.fullName} has been approved.`,
    });
    emitToUser(oldOwner, 'notification:new', notifOld);

    res.json({ message: 'Transfer approved and ownership moved successfully.', data: barcode });
  } catch (error) {
    console.error('Approve transfer error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/reject-transfer
const rejectTransfer = async (req, res) => {
  try {
    const { remarks } = req.body;
    const barcode = await Barcode.findOne({ barcode: req.params.barcode });

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    const isManager = req.user.role === 'super_admin' || 
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management');

    if (!isManager) {
      return res.status(403).json({ message: 'Access denied. Management approval required.' });
    }

    barcode.history.push({
      action: 'Transfer Rejected',
      user: req.user._id,
      remarks: remarks || 'Management rejected the cross-department transfer request.'
    });

    await barcode.save();

    // Notify current owner
    const notif = await Notification.create({
      recipient: barcode.owner,
      type: 'rejected',
      title: 'Transfer Request Rejected',
      message: `Management rejected your transfer request for barcode ${barcode.barcode}.`,
    });
    emitToUser(barcode.owner, 'notification:new', notif);

    res.json({ message: 'Transfer request rejected. Barcode remains with current owner.', data: barcode });
  } catch (error) {
    console.error('Reject transfer error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/return
const returnBarcode = async (req, res) => {
  try {
    const { remarks, gps, photo } = req.body;
    const barcode = await Barcode.findOne({ barcode: req.params.barcode });

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    if (barcode.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this barcode.' });
    }

    barcode.history.push({
      action: 'Return Requested',
      user: req.user._id,
      remarks: remarks || 'Return to store requested.',
      gps,
      photo
    });

    await barcode.save();

    // Notify Store Admin
    const storeAdmins = await User.find({ role: 'department_admin', departmentAdminType: 'store' });
    for (const admin of storeAdmins) {
      const notif = await Notification.create({
        recipient: admin._id,
        type: 'assigned',
        title: 'Return Request Received',
        message: `${req.user.fullName} requested return of ${barcode.barcode} (${barcode.materialName}) to store.`,
      });
      emitToUser(admin._id, 'notification:new', notif);
    }

    res.json({ message: 'Return request submitted to Store.', data: barcode });
  } catch (error) {
    console.error('Return barcode error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/confirm-return
const confirmReturnBarcode = async (req, res) => {
  try {
    const { handlerId, remarks, gps, photo } = req.body;
    const barcode = await Barcode.findOne({ barcode: req.params.barcode });

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    // Only Store Admin or Handler can confirm return
    const isStoreOrHandler = req.user.role === 'super_admin' || 
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store') ||
      (req.user.role === 'employee' && handlerId === req.user._id.toString());

    if (!isStoreOrHandler) {
      return res.status(403).json({ message: 'Access denied. Store Admin or Return Handler action required.' });
    }

    const previousOwner = barcode.owner;

    // Find Store Admin user or just assign store owner
    const storeAdmin = await User.findOne({ role: 'department_admin', departmentAdminType: 'store' });
    
    barcode.owner = storeAdmin ? storeAdmin._id : req.user._id;
    barcode.status = 'Returned';
    barcode.history.push({
      action: 'Returned',
      user: req.user._id,
      remarks: remarks || `Return completed and verified at Store.`,
      gps,
      photo
    });

    if (gps) barcode.gps = gps;
    if (photo) barcode.photos.push({ url: photo, lat: gps?.lat, lng: gps?.lng, address: gps?.address });

    await barcode.save();

    // Check if all barcodes in this transaction are returned/closed
    const transaction = await Transaction.findOne({ transactionId: barcode.transactionId });
    if (transaction) {
      // Find all barcodes matching this transaction
      const transactionBarcodes = await Barcode.find({ transactionId: barcode.transactionId });
      const allReturned = transactionBarcodes.every(bc => ['Returned', 'Closed'].includes(bc.status));
      if (allReturned) {
        transaction.status = 'closed';
        await transaction.save();

        // Create notification for original sender
        const finalNotif = await Notification.create({
          recipient: transaction.sender,
          type: 'completed',
          title: 'Transaction Closed',
          message: `All materials in ${transaction.transactionId} have been returned. Transaction is now closed.`,
        });
        emitToUser(transaction.sender, 'notification:new', finalNotif);
      }
    }

    // Notify previous owner
    const notif = await Notification.create({
      recipient: previousOwner,
      type: 'completed',
      title: 'Material Return Confirmed',
      message: `Store has received and confirmed return of barcode ${barcode.barcode}.`,
    });
    emitToUser(previousOwner, 'notification:new', notif);

    res.json({ message: 'Return confirmed. Ownership returned to Store.', data: barcode });
  } catch (error) {
    console.error('Confirm return error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/split
const splitBarcode = async (req, res) => {
  try {
    const { newBarcode, remarks, targetUserId } = req.body;
    const barcode = await Barcode.findOne({ barcode: req.params.barcode });

    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    if (barcode.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this barcode.' });
    }

    // Check if new barcode already exists
    const exists = await Barcode.findOne({ barcode: newBarcode });
    if (exists) {
      return res.status(400).json({ message: 'New barcode already exists in the system.' });
    }

    // Close original barcode
    barcode.status = 'Closed';
    barcode.history.push({
      action: 'Split',
      user: req.user._id,
      remarks: remarks || `Split material lot into new barcode: ${newBarcode}`
    });
    await barcode.save();

    // Create new barcode
    const targetUser = targetUserId || req.user._id;
    const childBarcode = new Barcode({
      barcode: newBarcode,
      transactionId: barcode.transactionId,
      materialName: barcode.materialName,
      status: 'Active',
      owner: targetUser,
      gps: barcode.gps,
      history: [
        {
          action: 'Created',
          user: req.user._id,
          remarks: `Created via split from parent barcode ${barcode.barcode}`
        }
      ]
    });
    await childBarcode.save();

    res.json({ message: 'Barcode split completed successfully.', parent: barcode, child: childBarcode });
  } catch (error) {
    console.error('Split barcode error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/barcodes/:barcode/chat
const getBarcodeChat = async (req, res) => {
  try {
    const messages = await BarcodeChat.find({ barcode: req.params.barcode })
      .populate('sender', 'fullName employeeId role profilePhoto')
      .sort({ createdAt: 1 });

    res.json({ data: messages });
  } catch (error) {
    console.error('Get barcode chat error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/barcodes/:barcode/chat
const createBarcodeChat = async (req, res) => {
  try {
    const { message, transactionId } = req.body;
    
    // Check if transaction is closed
    const txn = await Transaction.findOne({ transactionId });
    if (txn && txn.status === 'closed') {
      return res.status(400).json({ message: 'Chat is disabled because this transaction is closed.' });
    }

    const chat = new BarcodeChat({
      barcode: req.params.barcode,
      transactionId,
      sender: req.user._id,
      message
    });
    await chat.save();

    const populatedChat = await BarcodeChat.findById(chat._id)
      .populate('sender', 'fullName employeeId role profilePhoto');

    res.status(201).json({ data: populatedChat });
  } catch (error) {
    console.error('Create barcode chat error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = {
  getBarcodes,
  getBarcodeByCode,
  transferBarcode,
  approveTransfer,
  rejectTransfer,
  returnBarcode,
  confirmReturnBarcode,
  splitBarcode,
  getBarcodeChat,
  createBarcodeChat
};
