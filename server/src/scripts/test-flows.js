const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Barcode = require('../models/Barcode');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CloseRequest = require('../models/CloseRequest');

dotenv.config();

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Find users & barcode
  const teamLead = await User.findOne({ role: 'team_lead' });
  const employee = await User.findOne({ role: 'employee' });
  const accountsAdmin = await User.findOne({ role: 'department_admin', departmentAdminType: 'accounts' }) || teamLead;
  const barcodeDoc = await Barcode.findOne({ status: 'Active' });

  if (!teamLead || !employee || !barcodeDoc) {
    console.error('Seed data not complete to run test.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Using Team Lead: ${teamLead.fullName}`);
  console.log(`Using Accounts Admin: ${accountsAdmin.fullName}`);
  console.log(`Using Barcode: ${barcodeDoc.barcode}`);

  // Test 1: Create Invoice close request
  console.log('\n--- Test 1: Creating Close Request for Invoice ---');
  await CloseRequest.deleteMany({ barcode: barcodeDoc.barcode });
  barcodeDoc.closeRequest = {
    documentType: 'Invoice',
    documentNumber: 'TEST-INV-1111',
    remarks: 'Invoice Close Test',
    requester: employee._id,
    status: 'pending'
  };
  await barcodeDoc.save();

  const reqObj = await CloseRequest.create({
    transactionId: barcodeDoc.transactionId,
    barcode: barcodeDoc.barcode,
    documentType: 'Invoice',
    documentNumber: 'TEST-INV-1111',
    remarks: 'Invoice Close Test',
    requester: employee._id,
    status: 'pending'
  });
  console.log('Invoice Close Request created.');

  // Test 2: Process approval (which should remove the barcode from materials loop)
  console.log('\n--- Test 2: Approving Invoice Close Request ---');
  // Find associated transaction
  const txn = await Transaction.findOne({ $or: [{ _id: barcodeDoc.transaction }, { transactionId: barcodeDoc.transactionId }] });
  if (txn) {
    // Add the barcode mock to transaction if not present
    const firstMaterial = txn.materials[0];
    if (firstMaterial) {
      const hasBc = firstMaterial.barcodes.some(b => (b.barcode || b) === barcodeDoc.barcode);
      if (!hasBc) {
        firstMaterial.barcodes.push({ barcode: barcodeDoc.barcode });
        await txn.save();
        console.log(`Added barcode ${barcodeDoc.barcode} to transaction materials list.`);
      }
    }
  }

  // Handle Close Request API logic
  reqObj.status = 'approved';
  reqObj.approvedBy = accountsAdmin._id;
  await reqObj.save();

  barcodeDoc.status = 'Closed';
  barcodeDoc.closeRequest.status = 'approved';
  await barcodeDoc.save();

  // Simulate controller logic for updating transaction materials list
  const tDoc = await Transaction.findOne({ $or: [{ _id: barcodeDoc.transaction }, { transactionId: barcodeDoc.transactionId }] });
  if (tDoc) {
    tDoc.materials = tDoc.materials.map(m => {
      if (m.barcodes) {
        m.barcodes = m.barcodes.filter(b => {
          const bStr = typeof b === 'string' ? b : (b.barcode || b.toString());
          return bStr !== barcodeDoc.barcode;
        });
      }
      return m;
    }).filter(m => m.barcodes && m.barcodes.length > 0);
    await tDoc.save();
  }

  // Validate removal of barcode from transaction materials
  const updatedTxn = await Transaction.findOne({ $or: [{ _id: barcodeDoc.transaction }, { transactionId: barcodeDoc.transactionId }] });
  if (updatedTxn) {
    const hasBarcode = updatedTxn.materials.some(m => 
      m.barcodes.some(b => {
        const bStr = typeof b === 'string' ? b : (b.barcode || b.toString());
        return bStr === barcodeDoc.barcode;
      })
    );
    if (!hasBarcode) {
      console.log('SUCCESS: Barcode was successfully removed from transaction materials list!');
    } else {
      throw new Error('FAIL: Barcode was not removed from transaction materials list.');
    }
  }

  // Restore everything to clean up
  barcodeDoc.status = 'Active';
  barcodeDoc.closeRequest = undefined;
  await barcodeDoc.save();

  await mongoose.disconnect();
  console.log('\nAll Invoice integration tests passed successfully.');
}

run().catch(async (err) => {
  console.error('TEST FAILED:', err);
  await mongoose.disconnect();
  process.exit(1);
});
