require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');

const seedAdminOnly = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/material-management');
    console.log('Connected to MongoDB');

    // Seed Departments (Required for Admin user)
    const departments = ['Engineering', 'Production', 'Quality', 'Stores', 'Purchase', 'Maintenance', 'HR', 'Finance', 'IT', 'Admin'];
    const deptDocs = [];
    for (const name of departments) {
      const existing = await Department.findOne({ name });
      if (!existing) {
        const dept = await Department.create({ name });
        deptDocs.push(dept);
        console.log(`  ✓ Department: ${name}`);
      } else {
        deptDocs.push(existing);
      }
    }

    // Seed Designations (Required for Admin user)
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
      }
    }

    // Seed Locations (Required for Admin user)
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
      }
    }

    // Seed Admin — role must be 'super_admin' (valid enum in User model)
    const adminExists = await User.findOne({ employeeId: 'ADMIN001' });
    if (!adminExists) {
      await User.create({
        employeeId: 'ADMIN001',
        fullName: 'System Administrator',
        email: 'admin@mms.com',
        phone: '9999999959',
        password: 'Admin@1234',
        department: deptDocs[0]._id,
        designation: desgDocs[0]._id,
        workLocation: locDocs[0]._id,
        role: 'super_admin',
        departmentAdminType: null,
        status: 'active',
        mustChangePassword: true,
        joiningDate: new Date(),
      });
      console.log('\n✓ Super Admin created:');
    } else {
      console.log('\n✓ Super Admin already exists');
    }

    console.log('\n🌱 Admin seeding completed successfully! No sample employees created.');
    process.exit(0);
  } catch (error) {
    console.error('Admin seed error:', error);
    process.exit(1);
  }
};

seedAdminOnly();
