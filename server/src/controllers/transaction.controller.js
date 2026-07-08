const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Barcode = require('../models/Barcode');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const TransactionChat = require('../models/TransactionChat');
const { emitToUser, emitToTransaction } = require('../config/socket');

// Helper to prevent CastError when matching mixed transactionId string vs ObjectId
const getQueryByIdOrTxnId = (id) => {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ transactionId: id }, { _id: id }] }
    : { transactionId: id };
};

// Helper: create notification and emit via socket
const createNotification = async (userId, type, title, message, transactionId) => {
  const notif = await Notification.create({ user: userId, type, title, message, transactionId });
  emitToUser(userId.toString(), 'notification', notif);
  return notif;
};

// Helper: add timeline entry
const addTimeline = (transaction, action, description, userId, metadata = {}) => {
  transaction.timeline.push({ action, description, user: userId, metadata });
};

/**
 * Create a new material request
 */
exports.createTransaction = async (req, res) => {
  try {
    const {
      materials,
      description,
      priority,
      dueDate,
      documentType,
      remarks,
      teamLeadId,
      managementApproverId,
      storeId,
      isSimplified
    } = req.body;

    if (!materials || materials.length === 0) {
      return res.status(400).json({ message: 'At least one material is required.' });
    }

    if (!dueDate) {
      return res.status(400).json({ message: 'Expected return date is required.' });
    }

    if (!isSimplified) {
      // Validate each material has barcodes matching quantity
      for (const mat of materials) {
        if (!mat.name || !mat.quantity || mat.quantity < 1) {
          return res.status(400).json({ message: 'Each material needs a name and quantity >= 1.' });
        }
        if (!mat.barcodes || mat.barcodes.length !== mat.quantity) {
          return res.status(400).json({
            message: `Material "${mat.name}" requires ${mat.quantity} barcode(s). Got ${mat.barcodes?.length || 0}.`,
          });
        }
      }

      // Check for duplicate barcodes
      const allBarcodes = materials.flatMap((m) => m.barcodes.map((b) => b.barcode));
      const uniqueBarcodes = new Set(allBarcodes);
      if (uniqueBarcodes.size !== allBarcodes.length) {
        return res.status(400).json({ message: 'Duplicate barcodes found.' });
      }

      // Check if any barcode already exists
      const existingBarcodes = await Barcode.find({ barcode: { $in: allBarcodes } });
      if (existingBarcodes.length > 0) {
        return res.status(400).json({
          message: `Barcode(s) already exist: ${existingBarcodes.map((b) => b.barcode).join(', ')}`,
        });
      }
    } else {
      // For simplified form, just check name and quantity
      for (const mat of materials) {
        if (!mat.name || !mat.quantity || mat.quantity < 1) {
          return res.status(400).json({ message: 'Each material needs a name and quantity >= 1.' });
        }
      }
    }

    // Calculate total items
    const totalItems = materials.reduce((sum, m) => sum + m.quantity, 0);

    // Determine initial status based on requester role
    let initialStatus = 'submitted';
    const isBypassed = req.user.role === 'team_lead' || req.user.role === 'department_admin';
    if (isBypassed) {
      initialStatus = 'tl_approved';
    }

    let finalTLId = teamLeadId || null;
    if (!finalTLId && !isBypassed) {
      const User = require('../models/User');
      const deptTL = await User.findOne({
        department: req.user.department._id || req.user.department,
        role: 'team_lead',
        status: 'active'
      });
      if (deptTL) {
        finalTLId = deptTL._id;
      }
    }

    const transaction = await Transaction.create({
      requester: req.user._id,
      department: req.user.department._id || req.user.department,
      teamLead: isBypassed ? null : finalTLId,
      managementApprover: managementApproverId || null,
      store: storeId || null,
      status: initialStatus,
      documentType: documentType || 'RDC',
      priority: priority || 'medium',
      dueDate,
      description,
      remarks,
      materials: materials.map((m) => ({
        name: m.name,
        description: m.description || '',
        quantity: m.quantity,
        unit: m.unit || 'pcs',
        barcodes: isSimplified ? [] : m.barcodes.map((b) => ({
          barcode: b.barcode,
          status: 'Active',
          owner: req.user._id,
        })),
      })),
      totalItems,
      activeItems: isSimplified ? 0 : totalItems,
      chatMembers: [
        req.user._id,
        ...((teamLeadId && !isBypassed) ? [teamLeadId] : []),
        ...(managementApproverId ? [managementApproverId] : []),
        ...(storeId ? [storeId] : [])
      ],
      timeline: [
        {
          action: 'Request Created',
          description: `${req.user.fullName} created material request`,
          user: req.user._id,
        },
      ],
    });

    if (!isSimplified) {
      // Create barcode documents
      for (const mat of materials) {
        for (const bc of mat.barcodes) {
          await Barcode.create({
            barcode: bc.barcode,
            transactionId: transaction.transactionId,
            transaction: transaction._id,
            materialName: mat.name,
            status: 'Active',
            owner: req.user._id,
            ownerDepartment: req.user.department._id || req.user.department,
            ownershipHistory: [
              {
                user: req.user._id,
                department: req.user.department._id || req.user.department,
                action: 'created',
                remarks: 'Initial creation with request',
              },
            ],
            history: [
              {
                action: 'Request Created',
                user: req.user._id,
                remarks: `Created in transaction ${transaction.transactionId}`,
              },
            ],
          });
        }
      }
    }

    // Notify team lead or next in line
    if (finalTLId) {
      await createNotification(
        finalTLId,
        'request_created',
        'New Material Request',
        `New request ${transaction.transactionId} created by ${req.user.fullName}`,
        transaction.transactionId
      );
    } else if (managementApproverId) {
      await createNotification(
        managementApproverId,
        'request_created',
        'New Material Request',
        `New request ${transaction.transactionId} created by ${req.user.fullName}`,
        transaction.transactionId
      );
    }

    // Audit log
    await AuditLog.create({
      action: 'CREATE',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Created transaction ${transaction.transactionId} with ${totalItems} items`,
    });

    await transaction.populate([
      { path: 'requester', select: 'fullName employeeId email role department' },
      { path: 'department', select: 'name' },
      { path: 'teamLead', select: 'fullName employeeId' },
    ]);

    res.status(201).json({ message: 'Transaction created successfully.', transaction });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Server error creating transaction.' });
  }
};

/**
 * Get all transactions (role-filtered)
 */
exports.getTransactions = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === 'employee') {
      const Barcode = require('../models/Barcode');
      const userBarcodes = await Barcode.find({ owner: req.user._id });
      const txnIds = userBarcodes.map(b => b.transactionId);

      // Find active return requests where the user is the return handler
      const ReturnModel = require('../models/Return');
      const activeReturns = await ReturnModel.find({
        returnHandler: req.user._id,
        status: { $in: ['handler_assigned', 'collected'] }
      });
      const activeReturnTxnIds = activeReturns.map(r => r.transactionId);

      filter.$or = [
        { requester: req.user._id },
        // For dispatch handler, only show if delivery is still active/in-progress
        { handler: req.user._id, status: { $in: ['store_accepted', 'handler_assigned', 'dispatched'] } },
        // For pending handler transfer targets
        { 'pendingHandlerTransfer.toHandler': req.user._id, 'pendingHandlerTransfer.status': 'pending' },
        { transactionId: { $in: [...txnIds, ...activeReturnTxnIds] } }
      ];
    } else if (req.user.role === 'team_lead') {
      filter.$or = [
        { requester: req.user._id },
        { teamLead: req.user._id },
        { department: req.user.department._id || req.user.department },
      ];
    } else if (req.user.role === 'department_admin') {
      if (req.user.departmentAdminType === 'store') {
        // Store only sees requests after management approved (exclude submitted & tl_approved)
        filter.status = { $nin: ['submitted', 'tl_approved'] };
      } else if (req.user.departmentAdminType === 'management') {
        // Management only sees requests after TL approved (exclude submitted)
        filter.status = { $ne: 'submitted' };
        filter.managementApprover = req.user._id;
      } else if (req.user.departmentAdminType === 'accounts') {
        // Accounts see all
        // No filter - sees all
      } else {
        filter.$or = [
          { requester: req.user._id },
          { department: req.user.department._id || req.user.department },
        ];
      }
    }
    // super_admin sees all — no filter

    if (req.user.role !== 'super_admin') {
      const orConditions = [
        { status: { $ne: 'rejected' } },
        { requester: req.user._id },
        { teamLead: req.user._id },
        { managementApprover: req.user._id },
        { handler: req.user._id },
        { store: req.user._id }
      ];
      if (req.user.role === 'department_admin' && (req.user.departmentAdminType === 'store' || req.user.department?.name?.toLowerCase()?.includes('store'))) {
        orConditions.push({ status: 'rejected' });
      }
      const rejectedVisibility = { $or: orConditions };
      if (filter.$and) {
        filter.$and.push(rejectedVisibility);
      } else {
        filter.$and = [rejectedVisibility];
      }
    }

    if (status && status !== 'all') {
      if (status === 'in_progress') {
        filter.status = { $in: ['submitted', 'tl_approved', 'mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'active', 'partially_returned'] };
      } else if (status === 'pending') {
        filter.status = { $in: ['submitted', 'tl_approved', 'mgt_approved'] };
      } else if (status === 'completed') {
        filter.status = 'closed';
      } else {
        filter.status = status;
      }
    }

    if (search) {
      filter.$or = [
        ...(filter.$or || []),
        { transactionId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const allTransactions = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId email role')
      .populate('department', 'name')
      .populate('teamLead', 'fullName employeeId')
      .populate('handler', 'fullName employeeId')
      .populate('managementApprover', 'fullName employeeId')
      .populate('store', 'fullName employeeId')
      .populate('pendingHandlerTransfer.toHandler', 'fullName employeeId')
      .populate('pendingHandlerTransfer.fromHandler', 'fullName employeeId')
      .sort({ createdAt: -1 });

    let filteredTransactions = allTransactions;
    if (req.user.role === 'employee') {
      const txnIds = filteredTransactions.map(t => t.transactionId);
      const barcodesForTxns = await Barcode.find({ transactionId: { $in: txnIds } });
      const activePostDispatch = ['dispatched', 'received', 'active', 'partially_returned', 'closed', 'completed'];

      // Fetch active returns for the user to keep return handler transactions visible
      const ReturnModel = require('../models/Return');
      const activeReturnsForUser = await ReturnModel.find({
        returnHandler: req.user._id,
        status: { $in: ['handler_assigned', 'collected'] }
      });
      const activeReturnTxnIds = new Set(activeReturnsForUser.map(r => r.transactionId));

      filteredTransactions = filteredTransactions.filter(txn => {
        const isRequester = (txn.requester?._id || txn.requester)?.toString() === req.user._id.toString();
        if (isRequester) {
          return true;
        }

        // Keep if the user is the assigned sourcing handler and delivery is in progress
        const isSourcingHandler = (txn.handler?._id || txn.handler)?.toString() === req.user._id.toString();
        if (isSourcingHandler && ['store_accepted', 'handler_assigned', 'dispatched'].includes(txn.status)) {
          return true;
        }

        // Keep if the user is the return handler for active return requests in this transaction
        if (activeReturnTxnIds.has(txn.transactionId)) {
          return true;
        }

        if (activePostDispatch.includes(txn.status)) {
          const txnBarcodes = barcodesForTxns.filter(b => b.transactionId === txn.transactionId);
          const hasActiveMaterial = txnBarcodes.some(b => 
            (b.owner?._id || b.owner)?.toString() === req.user._id.toString() &&
            ['Active', 'pending_acceptance'].includes(b.status)
          );
          if (!hasActiveMaterial) {
            return false;
          }
        }
        return true;
      });
    }

    const totalFiltered = filteredTransactions.length;
    const paginatedTransactions = filteredTransactions.slice((page - 1) * limit, page * limit);

    res.json({
      data: paginatedTransactions, // Added for frontend compatibility
      transactions: paginatedTransactions,
      pagination: {
        total: totalFiltered,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalFiltered / limit),
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error fetching transactions.' });
  }
};

/**
 * Get single transaction detail
 */
exports.getTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id))
      .populate('requester', 'fullName employeeId email role department designation')
      .populate('department', 'name')
      .populate('teamLead', 'fullName employeeId email')
      .populate('handler', 'fullName employeeId email')
      .populate('managementApprover', 'fullName employeeId email')
      .populate('store', 'fullName employeeId email')
      .populate('approvalChain.user', 'fullName employeeId role')
      .populate('timeline.user', 'fullName employeeId')
      .populate('chatMembers', 'fullName employeeId profilePhoto')
      .populate('materials.barcodes.owner', 'fullName employeeId')
      .populate('pendingHandlerTransfer.toHandler', 'fullName employeeId email')
      .populate('pendingHandlerTransfer.fromHandler', 'fullName employeeId email')
      .populate('pendingHandlerTransfer.requestedBy', 'fullName employeeId');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.status === 'rejected' && req.user.role !== 'super_admin') {
      const userIdStr = req.user._id.toString();
      const isRequester = (transaction.requester?._id || transaction.requester)?.toString() === userIdStr;
      const isTeamLead = (transaction.teamLead?._id || transaction.teamLead)?.toString() === userIdStr;
      const isManagement = (transaction.managementApprover?._id || transaction.managementApprover)?.toString() === userIdStr;
      const isStoreAdmin = req.user.role === 'department_admin' && (req.user.departmentAdminType === 'store' || req.user.department?.name?.toLowerCase()?.includes('store'));
      const isAssignedStore = (transaction.store?._id || transaction.store)?.toString() === userIdStr;
      const isAssignedHandler = (transaction.handler?._id || transaction.handler)?.toString() === userIdStr;
      const isPendingTransferHandler = transaction.pendingHandlerTransfer?.toHandler &&
        (transaction.pendingHandlerTransfer.toHandler._id || transaction.pendingHandlerTransfer.toHandler)?.toString() === userIdStr;

      if (!isRequester && !isTeamLead && !isManagement && !isStoreAdmin && !isAssignedStore && !isAssignedHandler && !isPendingTransferHandler) {
        return res.status(403).json({ message: 'Access denied. You do not have permission to view this rejected transaction.' });
      }
    }

    // Get barcodes for this transaction
    const barcodes = await Barcode.find({ transactionId: transaction.transactionId })
      .populate('owner', 'fullName employeeId department')
      .populate('ownerDepartment', 'name')
      .populate('history.user', 'fullName employeeId')
      .populate('closeRequest.managementApprover', 'fullName employeeId')
      .populate('closeRequest.requester', 'fullName employeeId');

    // Get return requests for this transaction
    const ReturnModel = require('../models/Return');
    const returns = await ReturnModel.find({ transactionId: transaction.transactionId })
      .populate('fromUser', 'fullName employeeId')
      .populate('returnHandler', 'fullName employeeId');

    // Calculate chatLocked dynamically for the current user
    let dynamicChatLocked = transaction.chatLocked;
    const isTeamLead = (transaction.teamLead?._id || transaction.teamLead)?.toString() === req.user._id.toString();
    if (req.user.role === 'employee' && !isTeamLead) {
      const activePostDispatch = ['dispatched', 'received', 'active', 'partially_returned', 'closed', 'completed'];
      if (activePostDispatch.includes(transaction.status)) {
        const hasActiveMaterial = barcodes.some(b => 
          (b.owner?._id || b.owner)?.toString() === req.user._id.toString() &&
          ['Active', 'pending_acceptance'].includes(b.status)
        );

        const hasActiveReturnAssignment = returns.some(r => 
          (r.returnHandler?._id || r.returnHandler)?.toString() === req.user._id.toString() &&
          r.status !== 'completed'
        );

        const isPendingDispatchHandler = (transaction.handler?._id || transaction.handler)?.toString() === req.user._id.toString() &&
          ['store_accepted', 'handler_assigned'].includes(transaction.status);

        if (!hasActiveMaterial && !hasActiveReturnAssignment && !isPendingDispatchHandler) {
          dynamicChatLocked = true;
        }
      }
    }

    const transactionObj = transaction.toObject();
    transactionObj.chatLocked = dynamicChatLocked;

    res.json({
      data: transactionObj,
      transaction: transactionObj,
      barcodes,
      returns
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ message: 'Server error fetching transaction.' });
  }
};

/**
 * Approve transaction (Team Lead / Management)
 */
exports.approveTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id))
      .populate('requester', 'fullName employeeId role department');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    let newStatus;
    let notifyUsers = [];

    if (req.user.role === 'team_lead' && transaction.status === 'submitted') {
      newStatus = 'tl_approved';
      transaction.approvalChain.push({
        user: req.user._id,
        role: 'team_lead',
        action: 'approved',
        remarks,
      });
      addTimeline(transaction, 'Team Lead Approved', `Approved by ${req.user.fullName}`, req.user._id);

      // Check if requester is TL → need management approval
      if (transaction.requester.role === 'team_lead' || transaction.crossDepartment) {
        newStatus = 'tl_approved'; // Still needs management approval
      }
    } else if (
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management') ||
      req.user.role === 'super_admin'
    ) {
      if (transaction.status === 'tl_approved' || transaction.status === 'submitted') {
        newStatus = 'mgt_approved';
        transaction.approvalChain.push({
          user: req.user._id,
          role: 'management',
          action: 'approved',
          remarks,
        });
        addTimeline(transaction, 'Management Approved', `Approved by Management: ${req.user.fullName}`, req.user._id);
      }
    } else if (
      req.user.role === 'department_admin' && req.user.departmentAdminType === 'store'
    ) {
      if (transaction.status === 'mgt_approved') {
        newStatus = 'store_accepted';
        transaction.approvalChain.push({
          user: req.user._id,
          role: 'store',
          action: 'approved',
          remarks,
        });
        addTimeline(transaction, 'Store Accepted', `Accepted by Store: ${req.user.fullName}`, req.user._id);
      }
    } else {
      return res.status(403).json({ message: 'You cannot approve this transaction in its current state.' });
    }

    transaction.status = newStatus;
    await transaction.save();

    // Notify requester
    await createNotification(
      transaction.requester._id,
      'request_approved',
      'Request Approved',
      `Your request ${transaction.transactionId} has been approved`,
      transaction.transactionId
    );

    await AuditLog.create({
      action: 'APPROVE',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Approved transaction ${transaction.transactionId} → ${newStatus}`,
    });

    res.json({ message: 'Transaction approved.', transaction });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Reject transaction — reverts to previous approval phase
 */
exports.rejectTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required.' });
    }

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Determine previous status based on current status
    const previousStatusMap = {
      'submitted': 'rejected',         // TL rejects → rejected permanently
      'tl_approved': 'rejected',       // Management rejects → rejected permanently
      'mgt_approved': 'tl_approved',   // Store rejects → back to tl_approved
      'store_accepted': 'mgt_approved', // Rejection at store accepted → back to mgt_approved
      'handler_assigned': 'store_accepted', // Handler decline handled separately but as fallback
      'dispatched': 'handler_assigned',
    };

    const oldStatus = transaction.status;
    const previousStatus = previousStatusMap[oldStatus] || 'submitted';
    const isPermanentRejection = previousStatus === 'rejected';

    transaction.status = previousStatus;
    transaction.rejectionReason = reason;
    transaction.approvalChain.push({
      user: req.user._id,
      role: req.user.role,
      action: 'rejected',
      remarks: reason,
    });

    const timelineDesc = isPermanentRejection
      ? `Rejected by ${req.user.fullName}: ${reason}.`
      : `Rejected by ${req.user.fullName}: ${reason}. Reverted to ${previousStatus.replace(/_/g, ' ')} stage.`;
    addTimeline(transaction, 'Request Rejected', timelineDesc, req.user._id);

    await transaction.save();

    if (isPermanentRejection) {
      // Cancel all barcodes associated with the transaction
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { status: 'Cancelled' }
      );
    }

    const notifMessage = isPermanentRejection
      ? `Your request ${transaction.transactionId} was rejected by ${req.user.fullName}: ${reason}.`
      : `Your request ${transaction.transactionId} was rejected by ${req.user.fullName}: ${reason}. It has been reverted for re-review.`;

    await createNotification(
      transaction.requester,
      'request_rejected',
      'Request Rejected',
      notifMessage,
      transaction.transactionId
    );

    const auditDesc = isPermanentRejection
      ? `Rejected transaction ${transaction.transactionId}: ${reason}. Status updated from ${oldStatus} to rejected.`
      : `Rejected transaction ${transaction.transactionId}: ${reason}. Status reverted from ${oldStatus} to ${previousStatus}.`;

    await AuditLog.create({
      action: 'REJECT',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: auditDesc,
    });

    const responseMsg = isPermanentRejection
      ? `Transaction rejected successfully.`
      : `Transaction rejected and reverted to ${previousStatus.replace(/_/g, ' ')} stage.`;

    res.json({ message: responseMsg, transaction });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Store accepts transaction
 */
exports.storeAccept = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (!['submitted', 'tl_approved', 'mgt_approved'].includes(transaction.status)) {
      return res.status(400).json({ message: 'Transaction is not ready for store acceptance.' });
    }

    transaction.status = 'store_accepted';
    if (!transaction.chatMembers.includes(req.user._id)) {
      transaction.chatMembers.push(req.user._id);
    }
    addTimeline(transaction, 'Store Accepted', `Store accepted the request. ${req.user.fullName}`, req.user._id);

    await transaction.save();

    await createNotification(
      transaction.requester,
      'store_accepted',
      'Store Accepted',
      `Store has accepted your request ${transaction.transactionId}`,
      transaction.transactionId
    );

    await AuditLog.create({
      action: 'STORE_ACCEPT',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Store accepted transaction ${transaction.transactionId}`,
    });

    res.json({ message: 'Transaction accepted by store.', transaction });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Assign handler
 */
exports.assignHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { handlerId, remarks, expectedDeliveryDate } = req.body;

    if (!handlerId) {
      return res.status(400).json({ message: 'Handler is required.' });
    }

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Check authorization: store admin, super admin, or the current assigned handler
    const isStore = req.user.role === 'super_admin' || (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store');
    const isCurrentHandler = transaction.handler && transaction.handler.toString() === req.user._id.toString();

    if (!isStore && !isCurrentHandler) {
      return res.status(403).json({ message: 'Access denied. You are not authorized to assign handler for this transaction.' });
    }

    const User = require('../models/User');
    const handlerUser = await User.findById(handlerId);
    const handlerName = handlerUser ? handlerUser.fullName : 'Handler';

    // If a handler-to-handler transfer, use two-step pending flow
    if (isCurrentHandler && !isStore) {
      // Check for existing pending transfer
      if (transaction.pendingHandlerTransfer && transaction.pendingHandlerTransfer.status === 'pending') {
        return res.status(400).json({ message: 'There is already a pending handler transfer request. Please wait for it to be resolved or cancel it first.' });
      }

      transaction.pendingHandlerTransfer = {
        toHandler: handlerId,
        fromHandler: req.user._id,
        requestedBy: req.user._id,
        requestedAt: new Date(),
        status: 'pending',
        remarks: remarks || '',
        rejectReason: '',
        resolvedAt: null,
      };

      if (!transaction.chatMembers.includes(handlerId)) {
        transaction.chatMembers.push(handlerId);
      }

      addTimeline(transaction, 'Handler Transfer Requested', `Handler transfer requested to ${handlerName}. Remarks: ${remarks || ''}`, req.user._id, { toHandlerId: handlerId });

      await transaction.save();

      const materialsStr = transaction.materials?.map(m => m.name).join(', ') || 'N/A';
      const barcodes = await Barcode.find({ transactionId: transaction.transactionId });
      const barcodesStr = barcodes.map(b => b.barcode).join(', ') || 'N/A';

      await createNotification(
        handlerId,
        'handler_transfer_request',
        'Handler Transfer Request',
        `You have received a handler assignment request.\n\nTransaction:\n${transaction.transactionId}\n\nMaterial:\n${materialsStr}\n\nBarcode:\n${barcodesStr}\n\nCurrent Handler:\n${req.user.fullName}`,
        transaction.transactionId
      );

      await AuditLog.create({
        action: 'HANDLER_TRANSFER_REQUEST',
        entity: 'Transaction',
        entityId: transaction.transactionId,
        user: req.user._id,
        userName: req.user.fullName,
        description: `Handler transfer requested to ${handlerName} for ${transaction.transactionId}`,
      });

      return res.json({ message: 'Handler transfer request sent. Waiting for acceptance.', transaction, pendingTransfer: true });
    }

    // Store admin / super admin: immediate assignment (existing behavior)
    transaction.handler = handlerId;
    transaction.status = 'handler_assigned';
    transaction.requesterRejected = false;
    transaction.rejectedDeliveryStatus = undefined;
    // Clear any pending transfer
    transaction.pendingHandlerTransfer = undefined;
    if (!transaction.chatMembers.includes(handlerId)) {
      transaction.chatMembers.push(handlerId);
    }

    // Reset barcodes to pending_acceptance
    await Barcode.updateMany(
      { transactionId: transaction.transactionId },
      { status: 'pending_acceptance' }
    );

    addTimeline(transaction, 'Handler Assigned', `Handler Assigned: ${handlerName}. Remarks: ${remarks || ''}`, req.user._id, { handlerId });

    await transaction.save();

    await createNotification(
      handlerId,
      'handler_assigned',
      'Handler Assignment',
      `You have been assigned as handler for ${transaction.transactionId}`,
      transaction.transactionId
    );

    await AuditLog.create({
      action: 'ASSIGN_HANDLER',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Assigned handler for ${transaction.transactionId}`,
    });

    res.json({ message: 'Handler assigned.', transaction });
  } catch (error) {
    console.error('Assign handler error:', error);
    try {
      const fs = require('fs');
      fs.writeFileSync('error.log', 'Assign handler error:\n' + (error.stack || error.message || String(error)));
    } catch (e) {}
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Cancel transaction (only before any approval)
 */
exports.cancelTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.status !== 'submitted' && transaction.status !== 'draft') {
      return res.status(400).json({ message: 'Cannot cancel transaction after approval.' });
    }

    if (transaction.requester.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only the requester can cancel.' });
    }

    transaction.status = 'cancelled';
    addTimeline(transaction, 'Cancelled', `Cancelled by ${req.user.fullName}`, req.user._id);
    transaction.chatLocked = true;

    await transaction.save();

    // Cancel all barcodes
    await Barcode.updateMany(
      { transactionId: transaction.transactionId },
      { status: 'Cancelled' }
    );

    res.json({ message: 'Transaction cancelled.', transaction });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get pending approvals for current user
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const { department, priority, dueToday, escalated } = req.query;
    const filter = {};

    if (req.user.role === 'team_lead') {
      filter.status = 'submitted';
      filter.department = req.user.department._id || req.user.department;
    } else if (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management') {
      filter.status = 'tl_approved';
      filter.managementApprover = req.user._id;
    } else if (req.user.role === 'super_admin') {
      filter.status = { $in: ['submitted', 'tl_approved', 'mgt_approved'] };
    } else {
      return res.json({ approvals: [] });
    }

    if (department) filter.department = department;
    if (priority) filter.priority = priority;
    if (escalated === 'true') filter.escalated = true;
    if (dueToday === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      filter.dueDate = { $gte: today, $lt: tomorrow };
    }

    const approvals = await Transaction.find(filter)
      .populate('requester', 'fullName employeeId department')
      .populate('department', 'name')
      .populate('teamLead', 'fullName')
      .sort({ priority: -1, dueDate: 1, createdAt: -1 });

    res.json({
      data: approvals, // Added for frontend compatibility
      approvals
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Store Action (Accept / Assign Sourcing Handler / Direct Dispatch)
 */
exports.storeAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, handlerId, remarks } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (actionType === 'accept') {
      transaction.status = 'store_accepted';
      addTimeline(transaction, 'Store Accepted', `Store accepted the request. ${remarks || ''}`, req.user._id);
    } else if (actionType === 'assign_handler') {
      if (!handlerId) {
        return res.status(400).json({ message: 'Handler is required.' });
      }
      transaction.handler = handlerId;
      transaction.status = 'handler_assigned';
      transaction.requesterRejected = false;
      transaction.rejectedDeliveryStatus = undefined;
      if (!transaction.chatMembers.includes(handlerId)) {
        transaction.chatMembers.push(handlerId);
      }

      // Reset barcodes to pending_acceptance
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { status: 'pending_acceptance' }
      );

      const User = require('../models/User');
      const handlerUser = await User.findById(handlerId);
      const handlerName = handlerUser ? handlerUser.fullName : 'Handler';
      addTimeline(transaction, 'Handler Assigned', `Handler Assigned: ${handlerName}. Remarks: ${remarks || ''}`, req.user._id, { handlerId });

      await createNotification(
        handlerId,
        'handler_assigned',
        'Handler Assignment',
        `You have been assigned as handler for ${transaction.transactionId}`,
        transaction.transactionId
      );
    } else if (actionType === 'direct_dispatch') {
      transaction.status = 'dispatched';
      addTimeline(transaction, 'Dispatched', `Direct dispatch bypassed handler: ${remarks || ''}`, req.user._id);
    } else if (actionType === 'accept_rejected_return') {
      if (transaction.rejectedDeliveryStatus !== 'sent_to_store') {
        return res.status(400).json({ message: 'Invalid transaction state for store acceptance.' });
      }
      transaction.status = 'rejected';
      transaction.rejectedDeliveryStatus = 'store_accepted';
      addTimeline(transaction, 'Store Accepted Return', `Store accepted returned materials from handler. ${remarks || ''}`, req.user._id);

      // Cancel all barcodes
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { status: 'Cancelled' }
      );
    } else {
      return res.status(400).json({ message: 'Invalid store action type.' });
    }

    await transaction.save();

    await AuditLog.create({
      action: 'STORE_ACTION',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Store action ${actionType} on transaction ${transaction.transactionId}`,
    });

    res.json({ message: 'Store action logged successfully.', transaction });
  } catch (error) {
    console.error('Store action error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Handler Action (pickup / transit confirmation)
 */
exports.handlerAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, remarks } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Extract safe ObjectId values handling both populated and unpopulated states
    const handlerId = transaction.handler?._id || transaction.handler;
    const toHandlerId = transaction.pendingHandlerTransfer?.toHandler?._id || transaction.pendingHandlerTransfer?.toHandler;
    const fromHandlerId = transaction.pendingHandlerTransfer?.fromHandler?._id || transaction.pendingHandlerTransfer?.fromHandler;

    // Authorize: handler, pending toHandler, store admin, or super_admin
    const isStoreAdmin = req.user.role === 'department_admin' && req.user.departmentAdminType === 'store';
    const isAssignedHandler = handlerId && handlerId.toString() === req.user._id.toString();
    const isPendingToHandler = transaction.pendingHandlerTransfer?.status === 'pending' &&
      toHandlerId && toHandlerId.toString() === req.user._id.toString();

    if (req.user.role !== 'super_admin' && !isStoreAdmin && !isAssignedHandler && !isPendingToHandler) {
      return res.status(403).json({ message: 'You are not authorized to perform handler actions for this transaction.' });
    }

    if (actionType === 'dispatch') {
      transaction.status = 'dispatched';
      addTimeline(transaction, 'Dispatched', `Items dispatched to requester. ${remarks || ''}`, req.user._id);
    } else if (actionType === 'collect') {
      transaction.status = 'handler_assigned';
      addTimeline(transaction, 'Handler Accepted', `Handler collected materials from store. ${remarks || ''}`, req.user._id);
    } else if (actionType === 'decline' || actionType === 'reject') {
      transaction.status = 'store_accepted';
      transaction.handler = null;
      addTimeline(transaction, 'Handler Declined', `Sourcing assignment declined by handler. Reason: ${remarks || ''}`, req.user._id);
    } else if (actionType === 'send_to_store') {
      const wasRejected = transaction.timeline?.some(t => 
        t.action?.toLowerCase()?.includes('receipt rejected') || 
        t.action?.toLowerCase()?.includes('request rejected')
      );
      const isValidState = (transaction.status === 'dispatched' && transaction.rejectedDeliveryStatus === 'rejected_by_requester') ||
                           (transaction.status === 'handler_assigned' && wasRejected);

      if (!isValidState) {
        return res.status(400).json({ message: 'Invalid transaction state for sending to store.' });
      }
      transaction.status = 'dispatched';
      transaction.rejectedDeliveryStatus = 'sent_to_store';
      addTimeline(transaction, 'Returned to Store', `Handler returned rejected materials to store. ${remarks || ''}`, req.user._id);
    } else if (actionType === 'accept_transfer') {
      // Handler-2 accepts pending transfer
      if (!transaction.pendingHandlerTransfer || transaction.pendingHandlerTransfer.status !== 'pending') {
        return res.status(400).json({ message: 'No pending handler transfer request found.' });
      }
      if (!toHandlerId || toHandlerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You are not the target of this handler transfer request.' });
      }

      const User = require('../models/User');
      const newHandlerUser = await User.findById(req.user._id);
      const newHandlerName = newHandlerUser ? newHandlerUser.fullName : 'Handler';

      // Transfer ownership
      transaction.handler = req.user._id;
      transaction.pendingHandlerTransfer.status = 'accepted';
      transaction.pendingHandlerTransfer.resolvedAt = new Date();

      // Reset barcodes to pending_acceptance for the new handler
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { status: 'pending_acceptance' }
      );

      addTimeline(transaction, 'Handler Transfer Accepted', `Handler transfer accepted by ${newHandlerName}. ${remarks || ''}`, req.user._id, { fromHandler: fromHandlerId, toHandler: req.user._id });

      // Notify Handler-1
      await createNotification(
        fromHandlerId,
        'handler_transfer_accepted',
        'Handler Transfer Accepted',
        `${newHandlerName} has accepted the handler transfer for ${transaction.transactionId}. You are no longer the handler.`,
        transaction.transactionId
      );
    } else if (actionType === 'reject_transfer') {
      // Handler-2 rejects pending transfer
      if (!transaction.pendingHandlerTransfer || transaction.pendingHandlerTransfer.status !== 'pending') {
        return res.status(400).json({ message: 'No pending handler transfer request found.' });
      }
      if (!toHandlerId || toHandlerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You are not the target of this handler transfer request.' });
      }

      const User = require('../models/User');
      const rejectingUser = await User.findById(req.user._id);
      const rejectingName = rejectingUser ? rejectingUser.fullName : 'Handler';

      transaction.pendingHandlerTransfer.status = 'rejected';
      transaction.pendingHandlerTransfer.rejectReason = remarks || 'No reason provided';
      transaction.pendingHandlerTransfer.resolvedAt = new Date();
      // handler field stays unchanged — Handler-1 retains ownership

      addTimeline(transaction, 'Handler Transfer Rejected', `Handler transfer rejected by ${rejectingName}. Reason: ${remarks || 'No reason provided'}`, req.user._id, { fromHandler: fromHandlerId, toHandler: req.user._id });

      // Notify Handler-1 (fromHandler)
      await createNotification(
        fromHandlerId,
        'handler_transfer_rejected',
        'Handler Assignment Rejected',
        `Handler: ${rejectingName}\nReason: ${remarks || 'No reason provided'}\n\nMaterial returned to your responsibility. Please assign another handler or deliver yourself.`,
        transaction.transactionId
      );

      // Notify Store Admin (if configured)
      if (transaction.store) {
        await createNotification(
          transaction.store,
          'handler_transfer_rejected_store',
          'Handler Transfer Rejected',
          `Handler transfer rejected. Current owner remains ${rejectingUser ? rejectingUser.fullName : 'Handler'}.`,
          transaction.transactionId
        );
      }
    } else if (actionType === 'cancel_transfer') {
      // Handler-1 cancels their own pending transfer
      if (!transaction.pendingHandlerTransfer || transaction.pendingHandlerTransfer.status !== 'pending') {
        return res.status(400).json({ message: 'No pending handler transfer request to cancel.' });
      }
      if (!fromHandlerId || fromHandlerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You are not the initiator of this handler transfer request.' });
      }

      transaction.pendingHandlerTransfer.status = 'cancelled';
      transaction.pendingHandlerTransfer.rejectReason = 'Cancelled by sender';
      transaction.pendingHandlerTransfer.resolvedAt = new Date();

      addTimeline(transaction, 'Handler Transfer Cancelled', `Handler transfer request cancelled by ${req.user.fullName}.`, req.user._id);

      // Notify Handler-2
      await createNotification(
        toHandlerId,
        'handler_transfer_cancelled',
        'Handler Transfer Cancelled',
        `Handler transfer request for ${transaction.transactionId} has been cancelled by ${req.user.fullName}.`,
        transaction.transactionId
      );
    } else {
      return res.status(400).json({ message: 'Invalid handler action type.' });
    }

    await transaction.save();

    await AuditLog.create({
      action: 'HANDLER_ACTION',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Handler action ${actionType} on transaction ${transaction.transactionId}`,
    });

    res.json({ message: 'Handler action logged successfully.', transaction });
  } catch (error) {
    console.error('Handler action error:', error);
    try {
      const fs = require('fs');
      fs.writeFileSync('error.log', 'Handler action error:\n' + (error.stack || error.message || String(error)));
    } catch (e) {}
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

/**
 * Physical Receiving Confirmation & Barcode Inventory Activation
 */
exports.receiveTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { receiverGeo, materialCondition, remarks, photo } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    transaction.status = 'received';
    addTimeline(transaction, 'Received', `Materials received in ${materialCondition} condition. ${remarks || ''}`, req.user._id);
    await transaction.save();

    // Distribute barcodes: Update their owner to the transaction requester, update status to Active, add history
    await Barcode.updateMany(
      { transactionId: transaction.transactionId },
      {
        owner: transaction.requester,
        ownerDepartment: transaction.department,
        status: 'Active'
      }
    );

    // Add history log to each barcode
    const barcodes = await Barcode.find({ transactionId: transaction.transactionId });
    for (const bc of barcodes) {
      bc.history.push({
        action: 'Received',
        user: req.user._id,
        remarks: `Received in transaction ${transaction.transactionId}. GPS & Photo Captured.`,
        timestamp: new Date()
      });
      bc.ownershipHistory.push({
        user: transaction.requester,
        department: transaction.department,
        action: 'received',
        remarks: `Ownership transferred via transaction ${transaction.transactionId}`
      });
      if (photo) {
        bc.photos = bc.photos || [];
        bc.photos.push({ url: photo, uploadedAt: new Date() });
      }
      if (receiverGeo) {
        bc.gps = {
          lat: receiverGeo.lat || 18.5204,
          lng: receiverGeo.lng || 73.8567,
          address: receiverGeo.address || 'MIDC Pune, India'
        };
      }
      await bc.save();
    }

    await AuditLog.create({
      action: 'RECEIVE',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Physically received transaction ${transaction.transactionId}`,
    });

    res.json({ message: 'Transaction received and barcodes activated.', transaction });
  } catch (error) {
    console.error('Receive error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Assign Management Approver for a transaction
 */
exports.assignManagementApprover = async (req, res) => {
  try {
    const { id } = req.params;
    const { managementId } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (!managementId) {
      return res.status(400).json({ message: 'Management approver is required.' });
    }

    const User = require('../models/User');
    const mgtUser = await User.findById(managementId);
    if (!mgtUser || mgtUser.role !== 'department_admin' || mgtUser.departmentAdminType !== 'management') {
      return res.status(400).json({ message: 'Selected user is not a valid management admin.' });
    }

    transaction.managementApprover = managementId;
    if (!transaction.chatMembers.includes(managementId)) {
      transaction.chatMembers.push(managementId);
    }

    addTimeline(transaction, 'Management Assigned', `Management approver assigned: ${mgtUser.fullName}`, req.user._id);
    await transaction.save();

    // Send notification to the assigned management user
    await createNotification(
      managementId,
      'request_created',
      'Management Approval Required',
      `You have been assigned to approve request ${transaction.transactionId}`,
      transaction.transactionId
    );

    res.json({ message: 'Management approver assigned successfully.', transaction });
  } catch (error) {
    console.error('Assign management error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Requester Rejects Material Receipt
 */
exports.rejectReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required.' });
    }

    const hasHandler = !!transaction.handler;

    if (!hasHandler) {
      // Direct dispatch reject -> permanently rejected
      transaction.status = 'rejected';
      transaction.rejectionReason = reason;
      transaction.requesterRejected = true;
      transaction.rejectedDeliveryStatus = 'rejected_by_requester';

      addTimeline(transaction, 'Request Rejected', `Material receipt rejected by requester. Reason: ${reason}. Transaction rejected.`, req.user._id);
      await transaction.save();

      // Cancel barcodes
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { status: 'Cancelled' }
      );

      // Write to audit log
      await AuditLog.create({
        action: 'REJECT_RECEIPT',
        entity: 'Transaction',
        entityId: transaction.transactionId,
        user: req.user._id,
        userName: req.user.fullName,
        description: `Requester rejected material receipt. Reason: ${reason}. Transaction rejected.`,
      });

      return res.json({ message: 'Material receipt rejected and transaction closed.', transaction });
    } else {
      // Handler dispatch reject -> wait for handler to send to store
      transaction.status = 'dispatched';
      transaction.rejectionReason = reason;
      transaction.requesterRejected = true;
      transaction.rejectedDeliveryStatus = 'rejected_by_requester';

      addTimeline(transaction, 'Receipt Rejected', `Material receipt rejected by requester. Reason: ${reason}. Waiting for handler to return materials to store.`, req.user._id);
      await transaction.save();

      // Cancel barcodes
      await Barcode.updateMany(
        { transactionId: transaction.transactionId },
        { status: 'Cancelled' }
      );

      // Write to audit log
      await AuditLog.create({
        action: 'REJECT_RECEIPT',
        entity: 'Transaction',
        entityId: transaction.transactionId,
        user: req.user._id,
        userName: req.user.fullName,
        description: `Requester rejected material receipt. Reason: ${reason}. Waiting for return to store.`,
      });

      return res.json({ message: 'Material receipt rejected. Waiting for handler return to store.', transaction });
    }
  } catch (error) {
    console.error('Reject receipt error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Store dispatches/registers a transaction request (fills barcodes, assigns handler or sends direct)
 */
exports.storeDispatchTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const {
      receiver,
      otherReceiverName,
      documentType,
      documentNumber,
      expectedReturnDate,
      priority,
      costCenter,
      dcType,
      materials,
      dispatchMethod,
      handlerId
    } = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(transactionId));
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });

    // Validate barcodes
    for (const mat of materials) {
      if (!mat.barcodes || mat.barcodes.length !== mat.quantity) {
        return res.status(400).json({
          message: `Material "${mat.name}" requires ${mat.quantity} barcode(s). Got ${mat.barcodes?.length || 0}.`,
        });
      }
    }

    const allBarcodes = materials.flatMap((m) => m.barcodes);
    const uniqueBarcodes = new Set(allBarcodes);
    if (uniqueBarcodes.size !== allBarcodes.length) {
      return res.status(400).json({ message: 'Duplicate barcodes entered.' });
    }

    const existingBarcodes = await Barcode.find({ barcode: { $in: allBarcodes } });
    if (existingBarcodes.length > 0) {
      return res.status(400).json({
        message: `Barcode(s) already exist: ${existingBarcodes.map((b) => b.barcode).join(', ')}`,
      });
    }

    // Save receiver and document details
    transaction.receiver = receiver || undefined;
    transaction.otherReceiverName = otherReceiverName || '';
    transaction.documentType = documentType || 'RDC';
    transaction.documentNumber = documentNumber;
    transaction.expectedReturnDate = expectedReturnDate;
    transaction.priority = priority || 'medium';
    transaction.costCenter = costCenter || '';
    transaction.dcType = dcType || 'DC-Internal';
    if (req.body.photos) {
      transaction.photos = req.body.photos;
    }

    // Update materials array inside transaction
    transaction.materials = materials.map((m) => ({
      name: m.name,
      description: m.description || '',
      quantity: m.quantity,
      unit: m.unit || 'pcs',
      price: m.price || 0,
      barcodes: m.barcodes.map((bcStr) => ({
        barcode: bcStr,
        status: 'Active',
        owner: transaction.requester,
      })),
      photos: m.photos || [],
    }));

    // Register each barcode inside the Barcode collection
    for (const mat of materials) {
      for (const bcStr of mat.barcodes) {
        await Barcode.create({
          barcode: bcStr,
          transactionId: transaction.transactionId,
          transaction: transaction._id,
          materialName: mat.name,
          status: 'Active',
          owner: transaction.requester,
          ownerDepartment: transaction.department,
          ownershipHistory: [
            {
              user: transaction.requester,
              department: transaction.department,
              action: 'created',
              remarks: 'Dispatched from store',
            },
          ],
          history: [
            {
              action: 'Dispatched from Store',
              user: req.user._id,
              remarks: `Registered in transaction ${transaction.transactionId}`,
            },
          ],
        });
      }
    }

    // Determine status and handler based on dispatchMethod
    if (dispatchMethod === 'direct') {
      transaction.status = 'dispatched';
      transaction.handler = null;
      addTimeline(transaction, 'Dispatched', 'Materials dispatched direct to requester', req.user._id);
    } else {
      transaction.status = 'handler_assigned';
      transaction.handler = handlerId;
      const User = require('../models/User');
      const handlerUser = await User.findById(handlerId);
      const handlerName = handlerUser ? handlerUser.fullName : 'Handler';
      addTimeline(transaction, 'Handler Assigned', `Handler Assigned: ${handlerName}. Remarks: Assigned handler for delivery`, req.user._id);
    }

    await transaction.save();

    // Create notifications
    await createNotification(
      transaction.requester,
      'material_dispatched',
      'Materials Dispatched',
      `Your request ${transaction.transactionId} has been dispatched from store.`,
      transaction.transactionId
    );

    if (dispatchMethod === 'handler' && handlerId) {
      await createNotification(
        handlerId,
        'handler_assigned',
        'Handler Job Assigned',
        `You have been assigned to deliver request ${transaction.transactionId}`,
        transaction.transactionId
      );
    }

    await AuditLog.create({
      action: 'DISPATCH',
      entity: 'Transaction',
      entityId: transaction.transactionId,
      user: req.user._id,
      userName: req.user.fullName,
      description: `Dispatched transaction ${transaction.transactionId} via ${dispatchMethod}`,
    });

    res.json({ message: 'Transaction dispatched successfully.', transaction });
  } catch (error) {
    console.error('Store dispatch transaction error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Update transaction (allows editing and resubmitting requests)
 */
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const transaction = await Transaction.findOne(getQueryByIdOrTxnId(id));
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    if (transaction.status === 'rejected') {
      return res.status(400).json({ message: 'Cannot edit a rejected transaction.' });
    }

    if (transaction.requester.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'You are not authorized to edit this transaction.' });
    }

    // Update attributes
    if (updates.receiver !== undefined) transaction.receiver = updates.receiver || undefined;
    if (updates.otherReceiverName !== undefined) transaction.otherReceiverName = updates.otherReceiverName || '';
    if (updates.documentType !== undefined) transaction.documentType = updates.documentType;
    if (updates.documentNumber !== undefined) transaction.documentNumber = updates.documentNumber;
    if (updates.expectedReturnDate !== undefined) transaction.expectedReturnDate = updates.expectedReturnDate;
    if (updates.priority !== undefined) transaction.priority = updates.priority;
    if (updates.costCenter !== undefined) transaction.costCenter = updates.costCenter;
    if (updates.dcType !== undefined) transaction.dcType = updates.dcType;
    if (updates.description !== undefined) transaction.description = updates.description;

    if (updates.materials !== undefined) {
      transaction.materials = updates.materials.map(m => ({
        name: m.name,
        description: m.description || '',
        quantity: m.quantity || m.qty || 1,
        unit: m.unit || 'pcs',
        barcodes: m.barcodes || []
      }));
    }

    // If transaction was rejected, reset status to submitted
    if (transaction.status === 'rejected') {
      transaction.status = 'submitted';
      transaction.rejectionReason = '';
      transaction.approvalChain = [];
      addTimeline(transaction, 'Request Resubmitted', 'Requester edited and resubmitted the rejected request', req.user._id);
    } else {
      addTimeline(transaction, 'Request Updated', 'Requester edited transaction details', req.user._id);
    }

    await transaction.save();
    res.json({ message: 'Transaction updated successfully.', transaction });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ message: 'Server error updating transaction.' });
  }
};
