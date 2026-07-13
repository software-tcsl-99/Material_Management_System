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

    const ExchangeRequest = require('../models/ExchangeRequest');
    const exchanges = await ExchangeRequest.find({ $or: [{ oldBarcode: normalizedBarcode }, { newBarcode: normalizedBarcode }] })
      .populate('requester', 'fullName employeeId')
      .populate('approvedBy', 'fullName employeeId')
      .sort({ createdAt: -1 });

    res.json({ barcode: bc, transfers, returns, splits, closeRequests, exchanges });
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

    // Notify all store admins about this transfer
    try {
      const storeAdmins = await User.find({
        role: 'department_admin',
        departmentAdminType: 'store'
      });
      for (const admin of storeAdmins) {
        await createNotification(
          admin._id,
          'transfer_initiated_store',
          'Material Transfer Initiated',
          `Material ${barcode} is being transferred from ${req.user.fullName} to ${toUser.fullName} for transaction ${bc.transactionId || 'N/A'}`,
          bc.transactionId,
          barcode
        );
      }
    } catch (err) {
      console.error('Error notifying store admins about transfer:', err);
    }

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

      const User = require('../models/User');
      const fromUserObj = await User.findById(transfer.fromUser);
      const toUserObj = await User.findById(transfer.toUser);

      // Notify the sender (who transferred)
      await createNotification(
        transfer.fromUser,
        'transfer_success_sender',
        'Material Transferred Successfully',
        `Material ${bc ? bc.materialName : 'Material'} (Barcode: ${transfer.barcode}) transferred successfully from you to ${toUserObj?.fullName || 'Recipient'}.`,
        transfer.transactionId,
        transfer.barcode
      );

      // Notify the recipient (who currently holds it)
      await createNotification(
        transfer.toUser,
        'transfer_success_recipient',
        'Material Transferred Successfully',
        `Material ${bc ? bc.materialName : 'Material'} (Barcode: ${transfer.barcode}) transferred successfully to you from ${fromUserObj?.fullName || 'Sender'}.`,
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

    // Notify all store admins about this transfer update
    try {
      const User = require('../models/User');
      const fromUserObj = await User.findById(transfer.fromUser);
      const toUserObj = await User.findById(transfer.toUser);
      const storeAdmins = await User.find({
        role: 'department_admin',
        departmentAdminType: 'store'
      });
      const bc = await Barcode.findOne({ barcode: transfer.barcode });
      for (const admin of storeAdmins) {
        let msg = `Transfer of barcode ${transfer.barcode} from ${fromUserObj?.fullName || 'Requester'} to ${toUserObj?.fullName || 'Recipient'} was ${action}ed. New Status: ${transfer.status.toUpperCase()}`;
        if (action === 'accept' && bc) {
          msg = `Material ${bc.materialName} (Barcode: ${transfer.barcode}) was transferred from ${fromUserObj?.fullName || 'Sender'} to ${toUserObj?.fullName || 'Recipient'}.`;
        }
        await createNotification(
          admin._id,
          'transfer_status_update_store',
          'Material Transferred',
          msg,
          transfer.transactionId,
          transfer.barcode
        );
      }
    } catch (err) {
      console.error('Error notifying store admins about transfer update:', err);
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
    if (bc.status !== 'Active' && bc.status !== 'Exchanged') {
      return res.status(400).json({ message: 'Barcode is not active or eligible for return.' });
    }

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
    if (bc.status === 'Exchanged') {
      bc.status = 'Returned';
      bc.owner = req.user._id; // Store user
      bc.history.push({
        action: 'Returned to Store (Exchange Completed)',
        user: req.user._id,
        remarks: 'Store received and confirmed warranty return of old barcode',
        timestamp: new Date()
      });
      bc.ownershipHistory.push({
        user: req.user._id,
        action: 'returned',
        remarks: 'Returned to store (exchanged barcode)',
      });
      await bc.save();

      const ExchangeRequest = require('../models/ExchangeRequest');
      await ExchangeRequest.findOneAndUpdate(
        { oldBarcode: bc.barcode, status: 'approved' },
        { returnStatus: 'accepted_by_store' }
      );

      // Update transaction status & counts for the exchanged barcode
      const transaction = await Transaction.findOne({ transactionId: bc.transactionId });
      if (transaction) {
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

        // If there is still an active barcode in this transaction, it must remain active (not closed!)
        const hasActive = await Barcode.findOne({ transactionId: transaction.transactionId, status: 'Active' });
        if (hasActive) {
          transaction.status = 'active';
          transaction.chatLocked = false;
          transaction.closedAt = undefined;
          transaction.closedBy = undefined;
        } else {
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
          }
        }
        await transaction.save();
      }
    } else {
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
    const SplitRequest = require('../models/SplitRequest');
    const { barcode, reason, requestedMaterialName } = req.body;

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



    // Check ownership
    if (bc.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this barcode.' });
    }

    const splitReq = await SplitRequest.create({
      transactionId: bc.transactionId,
      barcode,
      materialName: bc.materialName,
      requestedMaterialName,
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
      // Find the parent material entry to copy properties
      const parentMaterial = transaction.materials.find(
        m => m.name.toLowerCase() === parentBc.materialName.toLowerCase()
      );

      // Always create a NEW material entry for the split barcode child
      transaction.materials.push({
        name: materialName || splitReq.requestedMaterialName || parentBc.materialName,
        description: `Split child of ${parentBc.barcode}`,
        quantity: 1,
        unit: parentMaterial?.unit || 'pcs',
        price: 0,
        barcodes: [{
          barcode: newBarcode,
          status: 'Active',
          owner: splitReq.requester,
        }]
      });

      transaction.totalItems = (transaction.totalItems || 0) + 1;
      transaction.activeItems = (transaction.activeItems || 0) + 1;
      
      transaction.timeline.push({
        action: 'Split Approved',
        description: `Store approved split. New barcode ${newBarcode} registered and active.`,
        user: req.user._id,
      });
      await transaction.save();
    }

    // Notify all store admins about this split creation/transfer
    try {
      const storeAdmins = await User.find({
        role: 'department_admin',
        departmentAdminType: 'store'
      });
      for (const admin of storeAdmins) {
        await createNotification(
          admin._id,
          'split_approved_store',
          'Material Split Created/Transferred',
          `New split child barcode ${newBarcode} has been created and active from parent barcode ${parentBc.barcode} for transaction ${parentBc.transactionId || 'N/A'}.`,
          splitReq.transactionId,
          newBarcode
        );
      }
    } catch (err) {
      console.error('Error notifying store admins about split approval:', err);
    }

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
 * Get barcodes currently owned by the Store Admin for a specific material name
 */
exports.getStoreAvailableBarcodes = async (req, res) => {
  try {
    const { materialName } = req.query;
    if (!materialName) {
      return res.status(400).json({ message: 'materialName query parameter is required.' });
    }

    const axios = require('axios');
    const xml2js = require('xml2js');
    const liveTallyUrl = process.env.TALLY_LIVE_URL || 'http://localhost:9000';

    // 1. Get active company name from Tally
    const COMPANY_QUERY_XML = `
    <ENVELOPE>
      <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>ActiveCompanies</ID>
      </HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          </STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="ActiveCompanies" ISINITIALIZE="Yes">
                <TYPE>Company</TYPE>
                <FETCH>Name</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`;

    let companyName = '';
    try {
      const compResponse = await axios.post(liveTallyUrl, COMPANY_QUERY_XML, {
        headers: { 'Content-Type': 'application/xml' },
        timeout: 3000
      });
      const parser = new xml2js.Parser({ explicitArray: false });
      const parsedComp = await parser.parseStringPromise(compResponse.data);
      const activeCompanyObj = parsedComp?.ENVELOPE?.BODY?.DATA?.COLLECTION?.COMPANY;
      if (activeCompanyObj) {
        if (typeof activeCompanyObj === 'string') {
          companyName = activeCompanyObj;
        } else if (typeof activeCompanyObj === 'object') {
          if (activeCompanyObj.NAME) {
            companyName = typeof activeCompanyObj.NAME === 'object' ? activeCompanyObj.NAME._ : activeCompanyObj.NAME;
          } else if (activeCompanyObj.$ && activeCompanyObj.$.NAME) {
            companyName = activeCompanyObj.$.NAME;
          }
        }
      }
    } catch (err) {
      console.error('Failed to get active company for barcodes from Tally:', err.message);
      return res.json({ barcodes: [], message: 'Tally Prime server is unreachable.' });
    }

    if (!companyName) {
      return res.json({ barcodes: [], message: 'No active company in Tally.' });
    }

    // 2. Build XML request to fetch all stock items with BatchAllocations
    const escapedCompanyName = companyName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const STOCK_QUERY_XML = `
    <ENVELOPE>
      <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>StockItemBarcodes</ID>
      </HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            <SVCURRENTCOMPANY>${escapedCompanyName}</SVCURRENTCOMPANY>
          </STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="StockItemBarcodes" ISINITIALIZE="Yes">
                <TYPE>StockItem</TYPE>
                <FETCH>Name, BatchAllocations</FETCH>
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>`;

    const response = await axios.post(liveTallyUrl, STOCK_QUERY_XML, {
      headers: { 'Content-Type': 'application/xml' },
      timeout: 5000
    });

    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const parsedData = await parser.parseStringPromise(response.data);

    const rawItems = parsedData?.ENVELOPE?.BODY?.DATA?.COLLECTION?.STOCKITEM || [];
    const stockItems = Array.isArray(rawItems) ? rawItems : [rawItems];

    // 3. Find matched item
    const targetName = materialName.toLowerCase().trim();
    const matchedItem = stockItems.find(item => {
      let name = '';
      if (item) {
        if (typeof item.NAME === 'string') name = item.NAME;
        else if (typeof item.NAME === 'object' && item.NAME._) name = item.NAME._;
        else if (item.$ && item.$.NAME) name = item.$.NAME;
      }
      const cleanName = name.trim().toLowerCase();
      return cleanName === targetName || cleanName.includes(targetName) || targetName.includes(cleanName);
    });

    const barcodes = [];
    if (matchedItem && matchedItem['BATCHALLOCATIONS.LIST']) {
      const rawAllocations = matchedItem['BATCHALLOCATIONS.LIST'];
      const allocations = Array.isArray(rawAllocations) ? rawAllocations : [rawAllocations];

      // Fetch active barcodes from MongoDB
      const Barcode = require('../models/Barcode');
      const activeBcs = await Barcode.find({ status: 'Active' }).select('barcode');
      const activeBcSet = new Set(activeBcs.map(b => b.barcode));

      allocations.forEach(alloc => {
        let godownName = '';
        if (alloc.GODOWNNAME) {
          godownName = typeof alloc.GODOWNNAME === 'object' ? alloc.GODOWNNAME._ : alloc.GODOWNNAME;
        }
        let batchName = '';
        if (alloc.BATCHNAME) {
          batchName = typeof alloc.BATCHNAME === 'object' ? alloc.BATCHNAME._ : alloc.BATCHNAME;
        }

        if (godownName && godownName.trim().toLowerCase() === 'gokul shirgaon' && batchName && batchName.trim()) {
          const bcStr = batchName.trim();
          // Check if barcode is already Active/Dispatched in MongoDB
          if (!activeBcSet.has(bcStr)) {
            barcodes.push({
              barcode: bcStr,
              materialName: materialName,
              status: 'Active'
            });
          }
        }
      });
    }

    res.json({ barcodes });
  } catch (error) {
    console.error('getStoreAvailableBarcodes from Tally error:', error);
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
        const { invoiceUrl, invoiceNumber } = req.body;
        if (!invoiceUrl && !invoiceNumber) {
          return res.status(400).json({ message: 'Invoice number or URL is required for approval.' });
        }

        const resolvedInvoiceNumber = invoiceNumber || closeReq.documentNumber;

        closeReq.status = 'approved';
        if (invoiceUrl) closeReq.invoiceUrl = invoiceUrl;
        if (invoiceNumber) closeReq.documentNumber = invoiceNumber;
        closeReq.approvedBy = req.user._id;
        closeReq.approvedAt = new Date();

        bc.status = 'Closed';
        bc.closeRequest.status = 'approved';

        const docName = `Invoice-${resolvedInvoiceNumber}`;
        bc.documents.push({
          name: docName,
          url: invoiceUrl || 'N/A',
          type: 'Invoice',
          size: 0
        });

        bc.history.push({
          action: 'Closed',
          user: req.user._id,
          remarks: `Accounts registered invoice and closed RDC, converting to Invoice (${resolvedInvoiceNumber})`
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
            url: invoiceUrl || 'N/A',
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
            remarks: `Barcode ${bc.barcode} closed via Accounts approval for Invoice (${resolvedInvoiceNumber})`,
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

/**
 * Create Exchange Request
 */
exports.createExchangeRequest = async (req, res) => {
  try {
    const { oldBarcode, warrantyReason } = req.body;
    const normalizedOld = oldBarcode ? oldBarcode.trim().toUpperCase() : '';

    if (!normalizedOld || !warrantyReason) {
      return res.status(400).json({ message: 'All fields (oldBarcode, warrantyReason) are required.' });
    }

    const oldBc = await Barcode.findOne({ barcode: normalizedOld });
    if (!oldBc) return res.status(404).json({ message: 'Old barcode not found.' });
    if (oldBc.status !== 'Active') return res.status(400).json({ message: 'Only active barcodes can be exchanged.' });

    // Verify ownership
    if (oldBc.owner?.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You are not the owner of this barcode.' });
    }

    const ExchangeRequest = require('../models/ExchangeRequest');
    // Check if there is already a pending exchange request for this old barcode
    const activeExchange = await ExchangeRequest.findOne({ oldBarcode: normalizedOld, status: 'pending' });
    if (activeExchange) {
      return res.status(400).json({ message: 'An exchange request is already pending for this barcode.' });
    }

    const exchangeReq = await ExchangeRequest.create({
      transactionId: oldBc.transactionId,
      oldBarcode: normalizedOld,
      materialName: oldBc.materialName,
      requester: req.user._id,
      warrantyReason,
      status: 'pending',
    });

    oldBc.history.push({
      action: 'Exchange Requested',
      user: req.user._id,
      remarks: `Exchange requested. Warranty reason: ${warrantyReason}`,
    });
    await oldBc.save();

    res.json({ message: 'Exchange request submitted successfully.', data: exchangeReq });
  } catch (error) {
    console.error('Create exchange request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get Pending Exchange Requests
 */
exports.getPendingExchangeRequests = async (req, res) => {
  try {
    const ExchangeRequest = require('../models/ExchangeRequest');
    const requests = await ExchangeRequest.find({ status: 'pending' }).populate('requester');
    res.json({ data: requests });
  } catch (error) {
    console.error('Get pending exchange requests error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Handle Exchange Request response
 */
exports.handleExchangeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, reason } = req.body; // 'accept' or 'reject'

    const ExchangeRequest = require('../models/ExchangeRequest');
    const exchangeReq = await ExchangeRequest.findById(requestId);
    if (!exchangeReq) return res.status(404).json({ message: 'Exchange request not found.' });
    if (exchangeReq.status !== 'pending') return res.status(400).json({ message: 'Request is already processed.' });

    const oldBc = await Barcode.findOne({ barcode: exchangeReq.oldBarcode });
    if (!oldBc) return res.status(404).json({ message: 'Old barcode not found.' });

    const User = require('../models/User');
    const requesterUser = await User.findById(exchangeReq.requester);
    if (!requesterUser) return res.status(404).json({ message: 'Requester user not found.' });

    if (action === 'accept') {
      const { newBarcode } = req.body;
      if (!newBarcode || !newBarcode.trim()) {
        return res.status(400).json({ message: 'New barcode ID is required for exchange completion.' });
      }
      const normalizedNew = newBarcode.trim().toUpperCase();
      const existingNew = await Barcode.findOne({ barcode: normalizedNew });
      if (existingNew) {
        return res.status(400).json({ message: 'New barcode ID is already registered in the system.' });
      }

      exchangeReq.status = 'approved';
      exchangeReq.newBarcode = normalizedNew;
      exchangeReq.approvedBy = req.user._id;
      exchangeReq.approvedAt = new Date();

      // 1. Mark old barcode status to 'Exchanged'
      oldBc.status = 'Exchanged';
      oldBc.history.push({
        action: 'Exchanged',
        user: req.user._id,
        remarks: `Exchanged for new barcode ${normalizedNew}. Warranty reason accepted.`,
        timestamp: new Date()
      });
      oldBc.history.push({
        action: 'Barcode Exchanged',
        remarks: `Barcode ${exchangeReq.oldBarcode} exchanged with new barcode ${normalizedNew} under warranty.`,
        user: req.user._id,
        timestamp: new Date()
      });
      await oldBc.save();

      // Keep old barcode and add new barcode in original transaction materials
      const Transaction = require('../models/Transaction');
      const originalTxn = await Transaction.findOne({ transactionId: exchangeReq.transactionId });
      if (originalTxn) {
        const docTypeUpper = (originalTxn.documentType || '').toUpperCase();
        if (docTypeUpper.includes('INVOICE')) {
          exchangeReq.newDocumentType = 'Invoice';
        } else {
          exchangeReq.newDocumentType = 'DC';
        }

        originalTxn.materials = originalTxn.materials.map(mat => {
          if (mat.barcodes) {
            const containsOld = mat.barcodes.some(b => {
              const bStr = typeof b === 'string' ? b : (b.barcode || b._id?.toString());
              return bStr === exchangeReq.oldBarcode;
            });

            if (containsOld) {
              // Mark old entry status as Exchanged
              mat.barcodes = mat.barcodes.map(b => {
                const bStr = typeof b === 'string' ? b : (b.barcode || b._id?.toString());
                if (bStr === exchangeReq.oldBarcode) {
                  if (typeof b === 'object') {
                    b.status = 'Exchanged';
                  }
                }
                return b;
              });

              // Add new barcode entry
              mat.barcodes.push({
                barcode: normalizedNew,
                status: 'Active',
                owner: exchangeReq.requester
              });

              // Increment material quantity and transaction totalItems
              mat.quantity = (mat.quantity || 0) + 1;
              originalTxn.totalItems = (originalTxn.totalItems || 0) + 1;
            }
          }
          return mat;
        });

        // Add timeline entry to original transaction
        originalTxn.timeline.push({
          action: 'Barcode Exchanged',
          description: `Barcode ${exchangeReq.oldBarcode} exchanged with new barcode ${normalizedNew} under warranty.`,
          user: req.user._id,
          timestamp: new Date()
        });
        await originalTxn.save();
      }

      // 2. Create the new barcode document as Active in Barcode collection
      await Barcode.create({
        barcode: normalizedNew,
        transactionId: exchangeReq.transactionId,
        transaction: oldBc.transaction,
        materialName: oldBc.materialName,
        status: 'Active',
        owner: exchangeReq.requester,
        ownerDepartment: oldBc.ownerDepartment || requesterUser.department,
        isSplit: false,
        ownershipHistory: [{
          user: exchangeReq.requester,
          department: oldBc.ownerDepartment || requesterUser.department,
          action: 'received',
          remarks: `Ownership activated via exchange replacement under transaction ${exchangeReq.transactionId}`
        }],
        history: [{
          action: 'Exchange Child Created',
          user: req.user._id,
          remarks: `Created from exchange approval. Replaced old barcode ${exchangeReq.oldBarcode}`,
          timestamp: new Date()
        }, {
          action: 'Barcode Exchanged',
          remarks: `Barcode ${exchangeReq.oldBarcode} exchanged with new barcode ${normalizedNew} under warranty.`,
          user: req.user._id,
          timestamp: new Date()
        }]
      });

      // Notify requester
      await createNotification(
        exchangeReq.requester,
        'exchange_approved',
        'Exchange Request Approved',
        `Store approved exchange for ${exchangeReq.oldBarcode}. New barcode ${normalizedNew} is now active.`,
        exchangeReq.transactionId,
        normalizedNew
      );
    } else if (action === 'reject') {
      exchangeReq.status = 'rejected';
      
      oldBc.history.push({
        action: 'Exchange Rejected',
        user: req.user._id,
        remarks: `Exchange request rejected by store. Reason: ${reason || 'No reason specified'}`,
      });
      await oldBc.save();

      // Notify requester
      await createNotification(
        exchangeReq.requester,
        'exchange_rejected',
        'Exchange Request Rejected',
        `Store rejected exchange for ${exchangeReq.oldBarcode}. Reason: ${reason || 'No reason specified'}`,
        exchangeReq.transactionId,
        exchangeReq.oldBarcode
      );
    } else {
      return res.status(400).json({ message: 'Invalid action.' });
    }

    await exchangeReq.save();
    const Transaction = require('../models/Transaction');
    const originalTxn = await Transaction.findOne({ transactionId: exchangeReq.transactionId });
    res.json({ 
      message: `Exchange request successfully processed.`, 
      data: exchangeReq,
      transactionDbId: originalTxn ? originalTxn._id : null
    });
  } catch (error) {
    console.error('Handle exchange request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getExchangeRequestsByTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const ExchangeRequest = require('../models/ExchangeRequest');
    const requests = await ExchangeRequest.find({ transactionId })
      .populate('requester', 'fullName employeeId department')
      .populate('approvedBy', 'fullName employeeId');
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching transaction exchange requests:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
