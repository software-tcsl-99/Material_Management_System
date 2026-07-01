const mongoose = require('mongoose');

const barcodeChatSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BarcodeChat', barcodeChatSchema);
