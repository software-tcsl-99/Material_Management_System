/**
 * Complete Seed Script - Seeds ALL test data
 * Run: npm run seed
 * 
 * Creates: Departments, Designations, Locations, Users (all roles),
 * Transactions (various lifecycle stages), Barcodes, Chats, Notifications
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');
const Transaction = require('../models/Transaction');
const Barcode = require('../models/Barcode');
const TransactionChat = require('../models/TransactionChat');
const Notification = require('../models/Notification');
const Transfer = require('../models/Transfer');
const Return = require('../models/Return');
const AuditLog = require('../models/AuditLog');

const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // ═══════════════════════════════════════════
    // DEPARTMENTS
    // ═══════════════════════════════════════════
    console.log('── Seeding Departments ──');
    const deptData = [
      { name: 'Engineering', code: 'ENG' },
      { name: 'Production', code: 'PROD' },
      { name: 'Quality', code: 'QA' },
      { name: 'Stores', code: 'STR' },
      { name: 'Purchase', code: 'PUR' },
      { name: 'Maintenance', code: 'MNT' },
      { name: 'HR', code: 'HR' },
      { name: 'Finance', code: 'FIN' },
      { name: 'IT', code: 'IT' },
      { name: 'Admin', code: 'ADM' },
      { name: 'R&D', code: 'RND' },
      { name: 'Service', code: 'SRV' },
    ];
    const depts = {};
    for (const d of deptData) {
      let dept = await Department.findOne({ name: d.name });
      if (!dept) dept = await Department.create(d);
      depts[d.name] = dept;
      console.log(`  ✓ ${d.name}`);
    }

    // ═══════════════════════════════════════════
    // DESIGNATIONS
    // ═══════════════════════════════════════════
    console.log('\n── Seeding Designations ──');
    const desgData = [
      { name: 'Director', level: 10 },
      { name: 'General Manager', level: 9 },
      { name: 'Manager', level: 8 },
      { name: 'Deputy Manager', level: 7 },
      { name: 'Senior Engineer', level: 6 },
      { name: 'Engineer', level: 5 },
      { name: 'Supervisor', level: 4 },
      { name: 'Technician', level: 3 },
      { name: 'Operator', level: 2 },
      { name: 'Executive', level: 5 },
      { name: 'Coordinator', level: 4 },
      { name: 'Analyst', level: 5 },
      { name: 'Clerk', level: 2 },
      { name: 'Store Incharge', level: 6 },
    ];
    const desgs = {};
    for (const d of desgData) {
      let desg = await Designation.findOne({ name: d.name });
      if (!desg) desg = await Designation.create(d);
      desgs[d.name] = desg;
      console.log(`  ✓ ${d.name}`);
    }

    // ═══════════════════════════════════════════
    // LOCATIONS
    // ═══════════════════════════════════════════
    console.log('\n── Seeding Locations ──');
    const locData = [
      { name: 'Head Office', address: 'Mumbai, Maharashtra', coordinates: { lat: 19.076, lng: 72.8777 } },
      { name: 'Plant 1', address: 'Pune, Maharashtra', coordinates: { lat: 18.5204, lng: 73.8567 } },
      { name: 'Plant 2', address: 'Kolhapur, Maharashtra', coordinates: { lat: 16.705, lng: 74.2433 } },
      { name: 'Warehouse A', address: 'Nashik, Maharashtra', coordinates: { lat: 19.9975, lng: 73.7898 } },
      { name: 'Warehouse B', address: 'Nagpur, Maharashtra', coordinates: { lat: 21.1458, lng: 79.0882 } },
    ];
    const locs = {};
    for (const l of locData) {
      let loc = await Location.findOne({ name: l.name });
      if (!loc) loc = await Location.create(l);
      locs[l.name] = loc;
      console.log(`  ✓ ${l.name}`);
    }

    // ═══════════════════════════════════════════
    // USERS (ALL ROLES)
    // ═══════════════════════════════════════════
    console.log('\n── Seeding Users ──');
    const userSpecs = [
      // Super Admin
      { employeeId: 'ADMIN001', fullName: 'Adesh Bhongale', email: 'admin@mms.com', phone: '9999999959', password: 'Admin@1234', role: 'super_admin', departmentAdminType: null, dept: 'Admin', desg: 'Director', loc: 'Head Office' },
      // Store Admin
      { employeeId: 'STORE001', fullName: 'Ayush Patil', email: 'store@mms.com', phone: '9876543210', password: 'Store@1234', role: 'department_admin', departmentAdminType: 'store', dept: 'Stores', desg: 'Store Incharge', loc: 'Warehouse A' },
      // Accounts Admin
      { employeeId: 'ACC001', fullName: 'Shreyas Kadam', email: 'accounts@mms.com', phone: '9876543211', password: 'Acc@1234', role: 'department_admin', departmentAdminType: 'accounts', dept: 'Finance', desg: 'Manager', loc: 'Head Office' },
      // Management Admin
      { employeeId: 'MGT001', fullName: 'Aditya Pise', email: 'management@mms.com', phone: '9876543212', password: 'Mgt@1234', role: 'department_admin', departmentAdminType: 'management', dept: 'Admin', desg: 'General Manager', loc: 'Head Office' },
      // Production Admin
      { employeeId: 'PROD001', fullName: 'Vikram Patil', email: 'production@mms.com', phone: '9876543220', password: 'Prod@1234', role: 'department_admin', departmentAdminType: 'production', dept: 'Production', desg: 'Manager', loc: 'Plant 1' },
      // Team Leads
      { employeeId: 'TL001', fullName: 'Prathmesh Joshi', email: 'teamlead@mms.com', phone: '9876543213', password: 'Tl@1234', role: 'team_lead', departmentAdminType: null, dept: 'Engineering', desg: 'Supervisor', loc: 'Plant 1' },
      { employeeId: 'TL002', fullName: 'Rahul Deshmukh', email: 'teamlead2@mms.com', phone: '9876543221', password: 'Tl@1234', role: 'team_lead', departmentAdminType: null, dept: 'Service', desg: 'Supervisor', loc: 'Plant 2' },
      // Employees
      { employeeId: 'EMP001', fullName: 'Abhay Mudgal', email: 'abhay@mms.com', phone: '9876543214', password: 'password123', role: 'employee', departmentAdminType: null, dept: 'Engineering', desg: 'Engineer', loc: 'Plant 1' },
      { employeeId: 'EMP002', fullName: 'Sneha Kulkarni', email: 'sneha@mms.com', phone: '9876543215', password: 'password123', role: 'employee', departmentAdminType: null, dept: 'Production', desg: 'Technician', loc: 'Plant 2' },
      { employeeId: 'EMP003', fullName: 'Ravi Sharma', email: 'ravi@mms.com', phone: '9876543216', password: 'password123', role: 'employee', departmentAdminType: null, dept: 'Service', desg: 'Engineer', loc: 'Plant 1' },
      { employeeId: 'EMP004', fullName: 'Priya Naik', email: 'priya@mms.com', phone: '9876543217', password: 'password123', role: 'employee', departmentAdminType: null, dept: 'Engineering', desg: 'Senior Engineer', loc: 'Plant 1' },
      // Handler
      { employeeId: 'HDL001', fullName: 'Rahul Handler', email: 'handler@mms.com', phone: '9876543218', password: 'password123', role: 'employee', departmentAdminType: null, dept: 'Stores', desg: 'Coordinator', loc: 'Warehouse A' },
      // R&D Engineer
      { employeeId: 'RND001', fullName: 'Amit R&D Engineer', email: 'rnd@mms.com', phone: '9876543219', password: 'password123', role: 'employee', departmentAdminType: null, dept: 'R&D', desg: 'Engineer', loc: 'Plant 1' },
    ];

    const users = {};
    for (const spec of userSpecs) {
      let user = await User.findOne({ employeeId: spec.employeeId });
      if (!user) {
        user = await User.create({
          employeeId: spec.employeeId,
          fullName: spec.fullName,
          email: spec.email,
          phone: spec.phone,
          password: spec.password,
          role: spec.role,
          departmentAdminType: spec.departmentAdminType,
          department: depts[spec.dept]._id,
          designation: desgs[spec.desg]._id,
          workLocation: locs[spec.loc]._id,
          status: 'active',
          mustChangePassword: false,
        });
      }
      users[spec.employeeId] = user;
      console.log(`  ✓ ${spec.fullName} (${spec.employeeId}) [${spec.role}${spec.departmentAdminType ? '/' + spec.departmentAdminType : ''}]`);
    }

    // Convenience refs
    const admin = users['ADMIN001'];
    const store = users['STORE001'];
    const accounts = users['ACC001'];
    const management = users['MGT001'];
    const tl1 = users['TL001'];
    const tl2 = users['TL002'];
    const emp1 = users['EMP001']; // Abhay - Engineering
    const emp2 = users['EMP002']; // Sneha - Production
    const emp3 = users['EMP003']; // Ravi - Service
    const emp4 = users['EMP004']; // Priya - Engineering
    const handler = users['HDL001'];
    const rndEng = users['RND001'];

    // ═══════════════════════════════════════════
    // TRANSACTIONS & BARCODES
    // ═══════════════════════════════════════════
    console.log('\n── Seeding Transactions & Barcodes ──');

    // Clear old transaction data to prevent duplicate key errors on seed re-run
    await Transaction.deleteMany({});
    await Barcode.deleteMany({});
    await Transfer.deleteMany({});
    await Return.deleteMany({});
    await TransactionChat.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    // --- TXN 1: ACTIVE - Full workflow completed, materials active with requester ---
    const txn1 = await Transaction.create({
      transactionId: 'TXN-20260001',
      requester: emp3._id, // Ravi (Service Engineer)
      department: depts['Service']._id,
      teamLead: tl2._id,
      handler: handler._id,
      status: 'active',
      documentType: 'RDC',
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 86400000),
      description: 'Service department requires Panel PC and Encoders for field installation',
      totalItems: 6,
      activeItems: 4,
      returnedItems: 2,
      materials: [
        {
          name: 'Panel PC', quantity: 2, unit: 'pcs',
          barcodes: [
            { barcode: 'PC120001', status: 'Active', owner: rndEng._id },
            { barcode: 'PC120002', status: 'Returned', owner: store._id },
          ],
        },
        {
          name: 'Encoder', quantity: 3, unit: 'pcs',
          barcodes: [
            { barcode: 'EN120031', status: 'Active', owner: rndEng._id },
            { barcode: 'EN120032', status: 'Returned', owner: store._id },
            { barcode: 'EN120033', status: 'Active', owner: emp3._id },
          ],
        },
        {
          name: 'Head', quantity: 1, unit: 'pcs',
          barcodes: [
            { barcode: 'HD120001', status: 'Active', owner: emp3._id },
          ],
        },
      ],
      chatMembers: [emp3._id, tl2._id, store._id, handler._id, management._id, admin._id],
      approvalChain: [
        { user: tl2._id, role: 'team_lead', action: 'approved', remarks: 'Approved for field work', timestamp: new Date('2026-05-20T10:00:00') },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved', timestamp: new Date('2026-05-20T11:00:00') },
      ],
      timeline: [
        { action: 'Request Created', description: 'Ravi Sharma created material request', user: emp3._id, timestamp: new Date('2026-05-20T09:30:00') },
        { action: 'Team Lead Approved', description: 'Approved by Rahul Deshmukh', user: tl2._id, timestamp: new Date('2026-05-20T10:00:00') },
        { action: 'Management Approved', description: 'Approved by Management', user: management._id, timestamp: new Date('2026-05-20T11:00:00') },
        { action: 'Store Accepted', description: 'Store accepted the request', user: store._id, timestamp: new Date('2026-05-20T11:45:00') },
        { action: 'Handler Assigned', description: 'Rahul Handler assigned', user: store._id, timestamp: new Date('2026-05-20T11:45:00') },
        { action: 'Dispatched', description: 'Items dispatched to requester', user: handler._id, timestamp: new Date('2026-05-21T09:00:00') },
        { action: 'Received', description: 'Ravi received all items', user: emp3._id, timestamp: new Date('2026-05-21T10:00:00') },
        { action: 'Transferred', description: 'PC120001 & EN120031 transferred to R&D Engineer', user: emp3._id, timestamp: new Date('2026-05-22T09:00:00') },
        { action: 'Returned', description: 'PC120002 returned to store', user: emp3._id, timestamp: new Date('2026-05-23T10:00:00') },
        { action: 'Returned', description: 'EN120032 returned to store', user: rndEng._id, timestamp: new Date('2026-05-24T10:00:00') },
      ],
    });
    console.log(`  ✓ ${txn1.transactionId}: Active (6 items, 4 active, 2 returned)`);

    // Create barcodes for TXN 1
    const txn1Barcodes = [
      { barcode: 'PC120001', mat: 'Panel PC', status: 'Active', owner: rndEng._id, ownerDept: depts['R&D']._id },
      { barcode: 'PC120002', mat: 'Panel PC', status: 'Returned', owner: store._id, ownerDept: depts['Stores']._id },
      { barcode: 'EN120031', mat: 'Encoder', status: 'Active', owner: rndEng._id, ownerDept: depts['R&D']._id },
      { barcode: 'EN120032', mat: 'Encoder', status: 'Returned', owner: store._id, ownerDept: depts['Stores']._id },
      { barcode: 'EN120033', mat: 'Encoder', status: 'Active', owner: emp3._id, ownerDept: depts['Service']._id },
      { barcode: 'HD120001', mat: 'Head', status: 'Active', owner: emp3._id, ownerDept: depts['Service']._id },
    ];

    for (const bc of txn1Barcodes) {
      await Barcode.create({
        barcode: bc.barcode,
        transactionId: txn1.transactionId,
        transaction: txn1._id,
        materialName: bc.mat,
        status: bc.status,
        owner: bc.owner,
        ownerDepartment: bc.ownerDept,
        transferCount: bc.barcode.startsWith('PC1200') || bc.barcode === 'EN120031' ? 1 : 0,
        ownershipHistory: [
          { user: emp3._id, department: depts['Service']._id, action: 'received', remarks: 'Initial recipient' },
          ...(bc.owner.toString() !== emp3._id.toString()
            ? [{ user: bc.owner, department: bc.ownerDept, action: bc.status === 'Returned' ? 'returned' : 'transferred', remarks: bc.status === 'Returned' ? 'Returned to store' : 'Transferred' }]
            : []),
        ],
        history: [
          { action: 'Request Created', user: emp3._id, timestamp: new Date('2026-05-20T09:30:00') },
          { action: 'Team Lead Approved', user: tl2._id, timestamp: new Date('2026-05-20T10:00:00') },
          { action: 'Store Accepted', user: store._id, timestamp: new Date('2026-05-20T11:45:00') },
          { action: 'Handler Assigned', user: store._id, remarks: 'Rahul Handler', timestamp: new Date('2026-05-20T11:45:00') },
          { action: 'Dispatched', user: handler._id, timestamp: new Date('2026-05-21T09:00:00') },
          { action: 'Received', user: emp3._id, remarks: 'GPS & Photo Captured', timestamp: new Date('2026-05-21T10:00:00'), gps: { lat: 18.5204, lng: 73.8567, address: 'Pune, Maharashtra, India' } },
        ],
      });
    }

    // Create transfers for TXN 1
    await Transfer.create({
      transactionId: txn1.transactionId,
      barcode: 'PC120001', fromUser: emp3._id, toUser: rndEng._id,
      fromDepartment: depts['Service']._id, toDepartment: depts['R&D']._id,
      type: 'cross_department', status: 'completed', requiresApproval: true,
      approvedBy: management._id, approvedAt: new Date('2026-05-22T09:00:00'),
      remarks: 'Transferred for R&D testing',
    });
    await Transfer.create({
      transactionId: txn1.transactionId,
      barcode: 'EN120031', fromUser: emp3._id, toUser: rndEng._id,
      fromDepartment: depts['Service']._id, toDepartment: depts['R&D']._id,
      type: 'cross_department', status: 'completed', requiresApproval: true,
      approvedBy: management._id,
      remarks: 'Encoder for R&D analysis',
    });

    // Create returns for TXN 1
    await Return.create({
      transactionId: txn1.transactionId, barcode: 'PC120002', fromUser: emp3._id,
      store: store._id, status: 'completed', condition: 'good',
      remarks: 'No longer needed', receivedAt: new Date('2026-05-23T10:00:00'),
    });
    await Return.create({
      transactionId: txn1.transactionId, barcode: 'EN120032', fromUser: rndEng._id,
      store: store._id, status: 'completed', condition: 'good',
      remarks: 'Testing complete', receivedAt: new Date('2026-05-24T10:00:00'),
    });

    // Chat messages for TXN 1
    const chatMsgs = [
      { sender: emp3._id, message: 'Request created for 6 items. Please review and approve.', ts: '2026-05-20T09:30:00' },
      { sender: tl2._id, message: 'Request approved.', ts: '2026-05-20T10:00:00' },
      { sender: store._id, message: 'Store accepted the request. Assigning handler.', ts: '2026-05-20T11:45:00' },
      { sender: handler._id, message: 'I have been assigned. Will pick up items and deliver shortly.', ts: '2026-05-20T12:00:00' },
      { sender: emp3._id, message: 'Items delivered to Service Engineer.', ts: '2026-05-21T10:00:00' },
      { sender: rndEng._id, message: 'Received EN120031. Thank you.', ts: '2026-05-22T12:30:00' },
      { sender: emp3._id, message: 'I have been assigned. Will pick up items and deliver shortly.', ts: '2026-05-23T09:00:00' },
    ];
    for (const msg of chatMsgs) {
      await TransactionChat.create({
        transactionId: txn1.transactionId,
        sender: msg.sender,
        message: msg.message,
        createdAt: new Date(msg.ts),
      });
    }

    // --- TXN 2: COMPLETED (Closed) ---
    const txn2 = await Transaction.create({
      transactionId: 'TXN-20260002',
      requester: emp3._id,
      department: depts['Service']._id,
      teamLead: tl2._id,
      managementApprover: management._id,
      store: store._id,
      handler: handler._id,
      status: 'closed',
      documentType: 'RDC',
      priority: 'medium',
      description: 'Completed transaction - all items returned',
      totalItems: 3,
      activeItems: 0,
      returnedItems: 3,
      closedItems: 3,
      closedAt: new Date('2026-05-18T15:00:00'),
      materials: [
        { name: 'Sensor', quantity: 2, unit: 'pcs', barcodes: [{ barcode: 'SN200001', status: 'Returned', owner: store._id }, { barcode: 'SN200002', status: 'Returned', owner: store._id }] },
        { name: 'Cable Set', quantity: 1, unit: 'pcs', barcodes: [{ barcode: 'CB200001', status: 'Returned', owner: store._id }] },
      ],
      chatMembers: [emp3._id, tl2._id, store._id],
      chatLocked: true,
      approvalChain: [
        { user: tl2._id, role: 'team_lead', action: 'approved', remarks: 'TL Approved', timestamp: new Date('2026-05-14T10:00:00') },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved', timestamp: new Date('2026-05-14T10:30:00') },
      ],
      timeline: [
        { action: 'Request Created', description: 'Ravi Sharma created material request', user: emp3._id, timestamp: new Date('2026-05-14T09:00:00') },
        { action: 'Team Lead Approved', description: 'Approved by Rahul Deshmukh', user: tl2._id, timestamp: new Date('2026-05-14T10:00:00') },
        { action: 'Management Approved', description: 'Approved by Aditya Pise', user: management._id, timestamp: new Date('2026-05-14T10:30:00') },
        { action: 'Store Accepted', description: 'Store accepted the request', user: store._id, timestamp: new Date('2026-05-14T11:00:00') },
        { action: 'Handler Assigned', description: 'Rahul Handler assigned to dispatch', user: store._id, timestamp: new Date('2026-05-14T11:15:00') },
        { action: 'Dispatched', description: 'Items dispatched to requester by Rahul Handler', user: handler._id, timestamp: new Date('2026-05-15T09:00:00') },
        { action: 'Received', description: 'Ravi Sharma received all items', user: emp3._id, timestamp: new Date('2026-05-15T10:00:00') },
        { action: 'Returned', description: 'All items returned to store', user: emp3._id, timestamp: new Date('2026-05-18T14:00:00') },
        { action: 'Transaction Closed', description: 'All items returned to store', user: store._id, timestamp: new Date('2026-05-18T15:00:00') },
      ],
    });
    for (const bc of ['SN200001', 'SN200002', 'CB200001']) {
      await Barcode.create({
        barcode: bc, transactionId: txn2.transactionId, transaction: txn2._id,
        materialName: bc.startsWith('SN') ? 'Sensor' : 'Cable Set',
        status: 'Returned', owner: store._id, ownerDepartment: depts['Stores']._id,
        ownershipHistory: [
          { user: emp3._id, department: depts['Service']._id, action: 'received', remarks: 'Initial recipient' },
          { user: store._id, department: depts['Stores']._id, action: 'returned', remarks: 'Returned to store' }
        ],
        history: [
          { action: 'Request Created', user: emp3._id, timestamp: new Date('2026-05-14T09:00:00') },
          { action: 'Team Lead Approved', user: tl2._id, timestamp: new Date('2026-05-14T10:00:00') },
          { action: 'Store Accepted', user: store._id, timestamp: new Date('2026-05-14T11:00:00') },
          { action: 'Received', user: emp3._id, timestamp: new Date('2026-05-15T10:00:00') },
          { action: 'Returned', user: emp3._id, timestamp: new Date('2026-05-18T14:00:00') }
        ],
      });
    }
    console.log(`  ✓ ${txn2.transactionId}: Closed (3 items all returned)`);

    // --- TXN 3: PENDING TL Approval (Simplified Sourcing Request - No Barcodes) ---
    const txn3 = await Transaction.create({
      transactionId: 'TXN-20260003',
      requester: emp1._id, // Abhay - Engineering
      department: depts['Engineering']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'submitted',
      documentType: 'RDC',
      priority: 'medium',
      dueDate: new Date(Date.now() + 3 * 86400000),
      description: 'Calibration tools needed for machine setup',
      totalItems: 2,
      activeItems: 2,
      materials: [
        { name: 'Torque Wrench', quantity: 1, unit: 'Nos', barcodes: [] },
        { name: 'Dial Gauge', quantity: 1, unit: 'Nos', barcodes: [] },
      ],
      chatMembers: [emp1._id, tl1._id],
      timeline: [
        { action: 'Request Created', description: 'Abhay Mudgal created request', user: emp1._id, timestamp: new Date() },
      ],
    });
    console.log(`  ✓ ${txn3.transactionId}: Pending TL Approval (2 items - simplified)`);

    // --- TXN 4: Management Approved, awaiting store ready accept (Simplified - No Barcodes) ---
    const txn4 = await Transaction.create({
      transactionId: 'TXN-20260004',
      requester: emp4._id, // Priya - Engineering
      department: depts['Engineering']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'mgt_approved',
      documentType: 'RDC',
      priority: 'high',
      description: 'Replacement motor for production line',
      totalItems: 1,
      activeItems: 1,
      materials: [
        { name: 'AC Motor 5HP', quantity: 1, unit: 'Nos', barcodes: [] },
      ],
      chatMembers: [emp4._id, tl1._id, management._id, store._id],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'Urgent replacement needed' },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved' }
      ],
      timeline: [
        { action: 'Request Created', user: emp4._id, timestamp: new Date(Date.now() - 2 * 86400000) },
        { action: 'Team Lead Approved', user: tl1._id, timestamp: new Date(Date.now() - 1.5 * 86400000) },
        { action: 'Management Approved', user: management._id, timestamp: new Date(Date.now() - 1 * 86400000) }
      ],
    });
    console.log(`  ✓ ${txn4.transactionId}: Management Approved, ready for Store Accept (simplified)`);

    // --- TXN 5: In Progress - Store accepted, handler assigned (Barcodes registered by Store) ---
    const txn5 = await Transaction.create({
      transactionId: 'TXN-20260005',
      requester: emp2._id, // Sneha - Production
      department: depts['Production']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      store: store._id,
      handler: handler._id,
      status: 'handler_assigned',
      documentType: 'RDC',
      priority: 'critical',
      description: 'Emergency spare parts for production line 3',
      totalItems: 4,
      activeItems: 4,
      materials: [
        { name: 'Bearing 6205', quantity: 2, unit: 'pcs', barcodes: [{ barcode: 'BR500001', status: 'Active', owner: emp2._id }, { barcode: 'BR500002', status: 'Active', owner: emp2._id }] },
        { name: 'Coupling', quantity: 2, unit: 'pcs', barcodes: [{ barcode: 'CP500001', status: 'Active', owner: emp2._id }, { barcode: 'CP500002', status: 'Active', owner: emp2._id }] },
      ],
      chatMembers: [emp2._id, tl1._id, management._id, store._id, handler._id],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'Urgent' },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved' }
      ],
      timeline: [
        { action: 'Request Created', user: emp2._id },
        { action: 'Team Lead Approved', user: tl1._id },
        { action: 'Management Approved', user: management._id },
        { action: 'Store Accepted', user: store._id },
        { action: 'Handler Assigned', description: 'Rahul Handler assigned', user: store._id },
      ],
    });
    for (const bc of ['BR500001', 'BR500002', 'CP500001', 'CP500002']) {
      await Barcode.create({
        barcode: bc, transactionId: txn5.transactionId, transaction: txn5._id,
        materialName: bc.startsWith('BR') ? 'Bearing 6205' : 'Coupling',
        status: 'Active', owner: emp2._id, ownerDepartment: depts['Production']._id,
        history: [{ action: 'Request Created', user: emp2._id }],
      });
    }
    console.log(`  ✓ ${txn5.transactionId}: Handler Assigned (4 items, critical priority)`);

    // --- TXN 6: Rejected (Full rejection lifecycle) ---
    const txn6 = await Transaction.create({
      transactionId: 'TXN-20260006',
      requester: emp1._id,
      department: depts['Engineering']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'rejected',
      documentType: 'RDC',
      priority: 'low',
      description: 'Rejected - duplicate request for same items',
      rejectionReason: 'Duplicate request. Items already requested in TXN-20260003',
      totalItems: 1,
      materials: [
        { name: 'Torque Wrench', quantity: 1, unit: 'pcs', barcodes: [] },
      ],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'TL approved standard calibration request', timestamp: new Date('2026-05-14T10:00:00') },
        { user: management._id, role: 'management', action: 'rejected', remarks: 'Duplicate request. Items already requested in TXN-20260003', timestamp: new Date('2026-05-14T11:00:00') }
      ],
      timeline: [
        { action: 'Request Created', description: 'Abhay Mudgal created material request', user: emp1._id, timestamp: new Date('2026-05-14T09:00:00') },
        { action: 'Team Lead Approved', description: 'Approved by Prathmesh Joshi', user: tl1._id, timestamp: new Date('2026-05-14T10:00:00') },
        { action: 'Rejected', description: 'Rejected by Aditya Pise (Management). Reason: Duplicate request. Items already requested in TXN-20260003', user: management._id, timestamp: new Date('2026-05-14T11:00:00') },
      ],
    });
    console.log(`  ✓ ${txn6.transactionId}: Rejected`);

    // --- TXN 7: TL Approved, awaiting Management approval (Simplified - No Barcodes) ---
    const txn7 = await Transaction.create({
      transactionId: 'TXN-20260007',
      requester: emp1._id, // Abhay - Engineering
      department: depts['Engineering']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'tl_approved',
      documentType: 'RDC',
      priority: 'medium',
      description: 'Calibration sensors for new assembly unit',
      totalItems: 1,
      activeItems: 1,
      materials: [
        { name: 'Laser Sensor', quantity: 1, unit: 'Nos', barcodes: [] },
      ],
      chatMembers: [emp1._id, tl1._id],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'Sensor required for precision calibration' },
      ],
      timeline: [
        { action: 'Request Created', user: emp1._id, timestamp: new Date(Date.now() - 1 * 86400000) },
        { action: 'Team Lead Approved', user: tl1._id, timestamp: new Date() },
      ],
    });
    console.log(`  ✓ ${txn7.transactionId}: TL Approved, awaiting Management`);

    // ═══════════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════════
    console.log('\n── Seeding Notifications ──');
    const notifs = [
      { user: tl1._id, type: 'request_created', title: 'New Request', message: 'Abhay submitted TXN-20260003', transactionId: 'TXN-20260003' },
      { user: tl2._id, type: 'request_created', title: 'New Request', message: 'Ravi submitted TXN-20260001', transactionId: 'TXN-20260001' },
      { user: store._id, type: 'request_approved', title: 'Request Approved', message: 'TXN-20260001 approved, ready for store', transactionId: 'TXN-20260001' },
      { user: emp3._id, type: 'handler_assigned', title: 'Handler Assigned', message: 'Handler assigned for TXN-20260001', transactionId: 'TXN-20260001' },
      { user: emp1._id, type: 'request_rejected', title: 'Request Rejected', message: 'TXN-20260006 was rejected', transactionId: 'TXN-20260006', read: true },
      { user: tl1._id, type: 'request_created', title: 'New Request', message: 'Priya submitted TXN-20260004', transactionId: 'TXN-20260004' },
      { user: store._id, type: 'request_approved', title: 'Request Approved', message: 'TXN-20260005 approved', transactionId: 'TXN-20260005' },
      { user: handler._id, type: 'handler_assigned', title: 'Handler Assignment', message: 'You are assigned handler for TXN-20260005', transactionId: 'TXN-20260005' },
    ];
    for (const n of notifs) {
      await Notification.create(n);
    }
    console.log(`  ✓ ${notifs.length} notifications created`);

    // ═══════════════════════════════════════════
    // AUDIT LOGS
    // ═══════════════════════════════════════════
    console.log('\n── Seeding Audit Logs ──');
    const audits = [
      { action: 'CREATE', entity: 'Transaction', entityId: 'TXN-20260001', user: emp3._id, userName: 'Ravi Sharma', description: 'Created transaction with 6 items' },
      { action: 'APPROVE', entity: 'Transaction', entityId: 'TXN-20260001', user: tl2._id, userName: 'Rahul Deshmukh', description: 'TL approved' },
      { action: 'APPROVE', entity: 'Transaction', entityId: 'TXN-20260001', user: management._id, userName: 'Aditya Pise', description: 'Management approved' },
      { action: 'STORE_ACCEPT', entity: 'Transaction', entityId: 'TXN-20260001', user: store._id, userName: 'Ayush Patil', description: 'Store accepted' },
      { action: 'TRANSFER', entity: 'Barcode', entityId: 'PC120001', user: emp3._id, userName: 'Ravi Sharma', description: 'Transferred PC120001 to R&D Engineer' },
      { action: 'RETURN', entity: 'Barcode', entityId: 'PC120002', user: emp3._id, userName: 'Ravi Sharma', description: 'Returned PC120002 to store' },
    ];
    for (const a of audits) {
      await AuditLog.create(a);
    }
    console.log(`  ✓ ${audits.length} audit logs created`);

    // ═══════════════════════════════════════════
    // PRINT SUMMARY
    // ═══════════════════════════════════════════
    printSummary();

  } catch (error) {
    console.error('\n❌ Seed error:', error);
    process.exit(1);
  }
};

const printSummary = () => {
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('🌱 SEED COMPLETED SUCCESSFULLY!');
  console.log('══════════════════════════════════════════════════════════════════════');

  console.log('\n📊 SEEDED DATA SUMMARY:');
  console.log('  • 12 Departments');
  console.log('  • 14 Designations');
  console.log('  • 5 Locations');
  console.log('  • 13 Users (all roles)');
  console.log('  • 6 Transactions (various lifecycle stages)');
  console.log('  • 18 Barcodes');
  console.log('  • 7 Chat Messages');
  console.log('  • 8 Notifications');
  console.log('  • 6 Audit Logs');
  console.log('  • 2 Transfers');
  console.log('  • 2 Returns');

  console.log('\n🔐 LOGIN CREDENTIALS');
  console.log('┌─────────────────────┬──────────────────────┬──────────────┬─────────────────────────────┐');
  console.log('│ Name                │ Email                │ Password     │ Role                        │');
  console.log('├─────────────────────┼──────────────────────┼──────────────┼─────────────────────────────┤');
  console.log('│ Adesh Bhongale      │ admin@mms.com        │ Admin@1234   │ super_admin                 │');
  console.log('│ Ayush Patil     │ store@mms.com        │ Store@1234   │ department_admin (store)     │');
  console.log('│ Shreyas Kadam       │ accounts@mms.com     │ Acc@1234     │ department_admin (accounts)  │');
  console.log('│ Aditya Pise      │ management@mms.com   │ Mgt@1234     │ department_admin (management)│');
  console.log('│ Vikram Patil        │ production@mms.com   │ Prod@1234    │ department_admin (production)│');
  console.log('│ Prathmesh Joshi       │ teamlead@mms.com     │ Tl@1234      │ team_lead (Engineering)     │');
  console.log('│ Rahul Deshmukh      │ teamlead2@mms.com    │ Tl@1234      │ team_lead (Service)         │');
  console.log('│ Abhay Mudgal        │ abhay@mms.com        │ password123  │ employee (Engineering)      │');
  console.log('│ Sneha Kulkarni      │ sneha@mms.com        │ password123  │ employee (Production)       │');
  console.log('│ Ravi Sharma         │ ravi@mms.com         │ password123  │ employee (Service)          │');
  console.log('│ Priya Naik          │ priya@mms.com        │ password123  │ employee (Engineering)      │');
  console.log('│ Rahul Handler       │ handler@mms.com      │ password123  │ employee (Stores/Handler)   │');
  console.log('│ Amit R&D Engineer   │ rnd@mms.com          │ password123  │ employee (R&D)              │');
  console.log('└─────────────────────┴──────────────────────┴──────────────┴─────────────────────────────┘');

  console.log('\n📦 TRANSACTION STATUSES:');
  console.log('  • TXN-20260001: Active (6 items, 4 active, 2 returned, with transfers)');
  console.log('  • TXN-20260002: Closed (3 items, all returned)');
  console.log('  • TXN-20260003: Submitted (pending TL approval)');
  console.log('  • TXN-20260004: TL Approved (awaiting store)');
  console.log('  • TXN-20260005: Handler Assigned (critical priority)');
  console.log('  • TXN-20260006: Rejected');

  console.log('\n🔖 BARCODE STATUS LEGEND:');
  console.log('  • Active = Currently with an owner');
  console.log('  • Returned = Back in store inventory');
  console.log('  • Closed = Transaction closed/rejected\n');

  process.exit(0);
};

seedAll();
