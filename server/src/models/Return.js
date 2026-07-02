const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, index: true },
    barcode: { type: String, required: true, index: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    returnHandler: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'handler_assigned', 'collected', 'store_received', 'completed'],
      default: 'pending',
    },
    reason: { type: String, default: '' },
    condition: { type: String, enum: ['good', 'damaged', 'needs_repair', 'defective'], default: 'good' },
    remarks: { type: String, default: '' },
    gps: {
      lat: Number,
      lng: Number,
      address: String,
    },
    photos: [{ url: String, capturedAt: Date }],
    collectedAt: { type: Date },
    receivedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Return', returnSchema);
