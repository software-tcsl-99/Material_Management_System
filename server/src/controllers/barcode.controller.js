const Barcode = require('../models/Barcode');
const Transaction = require('../models/Transaction');
const Transfer = require('../models/Transfer');
const Return = require('../models/Return');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Department = require('../models/Department');
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
    const normalizedBarcode = barcode ? barcode.trim().toUpperCase() : '';
    const bc = await Barcode.findOne({ barcode: normalizedBarcode })
      .populate('owner', 'fullName employeeId department designation')
      .populate('ownerDepartment', 'name')
      .populate('history.user', 'fullName employeeId')
      .populate('ownershipHistory.user', 'fullName employeeId')
      .populate('ownershipHistory.department', 'name')
      .populate('closeRequest.managementApprover', 'fullName employeeId')
      .populate('closeRequest.requester', 'fullName employeeId')
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

    // Get related transfers, returns, splits, and close requests
    const transfers = await Transfer.find({ barcode: normalizedBarcode })
      .populate('fromUser', 'fullName employeeId')
      .populate('toUser', 'fullName employeeId')
      .sort({ createdAt: -1 });

    const returns = await Return.find({ barcode: normalizedBarcode })
      .populate('fromUser', 'fullName employeeId')
      .populate('returnHandler', 'fullName employeeId')
      .sort({ createdAt: -1 });

    const SplitRequest = require('../models/SplitRequest');
    const splits = await SplitRequest.find({ barcode: normalizedBarcode })
      .populate('requester', 'fullName employeeId')
      .sort({ createdAt: -1 });

    const CloseRequest = require('../models/CloseRequest');
    const closeRequests = await CloseRequest.find({ barcode: normalizedBarcode })
      .populate('requester', 'fullName employeeId')
      .sort({ createdAt: -1 });

    res.json({ barcode: bc, transfers, returns, splits, closeRequests });
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
      .populate('ownerDepartment', 'name')
      .populate('history.user', 'fullName employeeId');

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
    const normalizedBarcode = barcode ? barcode.trim().toUpperCase() : '';

    const bc = await Barcode.findOne({ barcode: normalizedBarcode }).populate('owner');
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });

    // Validate that the parent transaction is fully delivered and received by the requester
    if (bc.transactionId) {
      const txn = await Transaction.findOne({ transactionId: bc.transactionId });
      if (txn && !['received', 'active', 'partially_returned', 'closed'].includes(txn.status)) {
        return res.status(400).json({ message: 'Cannot transfer barcode before the material is fully delivered and received.' });
      }
    }

    // Validate that no other transfer request is currently active/in-progress for this barcode
    const activeTransfer = await Transfer.findOne({ barcode: normalizedBarcode, status: 'pending' });
    if (activeTransfer) {
      return res.status(400).json({ message: 'Cannot transfer barcode while another transfer is active.' });
    }

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
    if (isCrossDept) {
      bc.history.push({
        action: 'Transfer Pending Management Approval',
        user: req.user._id,
        remarks: 'Awaiting management review/approval',
        timestamp: new Date()
      });
    } else {
      bc.history.push({
        action: 'Transfer Pending Acceptance',
        user: toUserId,
        remarks: 'Employee request pending recipient acceptance',
        timestamp: new Date()
      });
    }
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

    // Check if the actor is Management or Super Admin
    const isManagement = (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management') || req.user.role === 'super_admin';

    if (isManagement && transfer.type === 'cross_department' && transfer.status === 'pending') {
      if (action === 'accept') {
        transfer.status = 'approved';
        transfer.approvedBy = req.user._id;
        transfer.approvedAt = new Date();
        await transfer.save();

        const bc = await Barcode.findOne({ barcode: transfer.barcode });
        if (bc) {
          bc.history.push({
            action: 'Transfer Approved by Management',
            user: req.user._id,
            remarks: 'Management approved transfer request',
            timestamp: new Date()
          });
          bc.history.push({
            action: 'Transfer Pending Acceptance',
            user: transfer.toUser,
            remarks: 'Employee request pending recipient acceptance',
            timestamp: new Date()
          });
          await bc.save();
        }

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
    const { barcode, reason, condition, remarks, gps, photos, returnHandler } = req.body;
    const normalizedBarcode = barcode ? barcode.trim().toUpperCase() : '';

    const bc = await Barcode.findOne({ barcode: normalizedBarcode });
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });

    // Validate that the parent transaction is fully delivered and received by the requester
    if (bc.transactionId) {
      const txn = await Transaction.findOne({ transactionId: bc.transactionId });
      if (txn && !['received', 'active', 'partially_returned', 'closed'].includes(txn.status)) {
        return res.status(400).json({ message: 'Cannot return barcode before the material is fully delivered and received.' });
      }
    }

    // Validate that no return request is currently active/in-progress for this barcode
    const activeReturn = await Return.findOne({ barcode: normalizedBarcode, status: { $nin: ['completed', 'rejected'] } });
    if (activeReturn) {
      return res.status(400).json({ message: 'Cannot return barcode while a return request is active.' });
    }

    const status = returnHandler ? 'handler_assigned' : 'pending';

    const returnDoc = await Return.create({
      transactionId: bc.transactionId,
      barcode,
      fromUser: req.user._id,
      returnHandler: returnHandler || null,
      status,
      reason,
      condition: condition || 'good',
      remarks,
      gps,
      photos: photos || [],
    });

    let handlerUser = null;
    if (returnHandler) {
      const User = require('../models/User');
      handlerUser = await User.findById(returnHandler);
    }

    bc.history.push({
      action: returnHandler ? 'Return Requested (Via Handler)' : 'Return Requested (Direct)',
      user: req.user._id,
      remarks: reason || 'Return to store requested',
      gps,
      metadata: returnHandler ? {
        handlerId: returnHandler,
        handlerName: handlerUser ? handlerUser.fullName : 'Handler'
      } : undefined
    });
    await bc.save();

    await AuditLog.create({
      action: 'RETURN_REQUEST',
      entity: 'Barcode',
      entityId: barcode,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Return requested for ${barcode} (Method: ${returnHandler ? 'Handler' : 'Direct'})`,
    });

    // Notify handler if assigned
    if (returnHandler) {
      await createNotification(
        returnHandler,
        'handler_assigned',
        'Return Delivery Assigned',
        `You have been assigned to collect and return barcode ${barcode} to store`,
        bc.transactionId,
        barcode
      );

      if (bc.transactionId) {
        const parentTxn = await Transaction.findOne({ transactionId: bc.transactionId });
        if (parentTxn) {
          parentTxn.handler = returnHandler;
          if (!parentTxn.chatMembers.includes(returnHandler)) {
            parentTxn.chatMembers.push(returnHandler);
          }
          const User = require('../models/User');
          const handlerUser = await User.findById(returnHandler);
          const handlerName = handlerUser ? handlerUser.fullName : 'Handler';
          parentTxn.timeline.push({
            action: 'Handler Assigned',
            remarks: remarks || `Assigned return handler: ${handlerName}`,
            user: req.user._id,
          });
          await parentTxn.save();
        }
      }
    }

    res.json({ message: 'Return request submitted.', return: returnDoc });
  } catch (error) {
    console.error('Return barcode error:', error);
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
      // Update barcode status inside transaction materials loop
      transaction.materials = transaction.materials.map(m => {
        if (m.barcodes) {
          m.barcodes = m.barcodes.map(b => {
            const bStr = typeof b === 'string' ? b : (b.barcode || b._id?.toString());
            if (bStr === bc.barcode) {
              b.status = 'Returned';
            }
            return b;
          });
        }
        return m;
      });
      transaction.returnedItems = (transaction.returnedItems || 0) + 1;
      transaction.activeItems = Math.max(0, (transaction.activeItems || 0) - 1);

      // Check if all items returned or closed
      if ((transaction.returnedItems || 0) + (transaction.closedItems || 0) >= transaction.totalItems) {
        transaction.status = 'closed';
        transaction.closedAt = new Date();
        transaction.closedBy = req.user._id;
        transaction.chatLocked = true;
        transaction.timeline.push({
          action: 'Transaction Closed',
          description: 'All items returned or closed/converted',
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
 * Handler actions for return requests (Collect / Deliver)
 */
exports.handleReturnHandlerAction = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { actionType, remarks } = req.body;

    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) return res.status(404).json({ message: 'Return request not found.' });

    // Validate authorization (must be the assigned handler, employee, team_lead, or super admin)
    const isAssignedHandler = returnDoc.returnHandler && returnDoc.returnHandler.toString() === req.user._id.toString();
    const isEligibleRole = ['super_admin', 'team_lead', 'employee'].includes(req.user.role);
    if (!isEligibleRole && !isAssignedHandler) {
      return res.status(403).json({ message: 'You are not authorized to perform handler actions for this return.' });
    }

    if (actionType === 'collect') {
      returnDoc.status = 'collected';
      returnDoc.collectedAt = new Date();
      returnDoc.returnHandler = req.user._id; // Set current user who collected it as the handler
      returnDoc.previousHandler = null; // Clear previous handler on collection
      
      const bc = await Barcode.findOne({ barcode: returnDoc.barcode });
      if (bc) {
        bc.history.push({
          action: 'Return Collected by Handler',
          user: req.user._id,
          remarks: remarks || 'Handler collected returning items',
        });
        await bc.save();
      }
    } else if (actionType === 'deliver') {
      returnDoc.status = 'store_received';
      returnDoc.receivedAt = new Date();
      
      const bc = await Barcode.findOne({ barcode: returnDoc.barcode });
      if (bc) {
        bc.history.push({
          action: 'Return Handed Over to Store',
          user: req.user._id,
          remarks: remarks || 'Handler delivered returning items to store',
        });
        await bc.save();
      }
    } else if (actionType === 'reject' || actionType === 'decline') {
      const isReverted = !!returnDoc.previousHandler;
      let prevHandlerId = returnDoc.previousHandler;

      if (isReverted) {
        returnDoc.status = 'collected';
        returnDoc.returnHandler = prevHandlerId;
        returnDoc.previousHandler = null;
      } else {
        returnDoc.status = 'rejected';
        returnDoc.returnHandler = null;
      }
      
      const bc = await Barcode.findOne({ barcode: returnDoc.barcode });
      if (bc) {
        bc.history.push({
          action: isReverted ? 'Return Reassignment Declined by Handler' : 'Return Assignment Declined by Handler',
          user: req.user._id,
          remarks: remarks || (isReverted ? 'Handler declined return request reassignment' : 'Handler declined return request assignment'),
        });
        await bc.save();
      }

      // Also update parent transaction handler!
      if (returnDoc.transactionId) {
        const parentTxn = await Transaction.findOne({ transactionId: returnDoc.transactionId });
        if (parentTxn) {
          parentTxn.handler = isReverted ? prevHandlerId : null;
          
          if (isReverted) {
            const User = require('../models/User');
            const prevHandlerUser = await User.findById(prevHandlerId);
            const prevHandlerName = prevHandlerUser ? prevHandlerUser.fullName : 'Handler';
            parentTxn.timeline.push({
              action: 'Handler Assigned',
              remarks: `Reassignment declined; reverted back to previous handler: ${prevHandlerName}`,
              user: req.user._id,
            });
          }

          await parentTxn.save();
        }
      }

      if (!isReverted) {
        await createNotification(
          returnDoc.fromUser,
          'return_rejected',
          'Return Request Rejected',
          `Return request for ${returnDoc.barcode} was rejected by handler. Reason: ${remarks || 'No reason provided'}.`,
          returnDoc.transactionId,
          returnDoc.barcode
        );
      } else {
        await createNotification(
          prevHandlerId,
          'handler_assigned',
          'Return Reassignment Declined',
          `Next handler declined the return transfer. The return has been reverted back to you.`,
          returnDoc.transactionId,
          returnDoc.barcode
        );
      }
    } else {
      return res.status(400).json({ message: 'Invalid handler action type.' });
    }

    await returnDoc.save();

    await AuditLog.create({
      action: 'RETURN_HANDLER_ACTION',
      entity: 'Return',
      entityId: returnDoc.barcode,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Handler performed ${actionType} on return of ${returnDoc.barcode}`,
    });

    res.json({ message: `Return ${actionType}ed successfully.`, return: returnDoc });
  } catch (error) {
    console.error('Handle return handler action error:', error);
    try {
      const fs = require('fs');
      fs.writeFileSync('error.log', 'Handle return handler action error:\n' + (error.stack || error.message || String(error)));
    } catch (e) {}
    res.status(500).json({ message: 'Server error.', error: error.message });
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

    const normalizedBarcode = barcode ? barcode.trim().toUpperCase() : '';
    const bc = await Barcode.findOne({ barcode: normalizedBarcode });
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });

    // Validate that the parent transaction is fully delivered and received by the requester
    if (bc.transactionId) {
      const txn = await Transaction.findOne({ transactionId: bc.transactionId });
      if (txn && !['received', 'active', 'partially_returned', 'closed'].includes(txn.status)) {
        return res.status(400).json({ message: 'Cannot split barcode before the material is fully delivered and received.' });
      }
    }



    // Validate that no split request is currently active for this barcode
    const SplitRequest = require('../models/SplitRequest');
    const activeSplit = await SplitRequest.findOne({ barcode: normalizedBarcode, status: 'pending' });
    if (activeSplit) {
      return res.status(400).json({ message: 'Cannot split barcode while another split request is pending.' });
    }

    // Check ownership
    if (bc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this barcode.' });
    }

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
    const normalizedNewBarcode = newBarcode ? newBarcode.trim().toUpperCase() : '';
    const existingBc = await Barcode.findOne({ barcode: normalizedNewBarcode });
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
    const normalizedBarcode = barcode ? barcode.trim().toUpperCase() : '';

    const bc = await Barcode.findOne({ barcode: normalizedBarcode });
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
    let query;

    const isManagement = req.user.role === 'super_admin' || (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management');

    if (isManagement) {
      // Management/Super Admin sees cross-department transfers pending management approval
      // OR transfers specifically sent to them
      query = {
        $or: [
          { type: 'cross_department', status: 'pending' },
          { toUser: req.user._id, status: 'pending', type: 'internal' },
          { toUser: req.user._id, status: 'approved', type: 'cross_department' }
        ]
      };
    } else {
      // All other users (employee, team_lead, stores, etc.) see transfers sent to them
      query = {
        toUser: req.user._id,
        $or: [
          { status: 'pending', type: 'internal' },
          { status: 'approved', type: 'cross_department' }
        ]
      };
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
    
    let filter = {};
    if (isStore) {
      // Store only sees returns that are pending (direct) or store_received (delivered by handler)
      filter = { status: { $in: ['pending', 'store_received'] } };
    } else if (req.user.role === 'employee') {
      // Handler sees returns assigned to them OR returns created by them once handler is assigned
      filter = {
        $or: [
          { returnHandler: req.user._id, status: { $in: ['handler_assigned', 'collected', 'store_received'] } },
          { fromUser: req.user._id, status: { $in: ['handler_assigned', 'collected', 'store_received'] } }
        ]
      };
    } else {
      // Others see returns that have handler assigned/collected/store_received
      filter = { status: { $in: ['handler_assigned', 'collected', 'store_received'] } };
    }

    const Return = require('../models/Return');
    const returns = await Return.find(filter)
      .populate('fromUser', 'fullName employeeId')
      .populate('returnHandler', 'fullName employeeId');

    res.json({ data: returns, returns });
  } catch (error) {
    console.error('Get pending returns error:', error);
    res.status(500).json({ message: 'Server error.' });
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

/**
 * Assign/reassign handler for a Return request
 */
exports.assignReturnHandler = async (req, res) => {
  try {
    const { returnId } = req.params;
    const { handlerId, remarks } = req.body;

    const returnDoc = await Return.findById(returnId);
    if (!returnDoc) return res.status(404).json({ message: 'Return request not found.' });

    // Allow current handler, super_admin, or store admin to reassign
    const isAssignedHandler = returnDoc.returnHandler && returnDoc.returnHandler.toString() === req.user._id.toString();
    const isStore = req.user.role === 'department_admin' && req.user.departmentAdminType === 'store';
    if (req.user.role !== 'super_admin' && !isAssignedHandler && !isStore) {
      return res.status(403).json({ message: 'Not authorized to change return handler.' });
    }

    if (returnDoc.returnHandler) {
      returnDoc.previousHandler = returnDoc.returnHandler;
    }
    returnDoc.returnHandler = handlerId;
    returnDoc.status = 'handler_assigned';
    // Update barcode history
    const bc = await Barcode.findOne({ barcode: returnDoc.barcode });
    if (bc) {
      const User = require('../models/User');
      const handlerUser = await User.findById(handlerId);
      const newHandlerName = handlerUser ? handlerUser.fullName : 'Handler';
      bc.history.push({
        action: 'Return Handler Reassigned',
        user: req.user._id,
        remarks: remarks || `Reassigned return handler to ${newHandlerName}`,
        metadata: { handlerId, handlerName: newHandlerName }
      });
      await bc.save();
    }

    await returnDoc.save();

    // Also update parent transaction handler!
    if (returnDoc.transactionId) {
      const parentTxn = await Transaction.findOne({ transactionId: returnDoc.transactionId });
      if (parentTxn) {
        parentTxn.handler = handlerId;
        if (!parentTxn.chatMembers.includes(handlerId)) {
          parentTxn.chatMembers.push(handlerId);
        }
        const User = require('../models/User');
        const handlerUser = await User.findById(handlerId);
        const handlerName = handlerUser ? handlerUser.fullName : 'Handler';
        parentTxn.timeline.push({
          action: 'Handler Assigned',
          remarks: remarks || `Reassigned return handler to ${handlerName}`,
          user: req.user._id,
        });
        await parentTxn.save();
      }
    }

    res.json({ message: 'Return handler updated successfully.', returnDoc });
  } catch (error) {
    console.error('Assign return handler error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Create a Close Request (Requester requests to close/convert a barcode to DC)
 */
exports.createCloseRequest = async (req, res) => {
  try {
    const { barcode, documentType, documentNumber, remarks } = req.body;

    if (!barcode || !documentType || !documentNumber) {
      return res.status(400).json({ message: 'Barcode, Document Type, and Document Number are required.' });
    }

    const Barcode = require('../models/Barcode');
    const bc = await Barcode.findOne({ barcode });
    if (!bc) return res.status(404).json({ message: 'Barcode not found.' });
    if (bc.status !== 'Active') return res.status(400).json({ message: 'Barcode is not active.' });

    // Validate ownership
    if (bc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not the owner of this barcode.' });
    }



    const { managementApprover } = req.body;

    const CloseRequest = require('../models/CloseRequest');
    const closeReq = await CloseRequest.create({
      transactionId: bc.transactionId,
      barcode,
      documentType,
      documentNumber,
      remarks,
      requester: req.user._id,
      managementApprover: ['DC FOC', 'Invoice'].includes(documentType) ? managementApprover : undefined,
      status: 'pending'
    });

    bc.closeRequest = {
      documentType,
      documentNumber,
      remarks,
      requester: req.user._id,
      managementApprover: ['DC FOC', 'Invoice'].includes(documentType) ? managementApprover : undefined,
      status: 'pending'
    };

    bc.history.push({
      action: 'Close Requested',
      user: req.user._id,
      remarks: `Requested conversion to ${documentType} (${documentNumber}). ${remarks || ''}`
    });
    await bc.save();

    const Transaction = require('../models/Transaction');
    const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
    if (txn) {
      txn.timeline.push({
        action: 'Close Requested',
        description: `Barcode ${barcode} close/conversion request created for ${documentType} (${documentNumber})`,
        user: req.user._id,
        timestamp: new Date()
      });
      await txn.save();
    }

    res.json({ message: 'Barcode close request submitted successfully.', data: closeReq });
  } catch (error) {
    console.error('Create close request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get pending Close Requests (for Team Lead / Admin)
 */
exports.getPendingCloseRequests = async (req, res) => {
  try {
    const CloseRequest = require('../models/CloseRequest');
    let query = {};

    if (req.user.role === 'team_lead') {
      const User = require('../models/User');
      const deptUsers = await User.find({ department: req.user.department }).select('_id');
      const deptUserIds = deptUsers.map(u => u._id);
      query.status = 'pending';
      query.requester = { $in: deptUserIds };
      query.documentType = 'DC Internal';
    } else if (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management') {
      query.status = 'pending';
      query.documentType = { $in: ['DC FOC', 'Invoice'] };
      query.managementApprover = req.user._id;
    } else if (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store') {
      query.status = 'pending_store_acceptance';
      query.documentType = { $in: ['DC Internal', 'DC FOC'] };
    } else if (req.user.role === 'department_admin' && req.user.departmentAdminType === 'accounts') {
      query.status = 'pending_accounts_approval';
      query.documentType = 'Invoice';
    } else if (req.user.role === 'super_admin') {
      query.status = { $in: ['pending', 'pending_accounts_approval', 'pending_store_acceptance'] };
    } else {
      // Others see nothing
      return res.json({ data: [], requests: [] });
    }

    const requests = await CloseRequest.find(query)
      .populate('requester', 'fullName employeeId department')
      .populate('managementApprover', 'fullName employeeId');

    res.json({ data: requests, requests });
  } catch (error) {
    console.error('Get pending close requests error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Handle Close Request approval/rejection (by Team Lead / Admin)
 */
exports.handleCloseRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, rejectionReason } = req.body;

    const CloseRequest = require('../models/CloseRequest');
    const closeReq = await CloseRequest.findById(requestId).populate('requester');
    if (!closeReq) return res.status(404).json({ message: 'Close request not found.' });
    if (closeReq.status !== 'pending' && closeReq.status !== 'pending_accounts_approval' && closeReq.status !== 'pending_store_acceptance') {
      return res.status(400).json({ message: 'Request is already processed.' });
    }

    // Authorization check
    if (closeReq.status === 'pending') {
      if (closeReq.documentType === 'DC Internal') {
        const requesterDept = (closeReq.requester?.department?._id || closeReq.requester?.department)?.toString();
        const userDept = (req.user.department?._id || req.user.department)?.toString();
        if (req.user.role !== 'super_admin' && (req.user.role !== 'team_lead' || requesterDept !== userDept)) {
          return res.status(403).json({ message: 'Only the Team Lead of the requester\'s department can approve this DC Internal request.' });
        }
      } else if (closeReq.documentType === 'DC FOC' || closeReq.documentType === 'Invoice') {
        if (req.user.role !== 'super_admin' && 
            (req.user.role !== 'department_admin' || 
             req.user.departmentAdminType !== 'management' || 
             closeReq.managementApprover?.toString() !== req.user._id.toString())) {
          return res.status(403).json({ message: 'Only the selected Management approver can approve this conversion request.' });
        }
      } else {
        return res.status(400).json({ message: 'Invalid document type for close request.' });
      }
    } else if (closeReq.status === 'pending_accounts_approval') {
      if (req.user.role !== 'super_admin' && !(req.user.role === 'department_admin' && req.user.departmentAdminType === 'accounts')) {
        return res.status(403).json({ message: 'Only Accounts Admin can approve this request.' });
      }
    } else if (closeReq.status === 'pending_store_acceptance') {
      if (req.user.role !== 'super_admin' && !(req.user.role === 'department_admin' && req.user.departmentAdminType === 'store')) {
        return res.status(403).json({ message: 'Only Store Admin can accept this request.' });
      }
    }

    const Barcode = require('../models/Barcode');
    const bc = await Barcode.findOne({ barcode: closeReq.barcode });
    if (!bc) return res.status(404).json({ message: 'Associated barcode not found.' });

    if (closeReq.status === 'pending') {
      if (action === 'reject') {
        closeReq.status = 'rejected';
        closeReq.rejectionReason = rejectionReason || 'Rejected';

        bc.closeRequest.status = 'rejected';
        bc.closeRequest.rejectionReason = rejectionReason || 'Rejected';
        bc.history.push({
          action: 'Close Rejected',
          user: req.user._id,
          remarks: rejectionReason || 'Rejection of conversion request'
        });
        await bc.save();

        const Transaction = require('../models/Transaction');
        const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
        if (txn) {
          txn.timeline.push({
            action: 'Conversion Rejected',
            remarks: `Conversion request for barcode ${bc.barcode} rejected by ${req.user.fullName}: ${rejectionReason || ''}`,
            user: req.user._id,
            timestamp: new Date()
          });
          await txn.save();
        }
      } else if (action === 'approve') {
        if (closeReq.documentType === 'Invoice') {
          // Go to accounts department admin for invoice upload
          closeReq.status = 'pending_accounts_approval';
          closeReq.approvedBy = req.user._id;
          closeReq.approvedAt = new Date();

          bc.closeRequest.status = 'pending_accounts_approval';
          bc.history.push({
            action: 'First Approval',
            user: req.user._id,
            remarks: `Approved by Management Approver (${req.user.fullName}). Awaiting Accounts Admin upload.`
          });
          await bc.save();

          const Transaction = require('../models/Transaction');
          const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
          if (txn) {
            txn.timeline.push({
              action: 'First Approval',
              remarks: `Conversion request for barcode ${bc.barcode} to Invoice approved by Management Approver. Awaiting Accounts Admin upload.`,
              user: req.user._id,
              timestamp: new Date()
            });
            await txn.save();
          }
        } else if (closeReq.documentType === 'DC FOC' || closeReq.documentType === 'DC Internal') {
          // For DC Internal and DC FOC, move to pending_store_acceptance
          closeReq.status = 'pending_store_acceptance';
          closeReq.approvedBy = req.user._id;
          closeReq.approvedAt = new Date();

          bc.closeRequest.status = 'pending_store_acceptance';
          bc.history.push({
            action: 'First Approval',
            user: req.user._id,
            remarks: `Approved by ${closeReq.documentType === 'DC FOC' ? 'Management' : 'Team Lead'}. Awaiting store acceptance.`
          });
          await bc.save();

          const Transaction = require('../models/Transaction');
          const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
          if (txn) {
            txn.timeline.push({
              action: 'First Approval',
              remarks: `Conversion request for barcode ${bc.barcode} to ${closeReq.documentType} approved by ${req.user.fullName}. Awaiting store acceptance.`,
              user: req.user._id,
              timestamp: new Date()
            });
            await txn.save();
          }
        }
      } else {
        return res.status(400).json({ message: 'Invalid action.' });
      }
    } else if (closeReq.status === 'pending_accounts_approval') {
      if (action === 'reject') {
        closeReq.status = 'pending';
        closeReq.rejectionReason = rejectionReason || 'Rejected by Accounts';
        closeReq.approvedBy = undefined;
        closeReq.approvedAt = undefined;

        bc.closeRequest.status = 'pending';
        bc.closeRequest.rejectionReason = rejectionReason || 'Rejected by Accounts';
        bc.closeRequest.approvedBy = undefined;
        bc.closeRequest.approvedAt = undefined;
        bc.history.push({
          action: 'Close Reverted by Accounts',
          user: req.user._id,
          remarks: `Accounts rejected/reverted Invoice conversion request. Reason: ${rejectionReason || ''}`
        });
        await bc.save();

        const Transaction = require('../models/Transaction');
        const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
        if (txn) {
          txn.timeline.push({
            action: 'Conversion Reverted',
            remarks: `Invoice conversion request for barcode ${bc.barcode} rejected by Accounts and reverted to Management stage: ${rejectionReason || ''}`,
            user: req.user._id,
            timestamp: new Date()
          });
          await txn.save();
        }
      } else if (action === 'approve') {
        const { invoiceUrl } = req.body;
        if (!invoiceUrl) {
          return res.status(400).json({ message: 'Invoice URL is required for approval.' });
        }

        closeReq.status = 'approved';
        closeReq.invoiceUrl = invoiceUrl;
        closeReq.approvedBy = req.user._id;
        closeReq.approvedAt = new Date();

        bc.status = 'Closed';
        bc.closeRequest.status = 'approved';

        const docName = `Invoice-${closeReq.documentNumber}`;
        bc.documents.push({
          name: docName,
          url: invoiceUrl,
          type: 'Invoice',
          size: 0
        });

        bc.history.push({
          action: 'Closed',
          user: req.user._id,
          remarks: `Accounts uploaded invoice and closed RDC, converting to Invoice (${closeReq.documentNumber})`
        });
        await bc.save();

        const Transaction = require('../models/Transaction');
        const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
        if (txn) {
          // Update the barcode status inside materials loop instead of removing
          txn.materials = txn.materials.map(m => {
            if (m.barcodes) {
              m.barcodes = m.barcodes.map(b => {
                const bStr = typeof b === 'string' ? b : (b.barcode || b._id?.toString());
                if (bStr === bc.barcode) {
                  b.status = 'Closed';
                }
                return b;
              });
            }
            return m;
          });

          // Add to transaction documents
          txn.documents.push({
            name: docName,
            url: invoiceUrl,
            type: 'Invoice',
            size: 0,
            uploadedBy: req.user._id,
            uploadedAt: new Date()
          });

          // Update progress tracking
          txn.closedItems = (txn.closedItems || 0) + 1;
          txn.activeItems = Math.max(0, (txn.activeItems || 0) - 1);

          // Check if all items returned or closed
          if ((txn.returnedItems || 0) + (txn.closedItems || 0) >= txn.totalItems) {
            txn.status = 'closed';
            txn.closedAt = new Date();
            txn.closedBy = req.user._id;
            txn.chatLocked = true;
            txn.timeline.push({
              action: 'Transaction Closed',
              description: 'All items returned or closed/converted',
              user: req.user._id,
            });
          }

          txn.timeline.push({
            action: 'Closed',
            remarks: `Barcode ${bc.barcode} closed via Accounts approval for Invoice (${closeReq.documentNumber})`,
            user: req.user._id,
            timestamp: new Date()
          });
          await txn.save();
        }
      } else {
        return res.status(400).json({ message: 'Invalid action.' });
      }
    } else if (closeReq.status === 'pending_store_acceptance') {
      if (action === 'reject') {
        return res.status(400).json({ message: 'Store cannot reject conversion requests. Store can only accept them.' });
      } else if (action === 'approve') {
        closeReq.status = 'approved';
        closeReq.approvedBy = req.user._id;
        closeReq.approvedAt = new Date();

        bc.status = 'Closed';
        bc.closeRequest.status = 'approved';
        bc.history.push({
          action: 'Closed',
          user: req.user._id,
          remarks: `Store accepted and closed RDC, converting to ${closeReq.documentType} (${closeReq.documentNumber})`
        });
        await bc.save();

        const Transaction = require('../models/Transaction');
        const txn = await Transaction.findOne({ $or: [{ _id: bc.transaction }, { transactionId: bc.transactionId }] });
        if (txn) {
          // Update the barcode status inside materials loop instead of removing
          txn.materials = txn.materials.map(m => {
            if (m.barcodes) {
              m.barcodes = m.barcodes.map(b => {
                const bStr = typeof b === 'string' ? b : (b.barcode || b._id?.toString());
                if (bStr === bc.barcode) {
                  b.status = 'Closed';
                }
                return b;
              });
            }
            return m;
          });

          // Update progress tracking
          txn.closedItems = (txn.closedItems || 0) + 1;
          txn.activeItems = Math.max(0, (txn.activeItems || 0) - 1);

          // Check if all items returned or closed
          if ((txn.returnedItems || 0) + (txn.closedItems || 0) >= txn.totalItems) {
            txn.status = 'closed';
            txn.closedAt = new Date();
            txn.closedBy = req.user._id;
            txn.chatLocked = true;
            txn.timeline.push({
              action: 'Transaction Closed',
              description: 'All items returned or closed/converted',
              user: req.user._id,
            });
          }

          txn.timeline.push({
            action: 'Closed',
            remarks: `Barcode ${bc.barcode} closed via Store approval for ${closeReq.documentType} (${closeReq.documentNumber})`,
            user: req.user._id,
            timestamp: new Date()
          });
          await txn.save();
        }
      } else {
        return res.status(400).json({ message: 'Invalid action.' });
      }
    }

    await closeReq.save();
    res.json({ message: `Close request successfully processed.`, data: closeReq });
  } catch (error) {
    console.error('Handle close request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
