const mongoose = require('mongoose');

const splitRequestSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true },
    barcode: { type: String, required: true },
    materialName: { type: String, required: true },
    requestedMaterialName: { type: String },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    newBarcode: { type: String },
    newQuantity: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SplitRequest', splitRequestSchema);
