/**
 * Admin Script - Creates ONLY Super Admin user
 * Run: npm run admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Ensure Management department exists
    let adminDept = await Department.findOne({ name: 'Management' });
    if (!adminDept) {
      adminDept = await Department.create({ name: 'Management', code: 'MGT' });
    }

    // Ensure Director designation exists
    let directorDesg = await Designation.findOne({ name: 'Director' });
    if (!directorDesg) {
      directorDesg = await Designation.create({ name: 'Director', level: 10 });
    }

    // Ensure Head Office location exists
    let headOffice = await Location.findOne({ name: 'Head Office' });
    if (!headOffice) {
      headOffice = await Location.create({
        name: 'Head Office',
        address: 'Mumbai, Maharashtra',
        coordinates: { lat: 19.076, lng: 72.8777 },
      });
    }

    // Create Super Admin
    await User.deleteOne({ employeeId: 'ADMIN001' });
    let admin = await User.create({
      employeeId: 'ADMIN001',
      fullName: 'Trucode Company',
      email: 'admin@mms.com',
      phone: '9999999959',
      password: 'Admin@1234',
      role: 'super_admin',
      departmentAdminType: null,
      department: adminDept._id,
      designation: directorDesg._id,
      workLocation: headOffice._id,
      status: 'active',
      mustChangePassword: false,
    });
    console.log('✅ Super Admin created successfully!');

    console.log('\n══════════════════════════════════════════');
    console.log('🔐 SUPER ADMIN CREDENTIALS');
    console.log('══════════════════════════════════════════');
    console.log('  Email:    admin@mms.com');
    console.log('  Password: Admin@1234');
    console.log('  Role:     super_admin');
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createAdmin();
