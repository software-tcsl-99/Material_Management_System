const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'request_created',
        'request_approved',
        'request_rejected',
        'request_cancelled',
        'request_escalated',
        'store_accepted',
        'handler_assigned',
        'material_dispatched',
        'material_received',
        'transfer_initiated',
        'transfer_accepted',
        'transfer_rejected',
        'return_initiated',
        'return_accepted',
        'split_initiated',
        'split_approved',
        'split_rejected',
        'loop_closed',
        'transaction_closed',
        'chat_message',
        'mention',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    transactionId: { type: String },
    barcodeId: { type: String },
    actionUrl: { type: String, default: '' },
    read: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
