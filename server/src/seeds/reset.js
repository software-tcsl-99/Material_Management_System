require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');
const Transaction = require('../models/Transaction');
const InternalReceipt = require('../models/InternalReceipt');
const ExternalReceipt = require('../models/ExternalReceipt');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ActivityLog = require('../models/ActivityLog');
const Barcode = require('../models/Barcode');
const BarcodeChat = require('../models/BarcodeChat');

// ── Reset: wipe ALL collections ─────────────────────────────────
const resetAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/material-management');
    console.log('Connected to MongoDB');

    console.log('\n══════════════════════════════════════');
    console.log('⚠️  Wiping ALL database collections...');
    console.log('══════════════════════════════════════\n');

    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Designation.deleteMany({}),
      Location.deleteMany({}),
      Transaction.deleteMany({}),
      InternalReceipt.deleteMany({}),
      ExternalReceipt.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      ActivityLog.deleteMany({}),
      Barcode.deleteMany({}),
      BarcodeChat.deleteMany({}),
    ]);

    console.log('  ✓ Users               — deleted');
    console.log('  ✓ Departments          — deleted');
    console.log('  ✓ Designations         — deleted');
    console.log('  ✓ Locations            — deleted');
    console.log('  ✓ Transactions         — deleted');
    console.log('  ✓ Internal Receipts    — deleted');
    console.log('  ✓ External Receipts    — deleted');
    console.log('  ✓ Notifications        — deleted');
    console.log('  ✓ Audit Logs           — deleted');
    console.log('  ✓ Activity Logs        — deleted');

    console.log('\n══════════════════════════════════════');
    console.log('🗑️  Database reset complete!');
    console.log('   All collections have been wiped.');
    console.log('   Run "npm run admin" to seed an admin user.');
    console.log('   Run "npm run seed" to seed sample data.');
    console.log('══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Reset error:', error);
    process.exit(1);
  }
};

resetAll();
