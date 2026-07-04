const mongoose = require('mongoose');

const closeRequestSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true },
    barcode: { type: String, required: true },
    documentType: { type: String, required: true }, // 'DC Internal' or 'DC FOC'
    documentNumber: { type: String, required: true },
    remarks: { type: String, default: '' },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CloseRequest', closeRequestSchema);
