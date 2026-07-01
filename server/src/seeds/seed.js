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
const Barcode = require('../models/Barcode');
const BarcodeChat = require('../models/BarcodeChat');

// ── Helper: generate a unique TXN id ────────────────────────────
let txnCounter = 0;
const makeTxnId = () => {
  txnCounter += 1;
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `TXN-${d}-${String(txnCounter).padStart(6, '0')}-${rand}`;
};

const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/material-management');
    console.log('Connected to MongoDB');

    // ── Departments ─────────────────────────────────────────────
    console.log('\n── Seeding Departments ──\n');
    const departments = ['Engineering', 'Production', 'Quality', 'Stores', 'Purchase', 'Maintenance', 'HR', 'Finance', 'IT', 'Admin'];
    const deptDocs = [];
    for (const name of departments) {
      let dept = await Department.findOne({ name });
      if (!dept) {
        dept = await Department.create({ name });
        console.log(`  ✓ Department: ${name}`);
      }
      deptDocs.push(dept);
    }

    // ── Designations ────────────────────────────────────────────
    console.log('\n── Seeding Designations ──\n');
    const designations = ['Manager', 'Engineer', 'Supervisor', 'Technician', 'Operator', 'Executive', 'Director', 'Coordinator', 'Analyst', 'Clerk'];
    const desgDocs = [];
    for (const name of designations) {
      let desg = await Designation.findOne({ name });
      if (!desg) {
        desg = await Designation.create({ name });
        console.log(`  ✓ Designation: ${name}`);
      }
      desgDocs.push(desg);
    }

    // ── Locations ───────────────────────────────────────────────
    console.log('\n── Seeding Locations ──\n');
    const locations = [
      { name: 'Head Office', address: 'Mumbai, Maharashtra', coordinates: { lat: 19.076, lng: 72.8777 } },
      { name: 'Plant 1', address: 'Pune, Maharashtra', coordinates: { lat: 18.5204, lng: 73.8567 } },
      { name: 'Plant 2', address: 'Kolhapur, Maharashtra', coordinates: { lat: 16.7050, lng: 74.2433 } },
      { name: 'Warehouse A', address: 'Nashik, Maharashtra', coordinates: { lat: 19.9975, lng: 73.7898 } },
      { name: 'Warehouse B', address: 'Nagpur, Maharashtra', coordinates: { lat: 21.1458, lng: 79.0882 } },
    ];
    const locDocs = [];
    for (const loc of locations) {
      let location = await Location.findOne({ name: loc.name });
      if (!location) {
        location = await Location.create(loc);
        console.log(`  ✓ Location: ${loc.name}`);
      }
      locDocs.push(location);
    }

    // ── Users ───────────────────────────────────────────────────
    console.log('\n── Seeding Users (Credentials, Roles, and Departments) ──\n');

    const userSpecs = [
      {
        employeeId: 'ADMIN001',
        fullName: 'Adesh Bhongale',
        email: 'admin@mms.com',
        phone: '9999999959',
        password: 'Admin@1234',
        role: 'super_admin',
        departmentAdminType: null,
        deptName: 'Admin',
        desgName: 'Director',
        locName: 'Head Office'
      },
      {
        employeeId: 'STORE001',
        fullName: 'Prathmesh Joshi',
        email: 'store@mms.com',
        phone: '9876543210',
        password: 'Store@1234',
        role: 'department_admin',
        departmentAdminType: 'store',
        deptName: 'Stores',
        desgName: 'Manager',
        locName: 'Warehouse A'
      },
      {
        employeeId: 'ACC001',
        fullName: 'Shreyas Kadam',
        email: 'accounts@mms.com',
        phone: '9876543211',
        password: 'Acc@1234',
        role: 'department_admin',
        departmentAdminType: 'accounts',
        deptName: 'Finance',
        desgName: 'Executive',
        locName: 'Head Office'
      },
      {
        employeeId: 'MGT001',
        fullName: 'Sanket Karande',
        email: 'management@mms.com',
        phone: '9876543212',
        password: 'Mgt@1234',
        role: 'department_admin',
        departmentAdminType: 'management',
        deptName: 'Admin',
        desgName: 'Director',
        locName: 'Head Office'
      },
      {
        employeeId: 'TL001',
        fullName: 'Ayush Patil',
        email: 'teamlead@mms.com',
        phone: '9876543213',
        password: 'Tl@1234',
        role: 'team_lead',
        departmentAdminType: null,
        deptName: 'Engineering',
        desgName: 'Supervisor',
        locName: 'Plant 1'
      },
      {
        employeeId: 'EMP001',
        fullName: 'Abhay Mudgal',
        email: 'abhay@mms.com',
        phone: '9876543214',
        password: 'password123',
        role: 'employee',
        departmentAdminType: null,
        deptName: 'Engineering',
        desgName: 'Engineer',
        locName: 'Plant 1'
      },
      {
        employeeId: 'EMP002',
        fullName: 'Sneha Kulkarni',
        email: 'sneha@mms.com',
        phone: '9876543215',
        password: 'password123',
        role: 'employee',
        departmentAdminType: null,
        deptName: 'Production',
        desgName: 'Technician',
        locName: 'Plant 2'
      }
    ];

    const seededUsers = {};
    for (const spec of userSpecs) {
      let usr = await User.findOne({ employeeId: spec.employeeId });
      if (!usr) {
        const dept = deptDocs.find(d => d.name === spec.deptName);
        const desg = desgDocs.find(d => d.name === spec.desgName);
        const loc = locDocs.find(l => l.name === spec.locName);
        usr = await User.create({
          employeeId: spec.employeeId,
          fullName: spec.fullName,
          email: spec.email,
          phone: spec.phone,
          password: spec.password,
          department: dept._id,
          designation: desg._id,
          workLocation: loc._id,
          role: spec.role,
          departmentAdminType: spec.departmentAdminType,
          status: 'active',
          mustChangePassword: false,
        });
        console.log(`  ✓ User: ${spec.fullName} (${spec.employeeId}) [${spec.role} / ${spec.deptName}]`);
      }
      seededUsers[spec.employeeId] = usr;
    }

    // Convenience variables
    const admin = seededUsers['ADMIN001'];
    const store = seededUsers['STORE001'];
    const accounts = seededUsers['ACC001'];
    const management = seededUsers['MGT001'];
    const teamlead = seededUsers['TL001'];
    const abhay = seededUsers['EMP001'];
    const sneha = seededUsers['EMP002'];

    // ── Transactions (RDC default, 5 specific transactions with subloops) ──
    console.log('\n── Seeding RDC Transactions and Barcode Sub-Loops ──\n');

    // 1. Transaction 1: Active RDC loop with multiple barcodes
    const txn1Id = makeTxnId();
    const txn1 = await Transaction.create({
      transactionId: txn1Id,
      sender: abhay._id,
      receiver: sneha._id,
      documentType: 'RDC',
      documentNumber: 'RDC-SEED-001',
      expectedReturnDate: new Date(Date.now() + 14 * 86400000),
      status: 'received',
      description: 'Transfer of high-precision encoders to shop floor Plant 2',
      priority: 'high',
      costCenter: 'DEPT-ENG-2026',
      grandTotal: 170,
      materials: [
        { name: 'Bearing 6205', description: 'Deep groove ball bearing', quantity: 2, qty: 2, unit: 'pcs', price: 85, total: 170, barcode: 'BC-00001-9923' }
      ]
    });

    // Create subloop barcodes for Transaction 1
    const barcodes1 = [
      { barcode: 'BC-00001-9923', status: 'Active', owner: sneha._id, remark: 'Initial transfer accepted' },
      { barcode: 'BC-00002-8841', status: 'Returned', owner: store._id, remark: 'Material returned back to store stock shelves' }
    ];

    for (const bc of barcodes1) {
      await Barcode.create({
        barcode: bc.barcode,
        transactionId: txn1Id,
        materialName: 'Bearing 6205',
        status: bc.status,
        owner: bc.owner,
        history: [
          { action: 'Created', user: abhay._id, remarks: 'Registered in request RDC-SEED-001' },
          { action: 'Sourced', user: store._id, remarks: 'Store dispatched' },
          { action: 'Accepted', user: sneha._id, remarks: bc.remark }
        ]
      });

      // Seed chat messages
      await BarcodeChat.create({
        barcode: bc.barcode,
        transactionId: txn1Id,
        sender: abhay._id,
        message: `Barcode ${bc.barcode} delivered to Sneha. Verification complete.`
      });
    }
    console.log(`  ✓ Transaction ${txn1Id}: Active RDC with 2 barcodes`);

    // 2. Transaction 2: Pending Store assignment
    const txn2Id = makeTxnId();
    const txn2 = await Transaction.create({
      transactionId: txn2Id,
      sender: sneha._id,
      receiver: abhay._id,
      documentType: 'RDC',
      documentNumber: 'RDC-SEED-002',
      expectedReturnDate: new Date(Date.now() + 7 * 86400000),
      status: 'ready_for_dispatch',
      description: 'Lubricant drum transfer for maintenance machine oiling',
      priority: 'medium',
      costCenter: 'DEPT-MAINT-2026',
      grandTotal: 120,
      materials: [
        { name: 'Lubricant 5L', description: 'Industrial machine oil', quantity: 1, qty: 1, unit: 'ltr', price: 120, total: 120, barcode: 'BC-00003-7281' }
      ]
    });

    await Barcode.create({
      barcode: 'BC-00003-7281',
      transactionId: txn2Id,
      materialName: 'Lubricant 5L',
      status: 'Active',
      owner: store._id,
      history: [
        { action: 'Created', user: sneha._id, remarks: 'Request submitted' }
      ]
    });
    console.log(`  ✓ Transaction ${txn2Id}: Pending store dispatch`);

    // 3. Transaction 3: Split Barcode Loop
    const txn3Id = makeTxnId();
    const txn3 = await Transaction.create({
      transactionId: txn3Id,
      sender: abhay._id,
      receiver: sneha._id,
      documentType: 'RDC',
      documentNumber: 'RDC-SEED-003',
      expectedReturnDate: new Date(Date.now() + 10 * 86400000),
      status: 'received',
      description: 'Bulk copper wire split delivery to assembly desk',
      priority: 'high',
      costCenter: 'DEPT-ENG-2026',
      grandTotal: 1360,
      materials: [
        { name: 'Copper Wire 2.5mm', description: 'Electrical grade copper', quantity: 2, qty: 2, unit: 'kg', price: 680, total: 1360, barcode: 'BC-00004-9210' }
      ]
    });

    // Parent barcode split
    await Barcode.create({
      barcode: 'BC-00004-9210',
      transactionId: txn3Id,
      materialName: 'Copper Wire 2.5mm',
      status: 'Active',
      owner: sneha._id,
      history: [
        { action: 'Created', user: abhay._id, remarks: 'Challan request registered' },
        { action: 'Split Parent', user: sneha._id, remarks: 'Split into child barcode BC-00005-9211' }
      ]
    });

    // Child split barcode
    await Barcode.create({
      barcode: 'BC-00005-9211',
      transactionId: txn3Id,
      materialName: 'Copper Wire 2.5mm',
      status: 'Active',
      owner: sneha._id,
      history: [
        { action: 'Split Child Created', user: sneha._id, remarks: 'Created from split event of parent BC-00004-9210' }
      ]
    });
    console.log(`  ✓ Transaction ${txn3Id}: Split Barcode Loop (Parent & Child active)`);

    // 4. Transaction 4: RDC Converted to DC (Permanently consumed)
    const txn4Id = makeTxnId();
    const txn4 = await Transaction.create({
      transactionId: txn4Id,
      sender: abhay._id,
      receiver: sneha._id,
      documentType: 'DC', // Converted type
      documentNumber: 'DC-CONV-004',
      status: 'completed',
      description: 'Fasteners and safety helmets for project erection (Permanently Consumed)',
      priority: 'low',
      costCenter: 'DEPT-CIVIL-2026',
      grandTotal: 353,
      materials: [
        { name: 'Bolt M8x40', quantity: 1, qty: 1, unit: 'pcs', price: 3, total: 3, barcode: 'BC-00006-1182' },
        { name: 'Safety Helmet', quantity: 1, qty: 1, unit: 'pcs', price: 350, total: 350, barcode: 'BC-00007-1183' }
      ]
    });

    await Barcode.create({
      barcode: 'BC-00006-1182',
      transactionId: txn4Id,
      materialName: 'Bolt M8x40',
      status: 'Returned',
      owner: store._id,
      history: [
        { action: 'Created', user: abhay._id },
        { action: 'Consumed', user: sneha._id, remarks: 'Marked consumed after convert DC request' }
      ]
    });
    console.log(`  ✓ Transaction ${txn4Id}: Converted RDC -> DC`);

    // 5. Transaction 5: RDC Converted to Invoice
    const txn5Id = makeTxnId();
    const txn5 = await Transaction.create({
      transactionId: txn5Id,
      sender: sneha._id,
      receiver: abhay._id,
      documentType: 'Invoice', // Converted to billing invoice
      documentNumber: 'INV-SEED-005',
      status: 'completed',
      description: 'Conveyor belts sold and billed via Invoice matching',
      priority: 'high',
      costCenter: 'DEPT-SALE-2026',
      grandTotal: 900,
      invoiceNumber: 'INV-990812',
      invoiceDate: new Date(),
      invoiceTotal: 900,
      invoiceMatchStatus: 'matched',
      materials: [
        { name: 'Conveyor Belt 3m', quantity: 2, qty: 2, unit: 'mtr', price: 450, total: 900, barcode: 'BC-00008-6623' }
      ]
    });

    await Barcode.create({
      barcode: 'BC-00008-6623',
      transactionId: txn5Id,
      materialName: 'Conveyor Belt 3m',
      status: 'Returned',
      owner: store._id,
      history: [
        { action: 'Created', user: sneha._id },
        { action: 'Billed', user: accounts._id, remarks: 'Invoice Matched' }
      ]
    });
    console.log(`  ✓ Transaction ${txn5Id}: Converted RDC -> Invoice matched`);

    // Print details
    printSummary();

  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

const printSummary = () => {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('🌱 Seed completed successfully!');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('\n🔐 ALL LOGIN CREDENTIALS BY ROLE & DEPARTMENT');
  console.log('┌───────────────────────┬──────────────────────┬─────────────┬──────────────┐');
  console.log('│ Employee Name         │ Email                │ Password    │ Role         │');
  console.log('├───────────────────────┼──────────────────────┼─────────────┼──────────────┤');
  console.log('│ Adesh Bhongale        │ admin@mms.com        │ Admin@1234  │ super_admin  │');
  console.log('│ Prathmesh Joshi       │ store@mms.com        │ Store@1234  │ store_admin  │');
  console.log('│ Shreyas Kadam         │ accounts@mms.com     │ Acc@1234    │ accounts     │');
  console.log('│ Sanket Karande        │ management@mms.com   │ Mgt@1234    │ management   │');
  console.log('│ Ayush Patil           │ teamlead@mms.com     │ Tl@1234     │ team_lead    │');
  console.log('│ Abhay Mudgal          │ abhay@mms.com        │ password123 │ employee     │');
  console.log('│ Sneha Kulkarni        │ sneha@mms.com        │ password123 │ employee     │');
  console.log('└───────────────────────┴──────────────────────┴─────────────┴──────────────┘');
  console.log('\n🏢 DEPARTMENT MAPPINGS:');
  console.log('  • Adesh Bhongale  → Admin Department');
  console.log('  • Prathmesh Joshi → Stores Department');
  console.log('  • Shreyas Kadam   → Finance Department');
  console.log('  • Sanket Karande  → Admin Department');
  console.log('  • Ayush Patil     → Engineering Department');
  console.log('  • Abhay Mudgal    → Engineering Department');
  console.log('  • Sneha Kulkarni  → Production Department\n');
  process.exit(0);
};

seedAll();
