const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  metadata: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    address: String,
    date: String,
    time: String,
    device: String,
    employeeName: String,
    capturedAt: Date,
  },
});

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0 },
  qty: { type: Number, default: 0, min: 0 },
  unit: { type: String, required: true, trim: true },
  price: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0 },
  barcode: { type: String, default: '' },
  photos: [photoSchema],
});

const versionSchema = new mongoose.Schema({
  data: { type: mongoose.Schema.Types.Mixed },
  modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  modifiedAt: { type: Date, default: Date.now },
  action: { type: String },
});

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    otherReceiverName: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'accepted', 'rejected', 'completed', 'submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'cancelled', 'closed'],
      default: 'submitted',
      index: true,
    },
    documentType: {
      type: String,
      enum: ['DC', 'RDC', 'Invoice', 'Emergency Send'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    dueDate: { type: Date },
    escalated: { type: Boolean, default: false },
    crossDepartment: { type: Boolean, default: false },
    costCenter: { type: String, default: '' },
    rdcStatus: {
      type: String,
      enum: ['draft', 'posted', 'matched', 'discrepant'],
      default: 'draft',
    },
    invoiceNumber: { type: String, default: '' },
    invoiceDate: { type: Date },
    invoiceTotal: { type: Number, default: 0 },
    invoiceMatchStatus: {
      type: String,
      enum: ['matched', 'discrepant', 'pending'],
      default: 'pending',
    },
    dcType: {
      type: String,
      enum: ['DC-Internal', 'DC-FOC'],
      default: 'DC-Internal',
    },
    approvalChain: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: String,
        action: String, // 'approved', 'rejected'
        timestamp: { type: Date, default: Date.now },
        remarks: String,
      }
    ],
    documentNumber: { type: String, default: '' },
    expectedReturnDate: { type: Date },
    description: { type: String, default: '' },
    remarks: { type: String, default: '' },
    senderGeo: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      address: String,
    },
    senderDevice: {
      browser: String,
      os: String,
      device: String,
    },
    materials: [materialSchema],
    photos: [photoSchema],
    documentPhotos: [photoSchema],
    approvalScreenshot: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    versions: [versionSchema],
    grandTotal: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Auto generate transaction ID
transactionSchema.pre('save', async function (next) {
  if (!this.transactionId) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const count = await mongoose.model('Transaction').countDocuments({
      createdAt: { $gte: startOfDay },
    });
    this.transactionId = `TXN-${dateStr}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
