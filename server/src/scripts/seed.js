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
    await Department.deleteMany({});
    const deptData = [
      { name: 'Software', code: 'SOFT' },
      { name: 'Production', code: 'PROD' },
      { name: 'Stores', code: 'STR' },
      { name: 'Purchase', code: 'PUR' },
      { name: 'HR', code: 'HR' },
      { name: 'Finance', code: 'FIN' },
      { name: 'R&D', code: 'RND' },
      { name: 'Service', code: 'SRV' },
      { name: 'Management', code: 'MGT' },
    ];
    const depts = {};
    for (const d of deptData) {
      let dept = await Department.create(d);
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
    console.log('\n── Seeding Users ──');
    await User.deleteMany({ role: { $ne: 'super_admin' } });

    const superAdminUser = await User.findOne({ role: 'super_admin' });
    if (superAdminUser) {
      superAdminUser.department = depts['Management']._id;
      superAdminUser.designation = desgs['Director']._id;
      superAdminUser.workLocation = locs['Head Office']._id;
      await superAdminUser.save();
    }

    const userSpecs = [];

    // 1. Management Admins
    userSpecs.push({
      employeeId: 'MGT001',
      fullName: 'Aditya Pise',
      email: 'management@mms.com',
      phone: '9876543212',
      password: 'password123',
      role: 'department_admin',
      departmentAdminType: 'management',
      dept: 'Management',
      desg: 'General Manager',
      loc: 'Head Office'
    });
    userSpecs.push({
      employeeId: 'MGT002',
      fullName: 'Minal Patil',
      email: 'minal@mms.com',
      phone: '9876543215',
      password: 'password123',
      role: 'department_admin',
      departmentAdminType: 'management',
      dept: 'Management',
      desg: 'Director',
      loc: 'Head Office'
    });
    userSpecs.push({
      employeeId: 'MGT003',
      fullName: 'Vikas Sir',
      email: 'vikas@mms.com',
      phone: '9876543216',
      password: 'password123',
      role: 'department_admin',
      departmentAdminType: 'management',
      dept: 'Management',
      desg: 'Director',
      loc: 'Head Office'
    });

    // Departments where we create exactly 1 employee, 1 team lead, and 1 department admin
    const normalDepts = [
      { name: 'Software', code: 'SOFT', adminType: null },
      { name: 'Production', code: 'PROD', adminType: 'production' },
      { name: 'Stores', code: 'STR', adminType: 'store' },
      { name: 'Purchase', code: 'PUR', adminType: 'purchase' },
      { name: 'HR', code: 'HR', adminType: 'hr' },
      { name: 'Finance', code: 'FIN', adminType: 'accounts' },
      { name: 'R&D', code: 'RND', adminType: null },
      { name: 'Service', code: 'SRV', adminType: null }
    ];

    // Helper map to reuse existing credentials/names where applicable so we don't break existing tests
    const keyUsers = {
      // Software
      'employee_Software': { employeeId: 'EMP001', fullName: 'Abhay Mudgal', email: 'abhay@mms.com', password: 'password123' },
      'team_lead_Software': { employeeId: 'TL001', fullName: 'Akshay Kusale', email: 'teamlead@mms.com', password: 'password123' },
      'department_admin_Software': { employeeId: 'ADM_SOFT', fullName: 'Adesh Bhongale', email: 'admin.soft@mms.com', password: 'password123' },
      // Production
      'department_admin_Production': { employeeId: 'PROD001', fullName: 'Bhushan Mahajan', email: 'production@mms.com', password: 'password123' },
      'employee_Production': { employeeId: 'EMP002', fullName: 'Sakshee Kapade', email: 'sneha@mms.com', password: 'password123' },
      'team_lead_Production': { employeeId: 'TL_PROD', fullName: 'Sanket Karande', email: 'teamlead.prod@mms.com', password: 'password123' },
      // Stores
      'department_admin_Stores': { employeeId: 'STORE001', fullName: 'GOKUL SHIRGAON', email: 'store@mms.com', password: 'password123' },
      'employee_Stores': { employeeId: 'HDL001', fullName: 'Shreyas', email: 'handler@mms.com', password: 'password123' },
      'team_lead_Stores': { employeeId: 'TL_STR', fullName: 'Sanket Kharade', email: 'teamlead.str@mms.com', password: 'password123' },
      // Purchase
      'employee_Purchase': { employeeId: 'EMP_PUR', fullName: 'Deepak Patil', email: 'employee.pur@mms.com', password: 'password123' },
      'team_lead_Purchase': { employeeId: 'TL_PUR', fullName: 'Devraj Powar', email: 'teamlead.pur@mms.com', password: 'password123' },
      'department_admin_Purchase': { employeeId: 'ADM_PUR', fullName: 'Meghraj Yadav', email: 'admin.pur@mms.com', password: 'password123' },
      // HR
      'employee_HR': { employeeId: 'EMP_HR', fullName: 'Mitali Lad', email: 'employee.hr@mms.com', password: 'password123' },
      'team_lead_HR': { employeeId: 'TL_HR', fullName: 'Mrunal Kudalkar', email: 'teamlead.hr@mms.com', password: 'password123' },
      'department_admin_HR': { employeeId: 'ADM_HR', fullName: 'Paramshivam J', email: 'admin.hr@mms.com', password: 'password123' },
      // Finance
      'department_admin_Finance': { employeeId: 'ACC001', fullName: 'Sachin Sherkhane', email: 'accounts@mms.com', password: 'password123' },
      'employee_Finance': { employeeId: 'EMP_FIN', fullName: 'Shubham Shinde', email: 'employee.fin@mms.com', password: 'password123' },
      'team_lead_Finance': { employeeId: 'TL_FIN', fullName: 'Siddharth Kattimani', email: 'teamlead.fin@mms.com', password: 'password123' },
      // R&D
      'employee_R&D': { employeeId: 'RND001', fullName: 'Ganesh Naik', email: 'rnd@mms.com', password: 'password123' },
      'team_lead_R&D': { employeeId: 'TL_RND', fullName: 'Imran Shaikh', email: 'teamlead.rnd@mms.com', password: 'password123' },
      'department_admin_R&D': { employeeId: 'ADM_RND', fullName: 'Prasanna Ghatage', email: 'admin.rnd@mms.com', password: 'password123' },
      // Service
      'team_lead_Service': { employeeId: 'TL002', fullName: 'Suraj Mane', email: 'teamlead2@mms.com', password: 'password123' },
      'employee_Service': { employeeId: 'EMP003', fullName: 'Ravi Sharma', email: 'ravi@mms.com', password: 'password123' },
      'department_admin_Service': { employeeId: 'ADM_SRV', fullName: 'Vasudeo Barhate', email: 'admin.srv@mms.com', password: 'password123' }
    };

    normalDepts.forEach((d) => {
      // Generate Employee
      const empKey = `employee_${d.name}`;
      if (keyUsers[empKey]) {
        userSpecs.push({
          ...keyUsers[empKey],
          phone: '9876543214',
          role: 'employee',
          departmentAdminType: null,
          dept: d.name,
          desg: 'Engineer',
          loc: 'Plant 1'
        });
      } else {
        userSpecs.push({
          employeeId: `EMP_${d.code}`,
          fullName: `${d.name} Employee`,
          email: `employee.${d.code.toLowerCase()}@mms.com`,
          phone: '9876543230',
          password: 'password123',
          role: 'employee',
          departmentAdminType: null,
          dept: d.name,
          desg: 'Engineer',
          loc: 'Plant 1'
        });
      }

      // Generate Team Lead
      const tlKey = `team_lead_${d.name}`;
      if (keyUsers[tlKey]) {
        userSpecs.push({
          ...keyUsers[tlKey],
          phone: '9876543213',
          role: 'team_lead',
          departmentAdminType: null,
          dept: d.name,
          desg: 'Supervisor',
          loc: 'Plant 1'
        });
      } else {
        userSpecs.push({
          employeeId: `TL_${d.code}`,
          fullName: `${d.name} Team Lead`,
          email: `teamlead.${d.code.toLowerCase()}@mms.com`,
          phone: '9876543231',
          password: 'password123',
          role: 'team_lead',
          departmentAdminType: null,
          dept: d.name,
          desg: 'Supervisor',
          loc: 'Plant 1'
        });
      }

      // Generate Department Admin
      const adminKey = `department_admin_${d.name}`;
      if (keyUsers[adminKey]) {
        userSpecs.push({
          ...keyUsers[adminKey],
          phone: '9876543211',
          role: 'department_admin',
          departmentAdminType: d.adminType,
          dept: d.name,
          desg: 'Manager',
          loc: 'Head Office'
        });
      } else {
        userSpecs.push({
          employeeId: `ADM_${d.code}`,
          fullName: `${d.name} Admin`,
          email: `admin.${d.code.toLowerCase()}@mms.com`,
          phone: '9876543232',
          password: 'password123',
          role: 'department_admin',
          departmentAdminType: d.adminType,
          dept: d.name,
          desg: 'Manager',
          loc: 'Head Office'
        });
      }
    });

    const users = {};
    for (const spec of userSpecs) {
      const user = await User.create({
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
      users[spec.employeeId] = user;
      console.log(`  ✓ ${spec.fullName} (${spec.employeeId}) [${spec.role}${spec.departmentAdminType ? '/' + spec.departmentAdminType : ''}]`);
    }

    // Convenience refs
    const admin = await User.findOne({ role: 'super_admin' }) || { _id: new mongoose.Types.ObjectId() };
    const store = users['STORE001'];
    const accounts = users['ACC001'];
    const management = users['MGT001'];
    const tl1 = users['TL001'];
    const tl2 = users['TL002'];
    const emp1 = users['EMP001']; // Abhay - Software
    const emp2 = users['EMP002']; // Sneha - Production
    const emp3 = users['EMP003']; // Ravi - Service
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
      createdAt: new Date('2026-06-10T09:00:00Z'),
      description: 'Service department requires Panel PC and Encoders for field installation',
      totalItems: 6,
      activeItems: 4,
      returnedItems: 2,
      materials: [
        {
          name: 'Panel PC', quantity: 2, unit: 'pcs', price: 45000,
          barcodes: [
            { barcode: 'PC120001', status: 'Active', owner: rndEng._id },
            { barcode: 'PC120002', status: 'Returned', owner: store._id },
          ],
        },
        {
          name: 'Encoder', quantity: 3, unit: 'pcs', price: 12000,
          barcodes: [
            { barcode: 'EN120031', status: 'Active', owner: rndEng._id },
            { barcode: 'EN120032', status: 'Returned', owner: store._id },
            { barcode: 'EN120033', status: 'Active', owner: emp3._id },
          ],
        },
        {
          name: 'Head', quantity: 1, unit: 'pcs', price: 8000,
          barcodes: [
            { barcode: 'HD120001', status: 'Active', owner: emp3._id },
          ],
        },
      ],
      chatMembers: [emp3._id, tl2._id, store._id, handler._id, management._id, admin._id],
      approvalChain: [
        { user: tl2._id, role: 'team_lead', action: 'approved', remarks: 'Approved for field work', timestamp: new Date('2026-06-10T10:30:00Z') },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved', timestamp: new Date('2026-06-11T14:15:00Z') },
      ],
      timeline: [
        { action: 'Request Created', description: 'Ravi Sharma created material request', user: emp3._id, timestamp: new Date('2026-06-10T09:00:00Z') },
        { action: 'Team Lead Approved', description: 'Approved by Rahul Deshmukh', user: tl2._id, timestamp: new Date('2026-06-10T10:30:00Z') },
        { action: 'Management Approved', description: 'Approved by Management', user: management._id, timestamp: new Date('2026-06-11T14:15:00Z') },
        { action: 'Store Accepted', description: 'Store accepted the request', user: store._id, timestamp: new Date('2026-06-11T16:00:00Z') },
        { action: 'Handler Assigned', description: 'Rahul Handler assigned', user: store._id, timestamp: new Date('2026-06-11T16:15:00Z') },
        { action: 'Dispatched', description: 'Items dispatched to requester', user: handler._id, timestamp: new Date('2026-06-12T10:00:00Z') },
        { action: 'Received', description: 'Ravi received all items', user: emp3._id, timestamp: new Date('2026-06-12T12:00:00Z') },
        { action: 'Transferred', description: 'PC120001 & EN120031 transferred to R&D Engineer', user: emp3._id, timestamp: new Date('2026-06-14T09:00:00Z') },
        { action: 'Returned', description: 'PC120002 returned to store', user: emp3._id, timestamp: new Date('2026-06-15T10:00:00Z') },
        { action: 'Returned', description: 'EN120032 returned to store', user: rndEng._id, timestamp: new Date('2026-06-16T11:00:00Z') },
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
        gps: {
          lat: 18.5204,
          lng: 73.8567,
          address: 'Pune, Maharashtra, India'
        },
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80',
            capturedAt: new Date('2026-06-12T12:00:00Z'),
            lat: 18.5204,
            lng: 73.8567,
            address: 'Pune, Maharashtra, India'
          }
        ],
        documents: [
          {
            name: 'Material_Inspection_Report.pdf',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'pdf',
            size: 10240,
            uploadedAt: new Date('2026-06-12T12:00:00Z')
          }
        ],
        createdAt: new Date('2026-06-10T09:00:00Z'),
        ownershipHistory: [
          { user: emp3._id, department: depts['Service']._id, action: 'received', remarks: 'Initial recipient' },
          ...(bc.owner.toString() !== emp3._id.toString()
            ? [{ user: bc.owner, department: bc.ownerDept, action: bc.status === 'Returned' ? 'returned' : 'transferred', remarks: bc.status === 'Returned' ? 'Returned to store' : 'Transferred' }]
            : []),
        ],
        history: [
          { action: 'Request Created', user: emp3._id, timestamp: new Date('2026-06-10T09:00:00Z') },
          { action: 'Team Lead Approved', user: tl2._id, timestamp: new Date('2026-06-10T10:30:00Z') },
          { action: 'Store Accepted', user: store._id, timestamp: new Date('2026-06-11T16:00:00Z') },
          { action: 'Handler Assigned', user: store._id, remarks: 'Rahul Handler', timestamp: new Date('2026-06-11T16:15:00Z') },
          { action: 'Dispatched', user: handler._id, timestamp: new Date('2026-06-12T10:00:00Z') },
          { action: 'Received', user: emp3._id, remarks: 'GPS & Photo Captured', timestamp: new Date('2026-06-12T12:00:00Z'), gps: { lat: 18.5204, lng: 73.8567, address: 'Pune, Maharashtra, India' } },
          ...(bc.owner.toString() !== emp3._id.toString()
            ? [
              { action: 'Transfer Initiated', user: emp3._id, remarks: `Transfer initiated to ${rndEng.fullName} (pending Management approval)`, timestamp: new Date('2026-06-13T09:00:00Z') },
              { action: 'Transfer Pending Management Approval', user: emp3._id, remarks: 'Awaiting management review/approval', timestamp: new Date('2026-06-13T09:05:00Z') },
              { action: 'Transfer Approved by Management', user: management._id, remarks: 'Management approved transfer request', timestamp: new Date('2026-06-14T09:00:00Z') },
              { action: 'Transfer Pending Acceptance', user: rndEng._id, remarks: 'Employee request pending recipient acceptance', timestamp: new Date('2026-06-14T09:05:00Z') },
              { action: 'Transfer Accepted', user: rndEng._id, remarks: 'Transfer accepted', timestamp: new Date('2026-06-14T10:00:00Z') }
            ]
            : []),
          ...(bc.status === 'Returned'
            ? [{ action: 'Returned to Store', user: emp3._id, remarks: 'Returned to store', timestamp: new Date('2026-06-15T10:00:00Z') }]
            : [])
        ],
      });
    }

    // Create transfers for TXN 1
    await Transfer.create({
      transactionId: txn1.transactionId,
      barcode: 'PC120001', fromUser: emp3._id, toUser: rndEng._id,
      fromDepartment: depts['Service']._id, toDepartment: depts['R&D']._id,
      type: 'cross_department', status: 'completed', requiresApproval: true,
      approvedBy: management._id, approvedAt: new Date('2026-06-14T09:00:00Z'),
      remarks: 'Transferred for R&D testing',
      createdAt: new Date('2026-06-13T09:00:00Z'),
    });
    await Transfer.create({
      transactionId: txn1.transactionId,
      barcode: 'EN120031', fromUser: emp3._id, toUser: rndEng._id,
      fromDepartment: depts['Service']._id, toDepartment: depts['R&D']._id,
      type: 'cross_department', status: 'completed', requiresApproval: true,
      approvedBy: management._id, approvedAt: new Date('2026-06-14T10:00:00Z'),
      remarks: 'Encoder for R&D analysis',
      createdAt: new Date('2026-06-13T10:00:00Z'),
    });

    // Create returns for TXN 1
    await Return.create({
      transactionId: txn1.transactionId, barcode: 'PC120002', fromUser: emp3._id,
      store: store._id, status: 'completed', condition: 'good',
      remarks: 'No longer needed', receivedAt: new Date('2026-06-15T10:00:00Z'),
      createdAt: new Date('2026-06-14T15:00:00Z'),
    });
    await Return.create({
      transactionId: txn1.transactionId, barcode: 'EN120032', fromUser: rndEng._id,
      store: store._id, status: 'completed', condition: 'good',
      remarks: 'Testing complete', receivedAt: new Date('2026-06-16T11:00:00Z'),
      createdAt: new Date('2026-06-15T16:00:00Z'),
    });

    // Chat messages for TXN 1
    const chatMsgs = [
      { sender: emp3._id, message: 'Request created for 6 items. Please review and approve.', ts: '2026-06-10T09:30:00Z' },
      { sender: tl2._id, message: 'Request approved.', ts: '2026-06-10T10:30:00Z' },
      { sender: store._id, message: 'Store accepted the request. Assigning handler.', ts: '2026-06-11T16:00:00Z' },
      { sender: handler._id, message: 'I have been assigned. Will pick up items and deliver shortly.', ts: '2026-06-11T16:20:00Z' },
      { sender: emp3._id, message: 'Items delivered to Service Engineer.', ts: '2026-06-12T12:00:00Z' },
      { sender: rndEng._id, message: 'Received EN120031. Thank you.', ts: '2026-06-14T12:30:00Z' },
      { sender: emp3._id, message: 'Returned PC120002 to store.', ts: '2026-06-15T10:00:00Z' },
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
      dueDate: new Date('2026-06-25T00:00:00Z'),
      priority: 'medium',
      createdAt: new Date('2026-06-18T10:00:00Z'),
      description: 'Completed transaction - all items returned',
      totalItems: 3,
      activeItems: 0,
      returnedItems: 3,
      closedItems: 3,
      closedAt: new Date('2026-06-25T16:00:00Z'),
      materials: [
        { name: 'Sensor', quantity: 2, unit: 'pcs', price: 3500, barcodes: [{ barcode: '200001', status: 'Returned', owner: store._id }, { barcode: '200002', status: 'Returned', owner: store._id }] },
        { name: 'Cable Set', quantity: 1, unit: 'pcs', price: 1500, barcodes: [{ barcode: '300001', status: 'Returned', owner: store._id }] },
      ],
      chatMembers: [emp3._id, tl2._id, store._id],
      chatLocked: true,
      approvalChain: [
        { user: tl2._id, role: 'team_lead', action: 'approved', remarks: 'TL Approved', timestamp: new Date('2026-06-18T11:00:00Z') },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved', timestamp: new Date('2026-06-18T14:30:00Z') },
      ],
      timeline: [
        { action: 'Request Created', description: 'Ravi Sharma created material request', user: emp3._id, timestamp: new Date('2026-06-18T10:00:00Z') },
        { action: 'Team Lead Approved', description: 'Approved by Rahul Deshmukh', user: tl2._id, timestamp: new Date('2026-06-18T11:00:00Z') },
        { action: 'Management Approved', description: 'Approved by Aditya Pise', user: management._id, timestamp: new Date('2026-06-18T14:30:00Z') },
        { action: 'Store Accepted', description: 'Store accepted the request', user: store._id, timestamp: new Date('2026-06-19T09:30:00Z') },
        { action: 'Handler Assigned', description: 'Rahul Handler assigned to dispatch', user: store._id, timestamp: new Date('2026-06-19T10:00:00Z') },
        { action: 'Dispatched', description: 'Items dispatched to requester by Rahul Handler', user: handler._id, timestamp: new Date('2026-06-20T11:00:00Z') },
        { action: 'Received', description: 'Ravi Sharma received all items', user: emp3._id, timestamp: new Date('2026-06-20T13:00:00Z') },
        { action: 'Returned', description: 'All items returned to store', user: emp3._id, timestamp: new Date('2026-06-25T15:00:00Z') },
        { action: 'Transaction Closed', description: 'All items returned to store', user: store._id, timestamp: new Date('2026-06-25T16:00:00Z') },
      ],
    });
    for (const bc of ['200001', '200002', '300001']) {
      await Barcode.create({
        barcode: bc, transactionId: txn2.transactionId, transaction: txn2._id,
        materialName: bc.startsWith('2') ? 'Sensor' : 'Cable Set',
        status: 'Returned', owner: store._id, ownerDepartment: depts['Stores']._id,
        gps: {
          lat: 18.5204,
          lng: 73.8567,
          address: 'Pune, Maharashtra, India'
        },
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80',
            capturedAt: new Date('2026-06-12T12:00:00Z'),
            lat: 18.5204,
            lng: 73.8567,
            address: 'Pune, Maharashtra, India'
          }
        ],
        documents: [
          {
            name: 'Material_Inspection_Report.pdf',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'pdf',
            size: 10240,
            uploadedAt: new Date('2026-06-12T12:00:00Z')
          }
        ],
        createdAt: new Date('2026-06-18T10:00:00Z'),
        ownershipHistory: [
          { user: emp3._id, department: depts['Service']._id, action: 'received', remarks: 'Initial recipient' },
          { user: store._id, department: depts['Stores']._id, action: 'returned', remarks: 'Returned to store' }
        ],
        history: [
          { action: 'Request Created', user: emp3._id, timestamp: new Date('2026-06-18T10:00:00Z') },
          { action: 'Team Lead Approved', user: tl2._id, timestamp: new Date('2026-06-18T11:00:00Z') },
          { action: 'Store Accepted', user: store._id, timestamp: new Date('2026-06-19T09:30:00Z') },
          { action: 'Received', user: emp3._id, timestamp: new Date('2026-06-20T13:00:00Z') },
          { action: 'Returned', user: emp3._id, timestamp: new Date('2026-06-25T15:00:00Z') }
        ],
      });
    }
    console.log(`  ✓ ${txn2.transactionId}: Closed (3 items all returned)`);

    // --- TXN 3: PENDING TL Approval (Simplified Sourcing Request - No Barcodes) ---
    const txn3 = await Transaction.create({
      transactionId: 'TXN-20260003',
      requester: emp1._id, // Abhay - Software
      department: depts['Software']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'submitted',
      documentType: 'RDC',
      priority: 'medium',
      dueDate: new Date(Date.now() + 3 * 86400000),
      createdAt: new Date('2026-07-02T14:00:00Z'),
      description: 'Calibration tools needed for machine setup',
      totalItems: 2,
      activeItems: 2,
      materials: [
        { name: 'Torque Wrench', quantity: 1, unit: 'Nos', price: 4500, barcodes: [] },
        { name: 'Dial Gauge', quantity: 1, unit: 'Nos', price: 2500, barcodes: [] },
      ],
      chatMembers: [emp1._id, tl1._id],
      timeline: [
        { action: 'Request Created', description: 'Abhay Mudgal created request', user: emp1._id, timestamp: new Date('2026-07-02T14:00:00Z') },
      ],
    });
    console.log(`  ✓ ${txn3.transactionId}: Pending TL Approval (2 items - simplified)`);

    // --- TXN 4: Management Approved, awaiting store ready accept (Simplified - No Barcodes) ---
    const txn4 = await Transaction.create({
      transactionId: 'TXN-20260004',
      requester: emp1._id, // Abhay - Software
      department: depts['Software']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'mgt_approved',
      documentType: 'RDC',
      dueDate: new Date('2026-07-05T00:00:00Z'),
      priority: 'high',
      createdAt: new Date('2026-06-28T09:00:00Z'),
      description: 'Replacement motor for production line',
      totalItems: 1,
      activeItems: 1,
      materials: [
        { name: 'AC Motor 5HP', quantity: 1, unit: 'Nos', price: 35000, barcodes: [] },
      ],
      chatMembers: [emp1._id, tl1._id, management._id, store._id],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'Urgent replacement needed', timestamp: new Date('2026-06-28T14:00:00Z') },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved', timestamp: new Date('2026-06-29T10:30:00Z') }
      ],
      timeline: [
        { action: 'Request Created', user: emp1._id, timestamp: new Date('2026-06-28T09:00:00Z') },
        { action: 'Team Lead Approved', user: tl1._id, timestamp: new Date('2026-06-28T14:00:00Z') },
        { action: 'Management Approved', user: management._id, timestamp: new Date('2026-06-29T10:30:00Z') }
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
      dueDate: new Date('2026-07-10T00:00:00Z'),
      priority: 'critical',
      createdAt: new Date('2026-06-30T08:30:00Z'),
      description: 'Emergency spare parts for production line 3',
      totalItems: 4,
      activeItems: 4,
      materials: [
        { name: 'Bearing 6205', quantity: 2, unit: 'pcs', price: 1200, barcodes: [{ barcode: '500001', status: 'Active', owner: emp2._id }, { barcode: '500002', status: 'Active', owner: emp2._id }] },
        { name: 'Coupling', quantity: 2, unit: 'pcs', price: 2800, barcodes: [{ barcode: '500003', status: 'Active', owner: emp2._id }, { barcode: '500004', status: 'Active', owner: emp2._id }] },
      ],
      chatMembers: [emp2._id, tl1._id, management._id, store._id, handler._id],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'Urgent', timestamp: new Date('2026-06-30T10:00:00Z') },
        { user: management._id, role: 'management', action: 'approved', remarks: 'Management approved', timestamp: new Date('2026-06-30T11:30:00Z') }
      ],
      timeline: [
        { action: 'Request Created', user: emp2._id, timestamp: new Date('2026-06-30T08:30:00Z') },
        { action: 'Team Lead Approved', user: tl1._id, timestamp: new Date('2026-06-30T10:00:00Z') },
        { action: 'Management Approved', user: management._id, timestamp: new Date('2026-06-30T11:30:00Z') },
        { action: 'Store Accepted', user: store._id, timestamp: new Date('2026-07-01T09:00:00Z') },
        { action: 'Handler Assigned', description: 'Rahul Handler assigned', user: store._id, timestamp: new Date('2026-07-01T09:30:00Z') },
      ],
    });
    for (const bc of ['500001', '500002', '500003', '500004']) {
      await Barcode.create({
        barcode: bc, transactionId: txn5.transactionId, transaction: txn5._id,
        materialName: bc.startsWith('500001') || bc.startsWith('500002') ? 'Bearing 6205' : 'Coupling',
        status: 'Active', owner: emp2._id, ownerDepartment: depts['Production']._id,
        gps: {
          lat: 18.5204,
          lng: 73.8567,
          address: 'Pune, Maharashtra, India'
        },
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80',
            capturedAt: new Date('2026-06-12T12:00:00Z'),
            lat: 18.5204,
            lng: 73.8567,
            address: 'Pune, Maharashtra, India'
          }
        ],
        documents: [
          {
            name: 'Material_Inspection_Report.pdf',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'pdf',
            size: 10240,
            uploadedAt: new Date('2026-06-12T12:00:00Z')
          }
        ],
        createdAt: new Date('2026-06-30T08:30:00Z'),
        history: [{ action: 'Request Created', user: emp2._id, timestamp: new Date('2026-06-30T08:30:00Z') }],
      });
    }
    console.log(`  ✓ ${txn5.transactionId}: Handler Assigned (4 items, critical priority)`);

    // --- TXN 6: Rejected (Full rejection lifecycle) ---
    const txn6 = await Transaction.create({
      transactionId: 'TXN-20260006',
      requester: emp1._id,
      department: depts['Software']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'rejected',
      documentType: 'RDC',
      dueDate: new Date('2026-06-30T00:00:00Z'),
      priority: 'low',
      createdAt: new Date('2026-06-24T10:00:00Z'),
      description: 'Rejected - duplicate request for same items',
      rejectionReason: 'Duplicate request. Items already requested in TXN-20260003',
      totalItems: 1,
      materials: [
        { name: 'Torque Wrench', quantity: 1, unit: 'pcs', price: 4500, barcodes: [] },
      ],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'TL approved standard calibration request', timestamp: new Date('2026-06-24T11:30:00Z') },
        { user: management._id, role: 'management', action: 'rejected', remarks: 'Duplicate request. Items already requested in TXN-20260003', timestamp: new Date('2026-06-24T15:00:00Z') }
      ],
      timeline: [
        { action: 'Request Created', description: 'Abhay Mudgal created material request', user: emp1._id, timestamp: new Date('2026-06-24T10:00:00Z') },
        { action: 'Team Lead Approved', description: 'Approved by Prathmesh Joshi', user: tl1._id, timestamp: new Date('2026-06-24T11:30:00Z') },
        { action: 'Rejected', description: 'Rejected by Aditya Pise (Management). Reason: Duplicate request. Items already requested in TXN-20260003', user: management._id, timestamp: new Date('2026-06-24T15:00:00Z') },
      ],
    });
    console.log(`  ✓ ${txn6.transactionId}: Rejected`);

    // --- TXN 7: TL Approved, awaiting Management approval (Simplified - No Barcodes) ---
    const txn7 = await Transaction.create({
      transactionId: 'TXN-20260007',
      requester: emp1._id, // Abhay - Software
      department: depts['Software']._id,
      teamLead: tl1._id,
      managementApprover: management._id,
      status: 'tl_approved',
      documentType: 'RDC',
      dueDate: new Date('2026-07-15T00:00:00Z'),
      priority: 'medium',
      createdAt: new Date('2026-07-01T15:00:00Z'),
      description: 'Calibration sensors for new assembly unit',
      totalItems: 1,
      activeItems: 1,
      materials: [
        { name: 'Laser Sensor', quantity: 1, unit: 'Nos', price: 18500, barcodes: [] },
      ],
      chatMembers: [emp1._id, tl1._id],
      approvalChain: [
        { user: tl1._id, role: 'team_lead', action: 'approved', remarks: 'Sensor required for precision calibration', timestamp: new Date('2026-07-02T10:00:00Z') },
      ],
      timeline: [
        { action: 'Request Created', user: emp1._id, timestamp: new Date('2026-07-01T15:00:00Z') },
        { action: 'Team Lead Approved', user: tl1._id, timestamp: new Date('2026-07-02T10:00:00Z') },
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
      { user: tl1._id, type: 'request_created', title: 'New Request', message: 'Abhay submitted TXN-20260004', transactionId: 'TXN-20260004' },
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
      { action: 'APPROVE', entity: 'Transaction', entityId: 'TXN-20260001', user: tl2._id, userName: 'Suraj Mane', description: 'TL approved' },
      { action: 'APPROVE', entity: 'Transaction', entityId: 'TXN-20260001', user: management._id, userName: 'Aditya Pise', description: 'Management approved' },
      { action: 'STORE_ACCEPT', entity: 'Transaction', entityId: 'TXN-20260001', user: store._id, userName: 'GOKUL SHIRGAON', description: 'Store accepted' },
      { action: 'TRANSFER', entity: 'Barcode', entityId: '120001', user: emp3._id, userName: 'Ravi Sharma', description: 'Transferred 120001 to R&D Engineer' },
      { action: 'RETURN', entity: 'Barcode', entityId: '120002', user: emp3._id, userName: 'Ravi Sharma', description: 'Returned 120002 to store' },
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
  console.log('│ GOKUL SHIRGAON      │ store@mms.com        │ password123  │ department_admin (store)    │');
  console.log('│ Sachin Sherkhane    │ accounts@mms.com     │ password123  │ department_admin (accounts) │');
  console.log('│ Bhushan Mahajan     │ production@mms.com   │ password123  │ department_admin (production)│');
  console.log('├─────────────────────┼──────────────────────┼──────────────┼─────────────────────────────┤');
  console.log('│ Aditya Pise         │ management@mms.com   │ password123  │ department_admin (management)│');
  console.log('│ Minal Patil         │ minal@mms.com        │ password123  │ department_admin (management)│');
  console.log('│ Vikas Sir           │ vikas@mms.com        │ password123  │ department_admin (management)│');
  console.log('├─────────────────────┼──────────────────────┼──────────────┼─────────────────────────────┤');
  console.log('│ Akshay Kusale       │ teamlead@mms.com     │ password123  │ team_lead (Software)        │');
  console.log('│ Suraj Mane          │ teamlead2@mms.com    │ password123  │ team_lead (Service)         │');
  console.log('│ Sanket Kharade      │ teamlead.str@mms.com │ password123  │ team_lead (Stores)          │');
  console.log('├─────────────────────┼──────────────────────┼──────────────┼─────────────────────────────┤');
  console.log('│ Abhay Mudgal        │ abhay@mms.com        │ password123  │ employee (Software)         │');
  console.log('│ Sakshee Kapade      │ sneha@mms.com        │ password123  │ employee (Production)       │');
  console.log('│ Ravi Sharma         │ ravi@mms.com         │ password123  │ employee (Service)          │');
  console.log('│ Shreyas             │ handler@mms.com      │ password123  │ employee (Stores/Handler)   │');
  console.log('│ Ganesh Naik         │ rnd@mms.com          │ password123  │ employee (R&D)              │');
  console.log('└─────────────────────┴──────────────────────┴──────────────┴─────────────────────────────┘');
  console.log('\n💡 Note: All other departments have credentials matching:');
  console.log('  • Employee: employee.<dept_code>@mms.com (Password: password123)');
  console.log('  • Team Lead: teamlead.<dept_code>@mms.com (Password: password123)');
  console.log('  • Admin: admin.<dept_code>@mms.com (Password: password123)');

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
