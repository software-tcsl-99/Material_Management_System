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

// ── Helper: generate a unique TXN id ────────────────────────────
let txnCounter = 0;
const initTxnCounter = async () => {
  const existing = await Transaction.countDocuments();
  txnCounter = existing;
};
const makeTxnId = () => {
  txnCounter += 1;
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `TXN-${d}-${String(txnCounter).padStart(6, '0')}-${rand}`;
};

// ── Helper: random pick ─────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Material catalogue (realistic Indian industrial items) ──────
const materialCatalogue = [
  { name: 'Bolt M8x40', description: 'SS304 hex bolt', unit: 'pcs', price: 3 },
  { name: 'Nut M8', description: 'Hex nut zinc plated', unit: 'pcs', price: 1 },
  { name: 'Bearing 6205', description: 'Deep groove ball bearing', unit: 'pcs', price: 85 },
  { name: 'Conveyor Belt 3m', description: 'Rubber conveyor belt', unit: 'mtr', price: 450 },
  { name: 'Lubricant 5L', description: 'Industrial machine oil', unit: 'ltr', price: 120 },
  { name: 'Copper Wire 2.5mm', description: 'Electrical grade copper', unit: 'kg', price: 680 },
  { name: 'Gasket Set', description: 'Pump gasket kit', unit: 'set', price: 250 },
  { name: 'V-Belt B68', description: 'Industrial V-belt', unit: 'pcs', price: 180 },
  { name: 'Safety Helmet', description: 'IS-2925 certified', unit: 'pcs', price: 350 },
  { name: 'Welding Rod 3.15mm', description: 'E6013 mild steel', unit: 'kg', price: 95 },
  { name: 'MS Plate 6mm', description: 'Mild steel plate 4x8 ft', unit: 'pcs', price: 2800 },
  { name: 'PVC Pipe 4"', description: 'Schedule 40 PVC', unit: 'mtr', price: 220 },
  { name: 'Hydraulic Hose', description: '1/2" SAE 100R2AT', unit: 'mtr', price: 340 },
  { name: 'Air Filter', description: 'Compressor air filter element', unit: 'pcs', price: 560 },
  { name: 'Thermocouple K-type', description: 'Temperature sensor', unit: 'pcs', price: 420 },
  { name: 'Gear Oil 20L', description: 'EP 90 gear lubricant', unit: 'pcs', price: 1850 },
  { name: 'Toggle Clamp', description: 'Horizontal hold-down', unit: 'pcs', price: 275 },
  { name: 'Drill Bit 10mm', description: 'HSS twist drill', unit: 'pcs', price: 45 },
  { name: 'Cable Tie 300mm', description: 'Nylon cable ties (100 pack)', unit: 'pkt', price: 65 },
  { name: 'Limit Switch', description: 'Roller lever micro switch', unit: 'pcs', price: 190 },
];

const randomMaterials = (count) => {
  const selected = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * materialCatalogue.length); } while (used.has(idx));
    used.add(idx);
    const m = materialCatalogue[idx];
    const qty = Math.floor(Math.random() * 50) + 1;
    selected.push({
      name: m.name,
      description: m.description,
      quantity: qty,
      qty: qty,
      unit: m.unit,
      price: m.price,
      total: qty * m.price,
      barcode: `BR${String(idx + 1000).padStart(6, '0')}`,
    });
  }
  return selected;
};

const grandTotalOf = (mats) => mats.reduce((s, m) => s + m.total, 0);

// ── Vendor / customer names for external receipts ───────────────
const vendors = [
  { name: 'ACME Industrial Supplies', address: 'MIDC Pune, Maharashtra' },
  { name: 'Bharat Engineering Works', address: 'Pimpri-Chinchwad, Pune' },
  { name: 'Tata Metaliks Ltd.', address: 'Kharagpur, West Bengal' },
  { name: 'Mahindra CIE Automotive', address: 'Nashik, Maharashtra' },
  { name: 'Precision Fasteners Ltd.', address: 'Thane, Maharashtra' },
];

const customers = [
  { name: 'Larsen & Toubro Ltd.', address: 'Powai, Mumbai' },
  { name: 'Kirloskar Brothers', address: 'Kirloskarvadi, Sangli' },
  { name: 'Thermax Limited', address: 'Chinchwad, Pune' },
];

// ══════════════════════════════════════════════════════════════════
//  MAIN SEED FUNCTION
//  Seeds: Departments, Designations, Locations, Employees,
//         Transactions, Internal Receipts, External Receipts
//  Does NOT seed: Super Admin (use admin.js for that)
// ══════════════════════════════════════════════════════════════════
const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/material-management');
    console.log('Connected to MongoDB');
    console.log('\n── Seeding Master Data ──\n');

    // ── Departments ─────────────────────────────────────────────
    const departments = ['Engineering', 'Production', 'Quality', 'Stores', 'Purchase', 'Maintenance', 'HR', 'Finance', 'IT'];
    const deptDocs = [];
    for (const name of departments) {
      const existing = await Department.findOne({ name });
      if (!existing) {
        const dept = await Department.create({ name });
        deptDocs.push(dept);
        console.log(`  ✓ Department: ${name}`);
      } else {
        deptDocs.push(existing);
        console.log(`  ○ Department exists: ${name}`);
      }
    }

    // ── Designations ────────────────────────────────────────────
    const designations = ['Manager', 'Engineer', 'Supervisor', 'Technician', 'Operator', 'Executive', 'Director', 'Coordinator', 'Analyst', 'Clerk'];
    const desgDocs = [];
    for (const name of designations) {
      const existing = await Designation.findOne({ name });
      if (!existing) {
        const desg = await Designation.create({ name });
        desgDocs.push(desg);
        console.log(`  ✓ Designation: ${name}`);
      } else {
        desgDocs.push(existing);
        console.log(`  ○ Designation exists: ${name}`);
      }
    }

    // ── Locations ───────────────────────────────────────────────
    const locations = [
      { name: 'Head Office', address: 'Mumbai, Maharashtra', coordinates: { lat: 19.076, lng: 72.8777 } },
      { name: 'Plant 1', address: 'Pune, Maharashtra', coordinates: { lat: 18.5204, lng: 73.8567 } },
      { name: 'Plant 2', address: 'Kolhapur, Maharashtra', coordinates: { lat: 16.7050, lng: 74.2433 } },
      { name: 'Warehouse A', address: 'Nashik, Maharashtra', coordinates: { lat: 19.9975, lng: 73.7898 } },
      { name: 'Warehouse B', address: 'Nagpur, Maharashtra', coordinates: { lat: 21.1458, lng: 79.0882 } },
    ];
    const locDocs = [];
    for (const loc of locations) {
      const existing = await Location.findOne({ name: loc.name });
      if (!existing) {
        const location = await Location.create(loc);
        locDocs.push(location);
        console.log(`  ✓ Location: ${loc.name}`);
      } else {
        locDocs.push(existing);
        console.log(`  ○ Location exists: ${loc.name}`);
      }
    }

    // ── Sample Employees (NO super_admin — use admin.js for that) ──
    console.log('\n── Seeding Employees ──\n');

    const sampleEmployees = [
      { employeeId: 'EMP001', fullName: 'Abhay Mudgal', email: 'abhay@mms.com', phone: '9876543210', role: 'employee' },
      { employeeId: 'EMP002', fullName: 'Ayush Patil', email: 'ayush@mms.com', phone: '9876543211', role: 'employee' },
      { employeeId: 'EMP003', fullName: 'Prathmesh Joshi', email: 'prathmesh@mms.com', phone: '9876543212', role: 'employee' },
      { employeeId: 'EMP004', fullName: 'Shreyas Kadam', email: 'shreyas@mms.com', phone: '9876543213', role: 'employee' },
      { employeeId: 'EMP005', fullName: 'Sanket Karande', email: 'sanket@mms.com', phone: '9876543214', role: 'employee' },
    ];

    const empDocs = [];
    for (let i = 0; i < sampleEmployees.length; i++) {
      const emp = sampleEmployees[i];
      const exists = await User.findOne({ employeeId: emp.employeeId });
      if (!exists) {
        const created = await User.create({
          ...emp,
          password: 'password123',
          department: deptDocs[i % deptDocs.length]._id,
          designation: desgDocs[i % desgDocs.length]._id,
          workLocation: locDocs[i % locDocs.length]._id,
          status: 'active',
          mustChangePassword: false,
        });
        empDocs.push(created);
        console.log(`  ✓ Employee: ${emp.fullName} (${emp.employeeId})`);
      } else {
        empDocs.push(exists);
        console.log(`  ○ Employee exists: ${emp.fullName} (${emp.employeeId})`);
      }
    }

    // All users (employees only) for transaction pairing
    const allUsers = empDocs;

    if (allUsers.length < 2) {
      console.log('\n⚠️  Need at least 2 employees to seed transactions. Skipping transaction seeding.');
      printSummary(sampleEmployees);
      process.exit(0);
    }

    // ══════════════════════════════════════════════════════════════
    //  SEED TRANSACTIONS – 7+ per employee (diverse statuses/types)
    // ══════════════════════════════════════════════════════════════
    console.log('\n── Seeding Transactions ──\n');

    await initTxnCounter();

    const docTypes = ['DC', 'RDC', 'Invoice', 'Emergency Send'];
    const statuses = ['pending', 'accepted', 'rejected', 'completed', 'pending', 'accepted', 'pending'];
    const descriptions = [
      'Dispatch of fasteners and fittings to production line',
      'Urgent transfer of spare parts for scheduled maintenance',
      'Return of calibration instruments after quality audit',
      'Emergency supply of PPE kits for safety compliance',
      'Monthly stores replenishment – bearings and belts',
      'Transfer of welding consumables to fabrication shop',
      'Dispatch of electrical components for panel upgrade',
      'Return of excess materials from completed project',
      'Shift handover – tools and gauges transfer',
      'Inter-plant transfer of raw materials for batch production',
    ];

    const createdTxns = [];

    for (const emp of allUsers) {
      for (let t = 0; t < 7; t++) {
        let receiver;
        do { receiver = pick(allUsers); } while (receiver._id.toString() === emp._id.toString());

        const docType = docTypes[t % docTypes.length];
        const status = statuses[t % statuses.length];
        const mats = randomMaterials(Math.floor(Math.random() * 3) + 1);
        const gt = grandTotalOf(mats);

        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date(Date.now() - daysAgo * 86400000);

        const txn = await Transaction.create({
          transactionId: makeTxnId(),
          sender: emp._id,
          receiver: receiver._id,
          documentType: docType,
          documentNumber: `${docType.replace(/\s/g, '')}-${1000 + txnCounter}`,
          expectedReturnDate: docType === 'RDC' ? new Date(Date.now() + 14 * 86400000) : undefined,
          status,
          description: descriptions[t % descriptions.length],
          remarks: t % 3 === 0 ? 'Handle with care – fragile components' : '',
          materials: mats,
          grandTotal: gt,
          rejectionReason: status === 'rejected' ? 'Quantity mismatch found during physical verification' : '',
          photos: [],
          createdAt,
          updatedAt: createdAt,
        });
        createdTxns.push(txn);
        console.log(`  ✓ TXN ${txn.transactionId} | ${emp.fullName} → ${receiver.fullName} | ${docType} | ${status}`);

        // Create notification for receiver
        await Notification.create({
          recipient: receiver._id,
          type: status === 'rejected' ? 'rejected' : 'assigned',
          title: `Material Request – ${txn.transactionId}`,
          message: `${emp.fullName} sent you a ${docType} request (${txn.transactionId})`,
          relatedTransaction: txn._id,
          createdAt,
        });
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  SEED INTERNAL RECEIPTS – for all "completed" transactions
    // ══════════════════════════════════════════════════════════════
    console.log('\n── Seeding Internal Receipts ──\n');

    const completedTxns = createdTxns.filter((tx) => tx.status === 'completed');
    for (const tx of completedTxns) {
      await InternalReceipt.create({
        transaction: tx._id,
        receiver: tx.receiver,
        materialCondition: pick(['Good', 'Good', 'Good', 'Minor damage', 'Acceptable']),
        remarks: pick([
          'All items received in good condition',
          'Verified quantity matches DC. No discrepancies.',
          'Received and stored in bay 3',
          'Minor packaging damage but materials intact',
          'Items tallied and accepted',
        ]),
        receiverGeo: {
          lat: 18.5204 + (Math.random() * 0.01),
          lng: 73.8567 + (Math.random() * 0.01),
          accuracy: Math.floor(Math.random() * 15) + 3,
          address: pick(locations).address,
        },
        createdAt: tx.createdAt,
      });
      console.log(`  ✓ Internal Receipt for ${tx.transactionId}`);

      // Notification to sender
      await Notification.create({
        recipient: tx.sender,
        type: 'completed',
        title: 'Material Received',
        message: `Materials for ${tx.transactionId} have been received by the receiver`,
        relatedTransaction: tx._id,
        createdAt: tx.createdAt,
      });
    }

    // ══════════════════════════════════════════════════════════════
    //  SEED EXTERNAL RECEIPTS – vendor & customer (3 per employee)
    // ══════════════════════════════════════════════════════════════
    console.log('\n── Seeding External Receipts ──\n');
    let extCounter = 0;

    for (const emp of allUsers) {
      for (let e = 0; e < 3; e++) {
        const isVendor = e < 2;
        const mats = randomMaterials(Math.floor(Math.random() * 3) + 1);
        const gt = grandTotalOf(mats);
        const daysAgo = Math.floor(Math.random() * 25);
        const createdAt = new Date(Date.now() - daysAgo * 86400000);

        if (isVendor) {
          const v = pick(vendors);
          extCounter += 1;
          await ExternalReceipt.create({
            receiptId: `EXT-SEED-${String(extCounter).padStart(6, '0')}`,
            type: 'vendor',
            vendorName: v.name,
            vendorAddress: v.address,
            prNumber: `PR-${5000 + txnCounter + e}`,
            poNumber: `PO-${7000 + txnCounter + e}`,
            orderedBy: pick(allUsers)._id,
            receiver: emp._id,
            materials: mats,
            grandTotal: gt,
            remarks: pick([
              'Urgent order – expedited delivery',
              'Annual maintenance contract supply',
              'Replacement parts for breakdown',
              'Project material indent',
            ]),
            receiverGeo: {
              lat: 19.076 + (Math.random() * 0.01),
              lng: 72.8777 + (Math.random() * 0.01),
              accuracy: Math.floor(Math.random() * 10) + 5,
              address: pick(locations).address,
            },
            photos: [],
            createdAt,
            updatedAt: createdAt,
          });
          console.log(`  ✓ Vendor Receipt  | ${v.name} → ${emp.fullName}`);
        } else {
          const c = pick(customers);
          extCounter += 1;
          await ExternalReceipt.create({
            receiptId: `EXT-SEED-${String(extCounter).padStart(6, '0')}`,
            type: 'customer',
            customerName: c.name,
            customerAddress: c.address,
            documentNumber: `CUST-${8000 + txnCounter}`,
            documentDescription: 'Customer return / incoming material',
            orderedBy: pick(allUsers)._id,
            receiver: emp._id,
            materials: mats,
            grandTotal: gt,
            remarks: 'Customer returned unused surplus materials',
            receiverGeo: {
              lat: 18.5204 + (Math.random() * 0.01),
              lng: 73.8567 + (Math.random() * 0.01),
              accuracy: Math.floor(Math.random() * 10) + 5,
              address: pick(locations).address,
            },
            photos: [],
            createdAt,
            updatedAt: createdAt,
          });
          console.log(`  ✓ Customer Receipt | ${c.name} → ${emp.fullName}`);
        }
      }
    }

    // ── Final summary ───────────────────────────────────────────
    printSummary(sampleEmployees);
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

async function printSummary(sampleEmployees) {
  const userCount = await User.countDocuments();
  const txnCount = await Transaction.countDocuments();
  const intCount = await InternalReceipt.countDocuments();
  const extCount = await ExternalReceipt.countDocuments();
  const notifCount = await Notification.countDocuments();
  const deptCount = await Department.countDocuments();
  const desigCount = await Designation.countDocuments();
  const locCount = await Location.countDocuments();

  console.log('\n══════════════════════════════════════');
  console.log('🌱 Seed completed successfully!');
  console.log(`   Departments:        ${deptCount}`);
  console.log(`   Designations:       ${desigCount}`);
  console.log(`   Locations:          ${locCount}`);
  console.log(`   Users:              ${userCount}`);
  console.log(`   Transactions:       ${txnCount}`);
  console.log(`   Internal Receipts:  ${intCount}`);
  console.log(`   External Receipts:  ${extCount}`);
  console.log(`   Notifications:      ${notifCount}`);
  console.log('══════════════════════════════════════');
  console.log('\n  Employee Login credentials:');
  console.log('  ┌────────────────────────────────────────────────┐');
  for (const emp of sampleEmployees) {
    const padEmail = (emp.email + '  ').slice(0, 22);
    console.log(`  │ ${emp.employeeId}: ${padEmail} / password123      │`);
  }
  console.log('  └────────────────────────────────────────────────┘');
  console.log('\n  ℹ️  Admin is NOT seeded here. Run "npm run admin" separately.');
}

seedAll();
