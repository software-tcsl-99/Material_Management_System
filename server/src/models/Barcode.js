const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'Created', 'TL Approved', 'Mgt Approved', 'Dispatched', 'Received', 'Transferred', 'Return Requested', 'Returned'
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  remarks: { type: String, default: '' },
  gps: {
    lat: Number,
    lng: Number,
    address: String,
  },
  photo: { type: String, default: '' }
});

const barcodeSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    materialName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Returned', 'Closed'],
      default: 'Active',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gps: {
      lat: Number,
      lng: Number,
      address: String,
    },
    photos: [
      {
        url: String,
        capturedAt: { type: Date, default: Date.now },
        lat: Number,
        lng: Number,
        address: String,
      }
    ],
    documents: [
      {
        name: String,
        url: String,
        type: String,
        uploadedAt: { type: Date, default: Date.now },
      }
    ],
    history: [historySchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Barcode', barcodeSchema);
