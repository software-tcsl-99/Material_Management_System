const Barcode = require('../models/Barcode');
const Transaction = require('../models/Transaction');
const Transfer = require('../models/Transfer');
const Return = require('../models/Return');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { emitToUser } = require('../config/socket');

const createNotification = async (userId, type, title, message, transactionId, barcodeId) => {
  const notif = await Notification.create({ user: userId, type, title, message, transactionId, barcodeId });
  emitToUser(userId.toString(), 'notification', notif);
};

/**
 * Get barcode detail
 */
exports.getBarcodeDetail = async (req, res) => {
  try {
    const { barcode } = req.params;
    const bc = await Barcode.findOne({ barcode })
      .populate('owner', 'fullName employeeId department designation')
      .populate('ownerDepartment', 'name')
      .populate('history.user', 'fullName employeeId')
      .populate('ownershipHistory.user', 'fullName employeeId')
      .populate('ownershipHistory.department', 'name')
      .populate({
        path: 'transaction',
        populate: [
          { path: 'requester', select: 'fullName employeeId department designation' },
          { path: 'teamLead', select: 'fullName employeeId' },
          { path: 'handler', select: 'fullName employeeId' }
        ]
      });

    if (!bc) {
      return res.status(404).json({ message: 'Barcode not found.' });
    }

    // Get related transfers and returns
    const transfers = await Transfer.find({ barcode })
      .populate('fromUser', 'fullName employeeId')
      .populate('toUser', 'fullName employeeId')
      .sort({ createdAt: -1 });

    const returns = await Return.find({ barcode })
      .populate('fromUser', 'fullName employeeId')
      .populate('returnHandler', 'fullName employeeId')
      .sort({ createdAt: -1 });

    res.json({ barcode: bc, transfers, returns });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get all barcodes for a transaction
 */
exports.getBarcodesByTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const barcodes = await Barcode.find({ transactionId })
      .populate('owner', 'fullName employeeId department')
      .populate('ownerDepartment', 'name');

    res.json({ barcodes });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Transfer barcode to another user
 */
exports.transferBarcode = async (req, res) => {
  try {
    const { barcode, toUserId, remarks, requiresApproval, gps, photos } = req.body;

    const bc = await Barcode.findOne({ barcode }).populate('owner');
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });
    if (bc.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You are not the owner of this barcode.' });
    }

    const User = require('../models/User');
    const toUser = await User.findById(toUserId).populate('department');
    if (!toUser) return res.status(404).json({ message: 'Target user not found.' });

    // Determine if cross-department
    const fromDept = (req.user.department._id || req.user.department).toString();
    const toDept = (toUser.department._id || toUser.department).toString();
    const isCrossDept = fromDept !== toDept;

    const transfer = await Transfer.create({
      transactionId: bc.transactionId,
      barcode,
      fromUser: req.user._id,
      toUser: toUserId,
      fromDepartment: req.user.department._id || req.user.department,
      toDepartment: toUser.department._id || toUser.department,
      type: isCrossDept ? 'cross_department' : 'internal',
      requiresApproval: isCrossDept || requiresApproval,
      status: 'pending', // Always pending first
      remarks,
      gps,
      photos: photos || [],
    });

    bc.history.push({
      action: 'Transfer Initiated',
      user: req.user._id,
      remarks: isCrossDept
        ? `Transfer initiated to ${toUser.fullName} (pending Management approval)`
        : `Transfer initiated to ${toUser.fullName} (pending recipient acceptance)`,
    });
    await bc.save();

    await createNotification(
      toUserId,
      'transfer_initiated',
      'Transfer Request',
      `${req.user.fullName} wants to transfer ${barcode} to you`,
      bc.transactionId,
      barcode
    );

    await AuditLog.create({
      action: 'TRANSFER',
      entity: 'Barcode',
      entityId: barcode,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Transfer ${barcode} from ${req.user.fullName} to ${toUser.fullName}`,
    });

    res.json({ message: 'Transfer initiated.', transfer });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.handleTransfer = async (req, res) => {
  try {
    const { transferId, action, reason, gps } = req.body;

    const transfer = await Transfer.findById(transferId);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found.' });

    // Check if the actor is Management
    const isManagement = req.user.role === 'department_admin' && req.user.departmentAdminType === 'management';

    if (isManagement && transfer.type === 'cross_department' && transfer.status === 'pending') {
      if (action === 'accept') {
        transfer.status = 'approved';
        transfer.approvedBy = req.user._id;
        transfer.approvedAt = new Date();
        await transfer.save();

        await createNotification(
          transfer.toUser,
          'transfer_approved_mgt',
          'Transfer Approved by Management',
          `Management approved transfer of ${transfer.barcode}. You can now accept it.`,
          transfer.transactionId,
          transfer.barcode
        );

        return res.json({ message: 'Transfer approved by management.', transfer });
      } else if (action === 'reject') {
        transfer.status = 'rejected';
        transfer.rejectedBy = req.user._id;
        transfer.rejectionReason = reason;
        await transfer.save();

        const bc = await Barcode.findOne({ barcode: transfer.barcode });
        bc.history.push({
          action: 'Transfer Rejected by Management',
          user: req.user._id,
          remarks: reason,
        });
        await bc.save();

        await createNotification(
          transfer.fromUser,
          'transfer_rejected_mgt',
          'Transfer Rejected by Management',
          `Management rejected transfer of ${transfer.barcode}: ${reason}`,
          transfer.transactionId,
          transfer.barcode
        );

        return res.json({ message: 'Transfer rejected by management.', transfer });
      }
    }

    // Otherwise, this is the recipient accepting/rejecting
    if (transfer.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to respond to this transfer.' });
    }

    if (action === 'accept') {
      transfer.status = 'completed';
      if (req.body.photos) {
        transfer.photos = req.body.photos;
      }
      const bc = await Barcode.findOne({ barcode: transfer.barcode });
      bc.owner = transfer.toUser;
      bc.ownerDepartment = transfer.toDepartment;
      bc.transferCount += 1;
      bc.ownershipHistory.push({
        user: transfer.toUser,
        department: transfer.toDepartment,
        action: 'transferred',
        remarks: 'Transfer accepted',
      });
      bc.history.push({
        action: 'Transfer Accepted',
        user: req.user._id,
        remarks: 'Transfer accepted',
        gps,
        photos: req.body.photos || []
      });
      await bc.save();

      // Update nested barcode owner inside the Transaction document
      const Transaction = require('../models/Transaction');
      await Transaction.updateOne(
        { transactionId: transfer.transactionId, 'materials.barcodes.barcode': transfer.barcode },
        { $set: { 'materials.$[].barcodes.$[bc].owner': transfer.toUser } },
        { arrayFilters: [{ 'bc.barcode': transfer.barcode }] }
      );

      await createNotification(
        transfer.fromUser,
        'transfer_accepted',
        'Transfer Accepted',
        `Transfer of ${transfer.barcode} was accepted`,
        transfer.transactionId,
        transfer.barcode
      );
    } else if (action === 'reject') {
      transfer.status = 'rejected';
      transfer.rejectedBy = req.user._id;
      transfer.rejectionReason = reason;

      const bc = await Barcode.findOne({ barcode: transfer.barcode });
      bc.history.push({
        action: 'Transfer Rejected',
        user: req.user._id,
        remarks: reason,
      });
      await bc.save();

      await createNotification(
        transfer.fromUser,
        'transfer_rejected',
        'Transfer Rejected',
        `Transfer of ${transfer.barcode} was rejected: ${reason}`,
        transfer.transactionId,
        transfer.barcode
      );
    }

    await transfer.save();
    res.json({ message: `Transfer ${action}ed.`, transfer });
  } catch (error) {
    console.error('Handle transfer error:', error);
    res.status(550).json({ message: 'Server error.' });
  }
};

/**
 * Return barcode to store
 */
exports.returnBarcode = async (req, res) => {
  try {
    const { barcode, reason, condition, remarks, gps, photos } = req.body;

    const bc = await Barcode.findOne({ barcode });
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });

    const returnDoc = await Return.create({
      transactionId: bc.transactionId,
      barcode,
      fromUser: req.user._id,
      status: 'pending',
      reason,
      condition: condition || 'good',
      remarks,
      gps,
      photos: photos || [],
    });

    bc.history.push({
      action: 'Return Requested',
      user: req.user._id,
      remarks: reason || 'Return to store requested',
      gps,
    });
    await bc.save();

    await AuditLog.create({
      action: 'RETURN_REQUEST',
      entity: 'Barcode',
      entityId: barcode,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Return requested for ${barcode}`,
    });

    res.json({ message: 'Return request submitted.', return: returnDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Store accepts return
 */
exports.acceptReturn = async (req, res) => {
  try {
    const { returnId } = req.params;
    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) return res.status(404).json({ message: 'Return not found.' });

    returnDoc.status = 'completed';
    returnDoc.store = req.user._id;
    returnDoc.receivedAt = new Date();
    await returnDoc.save();

    // Update barcode
    const bc = await Barcode.findOne({ barcode: returnDoc.barcode });
    bc.status = 'Returned';
    bc.owner = req.user._id; // Store user
    bc.history.push({
      action: 'Returned to Store',
      user: req.user._id,
      remarks: 'Store received and confirmed return',
    });
    bc.ownershipHistory.push({
      user: req.user._id,
      action: 'returned',
      remarks: 'Returned to store',
    });
    await bc.save();

    // Update transaction counts
    const transaction = await Transaction.findOne({ transactionId: bc.transactionId });
    if (transaction) {
      transaction.returnedItems = (transaction.returnedItems || 0) + 1;
      transaction.activeItems = Math.max(0, (transaction.activeItems || 0) - 1);

      // Check if all items returned
      if (transaction.returnedItems >= transaction.totalItems) {
        transaction.status = 'closed';
        transaction.closedAt = new Date();
        transaction.closedBy = req.user._id;
        transaction.chatLocked = true;
        transaction.timeline.push({
          action: 'Transaction Closed',
          description: 'All items returned to store',
          user: req.user._id,
        });
      } else {
        transaction.status = 'partially_returned';
      }

      await transaction.save();
    }

    await createNotification(
      returnDoc.fromUser,
      'return_accepted',
      'Return Accepted',
      `Return of ${returnDoc.barcode} has been accepted by store`,
      returnDoc.transactionId,
      returnDoc.barcode
    );

    res.json({ message: 'Return accepted.', return: returnDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Create split request
 */
exports.createSplitRequest = async (req, res) => {
  try {
    const { barcode, reason } = req.body;

    if (!barcode || !reason) {
      return res.status(400).json({ message: 'Barcode and reason are required.' });
    }

    const bc = await Barcode.findOne({ barcode });
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });

    // Check ownership
    if (bc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this barcode.' });
    }

    const SplitRequest = require('../models/SplitRequest');
    const splitReq = await SplitRequest.create({
      transactionId: bc.transactionId,
      barcode,
      materialName: bc.materialName,
      requester: req.user._id,
      reason,
      status: 'pending',
    });

    bc.history.push({
      action: 'Split Requested',
      user: req.user._id,
      remarks: reason,
    });
    await bc.save();

    res.json({ message: 'Split request submitted to store.', data: splitReq });
  } catch (error) {
    console.error('Create split request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get pending split requests (for store)
 */
exports.getPendingSplitRequests = async (req, res) => {
  try {
    // Only Store users or super admins can view pending split requests
    const isStore = req.user.role === 'super_admin' || (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store');
    if (!isStore) {
      return res.status(403).json({ message: 'Only Store users can view pending split requests.' });
    }

    const SplitRequest = require('../models/SplitRequest');
    const requests = await SplitRequest.find({ status: 'pending' })
      .populate('requester', 'fullName employeeId');

    res.json({ data: requests, requests });
  } catch (error) {
    console.error('Get split requests error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Approve split request (for store)
 */
exports.approveSplitRequest = async (req, res) => {
  try {
    const { requestId, newBarcode, materialName, quantity, action, reason } = req.body;

    const isStore = req.user.role === 'super_admin' || (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store');
    if (!isStore) {
      return res.status(403).json({ message: 'Only Store users can approve split requests.' });
    }

    const SplitRequest = require('../models/SplitRequest');
    const splitReq = await SplitRequest.findById(requestId);
    if (!splitReq) return res.status(404).json({ message: 'Split request not found.' });
    if (splitReq.status !== 'pending') return res.status(400).json({ message: 'Request is already processed.' });

    if (action === 'reject') {
      splitReq.status = 'rejected';
      await splitReq.save();

      // Update parent barcode history
      const parentBc = await Barcode.findOne({ barcode: splitReq.barcode });
      if (parentBc) {
        parentBc.history.push({
          action: 'Split Rejected',
          user: req.user._id,
          remarks: reason || 'Rejected by store',
        });
        await parentBc.save();
      }

      await createNotification(
        splitReq.requester,
        'split_rejected',
        'Split Request Rejected',
        `Store rejected your split request for barcode ${splitReq.barcode}: ${reason || ''}`,
        splitReq.transactionId,
        splitReq.barcode
      );

      return res.json({ message: 'Split request rejected by store.', data: splitReq });
    }

    // Check if newBarcode already exists
    const existingBc = await Barcode.findOne({ barcode: newBarcode });
    if (existingBc) {
      return res.status(400).json({ message: `Barcode ${newBarcode} already exists.` });
    }

    // Get parent barcode details
    const parentBc = await Barcode.findOne({ barcode: splitReq.barcode });
    if (!parentBc) return res.status(404).json({ message: 'Parent barcode not found.' });

    // Get requester details
    const User = require('../models/User');
    const requesterUser = await User.findById(splitReq.requester);
    if (!requesterUser) return res.status(404).json({ message: 'Requester not found.' });

    // Mark request as approved
    splitReq.status = 'approved';
    splitReq.approvedBy = req.user._id;
    splitReq.approvedAt = new Date();
    splitReq.newBarcode = newBarcode;
    splitReq.newQuantity = quantity || 1;
    await splitReq.save();

    // Create the NEW Barcode document
    const newBcDoc = await Barcode.create({
      barcode: newBarcode,
      transactionId: parentBc.transactionId,
      transaction: parentBc.transaction,
      materialName: materialName || parentBc.materialName,
      status: 'Active', // Instantly active, no acceptance step
      owner: splitReq.requester,
      ownerDepartment: requesterUser.department,
      parentBarcode: parentBc.barcode,
      isSplit: true,
      ownershipHistory: [{
        user: splitReq.requester,
        department: requesterUser.department,
        action: 'split_created',
        remarks: `Split approved by store. New material active.`,
      }],
      history: [{
        action: 'Split Child Created',
        user: req.user._id,
        remarks: `Created from split approval of parent ${parentBc.barcode}`,
      }],
    });

    // Mark parent barcode as split or add to history
    parentBc.history.push({
      action: 'Split Approved',
      user: req.user._id,
      remarks: `Split approved. New child barcode ${newBarcode} created.`,
    });
    await parentBc.save();

    // Update parent Transaction document to include this new barcode!
    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({ transactionId: parentBc.transactionId });
    if (transaction) {
      // Find the matching material entry by name
      const material = transaction.materials.find(
        m => m.name.toLowerCase() === parentBc.materialName.toLowerCase()
      );
      if (material) {
        // Push the new barcode into the barcodes list of this material
        material.barcodes.push({
          barcode: newBarcode,
          status: 'Active',
          owner: splitReq.requester,
        });
        material.quantity = (material.quantity || 0) + 1;
      } else {
        // If not found (shouldn't happen), create a new material entry
        transaction.materials.push({
          name: materialName || parentBc.materialName,
          quantity: 1,
          unit: 'pcs',
          barcodes: [{
            barcode: newBarcode,
            status: 'Active',
            owner: splitReq.requester,
          }]
        });
      }
      transaction.totalItems = (transaction.totalItems || 0) + 1;
      transaction.activeItems = (transaction.activeItems || 0) + 1;
      
      transaction.timeline.push({
        action: 'Split Approved',
        description: `Store approved split. New barcode ${newBarcode} registered and active.`,
        user: req.user._id,
      });
      await transaction.save();
    }

    // Notify requester to accept the split material
    await createNotification(
      splitReq.requester,
      'split_approved',
      'Split Request Approved',
      `Store approved your split request. The new material ${newBarcode} is now active.`,
      splitReq.transactionId,
      newBarcode
    );

    res.json({ message: 'Split approved and new material created.', data: newBcDoc });
  } catch (error) {
    console.error('Approve split request error:', error);
    res.status(550).json({ message: 'Server error.' });
  }
};

/**
 * Accept split material (by employee)
 */
exports.acceptSplitMaterial = async (req, res) => {
  try {
    const { barcode, gps, photos } = req.body;

    const bc = await Barcode.findOne({ barcode });
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'pending_acceptance') {
      return res.status(400).json({ message: 'Barcode is not pending acceptance.' });
    }

    // Verify ownership
    if (bc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to accept this barcode.' });
    }

    // Update Barcode document status to Active
    bc.status = 'Active';
    bc.history.push({
      action: 'Split Material Accepted',
      user: req.user._id,
      remarks: 'Split material accepted by requester',
      gps,
      photos: photos || [],
    });
    await bc.save();

    // Update status in the parent Transaction document's nested barcodes array!
    const Transaction = require('../models/Transaction');
    await Transaction.updateOne(
      { transactionId: bc.transactionId, 'materials.barcodes.barcode': barcode },
      { $set: { 'materials.$[].barcodes.$[bc].status': 'Active' } },
      { arrayFilters: [{ 'bc.barcode': barcode }] }
    );

    res.json({ message: 'Barcode accepted successfully.', barcode: bc });
  } catch (error) {
    console.error('Accept split material error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * List all barcodes (with filtering)
 */
exports.listBarcodes = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const filter = {};

    if (status) filter.status = status;

    if (req.user.role === 'employee') {
      filter.owner = req.user._id;
    }

    const [barcodes, total] = await Promise.all([
      Barcode.find(filter)
        .populate('owner', 'fullName employeeId')
        .populate('ownerDepartment', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Barcode.countDocuments(filter),
    ]);

    res.json({ data: barcodes, total, page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Search barcodes
 */
exports.searchBarcodes = async (req, res) => {
  try {
    const { q, status } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { barcode: { $regex: q, $options: 'i' } },
        { materialName: { $regex: q, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;

    // Role-based filtering (restrict others' materials)
    if (req.user.role === 'employee') {
      filter.owner = req.user._id;
    } else if (req.user.role === 'team_lead') {
      filter.ownerDepartment = req.user.department._id || req.user.department;
    } else if (req.user.role === 'department_admin') {
      if (req.user.departmentAdminType !== 'store' && req.user.departmentAdminType !== 'management' && req.user.departmentAdminType !== 'accounts') {
        filter.ownerDepartment = req.user.department._id || req.user.department;
      }
    }

    const barcodes = await Barcode.find(filter)
      .populate('owner', 'fullName employeeId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ barcodes });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get pending transfers for current user/department
 */
exports.getPendingTransfers = async (req, res) => {
  try {
    const query = {};

    if (req.user.role === 'employee') {
      // Employee sees internal pending transfers OR approved cross-department transfers
      query.toUser = req.user._id;
      query.$or = [
        { status: 'pending', type: 'internal' },
        { status: 'approved', type: 'cross_department' }
      ];
    } else if (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management') {
      // Management sees cross-department transfers pending management approval
      query.type = 'cross_department';
      query.status = 'pending';
    } else {
      // Return empty if not employee or management
      return res.json({ data: [], transfers: [] });
    }

    const transfers = await Transfer.find(query)
      .populate('fromUser', 'fullName employeeId')
      .populate('toUser', 'fullName employeeId')
      .populate('fromDepartment', 'name')
      .populate('toDepartment', 'name');

    res.json({ data: transfers, transfers });
  } catch (error) {
    console.error('Pending transfers error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get pending returns (for store)
 */
exports.getPendingReturns = async (req, res) => {
  try {
    const isStore = req.user.role === 'super_admin' || (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store');
    if (!isStore) {
      return res.status(403).json({ message: 'Only Store users can view pending return requests.' });
    }

    const Return = require('../models/Return');
    const returns = await Return.find({ status: 'pending' })
      .populate('fromUser', 'fullName employeeId');

    res.json({ data: returns, returns });
  } catch (error) {
    console.error('Get pending returns error:', error);
    res.status(550).json({ message: 'Server error.' });
  }
};

/**
 * Get all transfers
 */
exports.getAllTransfers = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'employee') {
      filter.$or = [
        { fromUser: req.user._id },
        { toUser: req.user._id }
      ];
    } else if (req.user.role === 'team_lead') {
      filter.$or = [
        { fromDepartment: req.user.department._id || req.user.department },
        { toDepartment: req.user.department._id || req.user.department }
      ];
    }

    const transfers = await Transfer.find(filter)
      .populate('fromUser', 'fullName employeeId')
      .populate('toUser', 'fullName employeeId')
      .populate('fromDepartment', 'name')
      .populate('toDepartment', 'name')
      .sort({ createdAt: -1 });

    res.json({ data: transfers });
  } catch (error) {
    console.error('Get all transfers error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get all returns
 */
exports.getAllReturns = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'employee') {
      filter.fromUser = req.user._id;
    }

    const returns = await Return.find(filter)
      .populate('fromUser', 'fullName employeeId')
      .populate('returnHandler', 'fullName employeeId')
      .populate('store', 'fullName employeeId')
      .sort({ createdAt: -1 });

    res.json({ data: returns });
  } catch (error) {
    console.error('Get all returns error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
