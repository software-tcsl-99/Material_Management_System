const mongoose = require('mongoose');

const exchangeRequestSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true },
    oldBarcode: { type: String, required: true },
    newBarcode: { type: String },
    materialName: { type: String, required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    warrantyReason: { type: String, required: true }, // Warranty/Failure reasons
    newDocumentType: { type: String, enum: ['DC', 'Invoice'] },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    returnStatus: {
      type: String,
      enum: ['none', 'returned_to_store', 'accepted_by_store'],
      default: 'none',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExchangeRequest', exchangeRequestSchema);
