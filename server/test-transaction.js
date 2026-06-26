require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Transaction = require('./src/models/Transaction');

const testTxnId = '6a3ce1aa9921cd7154b0c169';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/material-management');
    console.log('Connected to MongoDB');

    const txn = await Transaction.findById(testTxnId).populate('sender receiver');
    console.log('Transaction found:', txn ? 'yes' : 'no');
    if (txn) {
      console.log('txn.photos:', txn.photos);
      console.log('txn.documentPhotos:', txn.documentPhotos);
      console.log('txn.materials:', txn.materials);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
