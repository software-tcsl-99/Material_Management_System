const TransactionChat = require('../models/TransactionChat');
const Transaction = require('../models/Transaction');
const { emitToTransaction } = require('../config/socket');

/**
 * Get chat messages for a transaction
 */
exports.getMessages = async (req, res) => {
  try {
    const { transactionId } = req.params;

    // Verify user is a chat member
    const txn = await Transaction.findOne({ transactionId });
    if (!txn) return res.status(404).json({ message: 'Transaction not found.' });

    if (txn.chatLocked) {
      // Still allow reading, just mark as locked
    }

    let isMember =
      txn.chatMembers.some((m) => m.toString() === req.user._id.toString()) ||
      req.user.role === 'super_admin' ||
      txn.requester.toString() === req.user._id.toString() ||
      txn.teamLead?.toString() === req.user._id.toString() ||
      txn.handler?.toString() === req.user._id.toString() ||
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store') ||
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management');

    if (!isMember) {
      const Barcode = require('../models/Barcode');
      const hasBarcodeAccess = await Barcode.findOne({
        transactionId,
        $or: [
          { owner: req.user._id },
          { 'ownershipHistory.user': req.user._id },
          { 'history.user': req.user._id }
        ]
      });
      if (hasBarcodeAccess) {
        isMember = true;
      }
    }

    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat.' });
    }

    const messages = await TransactionChat.find({ transactionId })
      .populate('sender', 'fullName employeeId profilePhoto role')
      .sort({ createdAt: 1 });

    res.json({ messages, chatLocked: txn.chatLocked, members: txn.chatMembers });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Send chat message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { message, attachments } = req.body;

    if (!message && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: 'Message or attachment is required.' });
    }

    const txn = await Transaction.findOne({ transactionId });
    if (!txn) return res.status(404).json({ message: 'Transaction not found.' });

    if (txn.chatLocked) {
      return res.status(403).json({ message: 'Chat is locked. Transaction is closed.' });
    }

    let isMember =
      txn.chatMembers.some((m) => m.toString() === req.user._id.toString()) ||
      req.user.role === 'super_admin' ||
      txn.requester.toString() === req.user._id.toString() ||
      txn.teamLead?.toString() === req.user._id.toString() ||
      txn.handler?.toString() === req.user._id.toString() ||
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'store') ||
      (req.user.role === 'department_admin' && req.user.departmentAdminType === 'management');

    if (!isMember) {
      const Barcode = require('../models/Barcode');
      const hasBarcodeAccess = await Barcode.findOne({
        transactionId,
        $or: [
          { owner: req.user._id },
          { 'ownershipHistory.user': req.user._id },
          { 'history.user': req.user._id }
        ]
      });
      if (hasBarcodeAccess) {
        isMember = true;
      }
    }

    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat.' });
    }

    const chatMsg = await TransactionChat.create({
      transactionId,
      sender: req.user._id,
      message: message || '',
      attachments: attachments || [],
    });

    await chatMsg.populate('sender', 'fullName employeeId profilePhoto role');

    // Emit to transaction room
    emitToTransaction(transactionId, 'chat_message', chatMsg);

    res.status(201).json({ message: 'Message sent.', chatMessage: chatMsg });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Get chat members
 */
exports.getChatMembers = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const txn = await Transaction.findOne({ transactionId })
      .populate('chatMembers', 'fullName employeeId profilePhoto role department');

    if (!txn) return res.status(404).json({ message: 'Transaction not found.' });

    res.json({ members: txn.chatMembers, chatLocked: txn.chatLocked });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
