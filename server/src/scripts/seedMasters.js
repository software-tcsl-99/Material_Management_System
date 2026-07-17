/**
 * Seed Masters Script - Seeds ONLY designations, departments, locations, and employees/users
 * Run: npm run seed:masters
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');

const seedMasters = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Clear existing Collections for User, Department, Designation
    console.log('Wiping existing Users (except super_admin), Departments, and Designations...');
    await User.deleteMany({ role: { $ne: 'super_admin' } });
    await Department.deleteMany({});
    await Designation.deleteMany({});

    // 2. Ensure default Location exists (required field on User)
    console.log('Setting up Location...');
    let headOffice = await Location.findOne({ name: 'Head Office' });
    if (!headOffice) {
      headOffice = await Location.create({
        name: 'Head Office',
        address: 'Mumbai, Maharashtra',
        coordinates: { lat: 19.076, lng: 72.8777 }
      });
    }

    // 3. Seed Departments
    console.log('Seeding Departments...');
    const deptSpecs = [
      { name: 'Management', code: 'MGT' },
      { name: 'Accounts', code: 'ACCT' },
      { name: 'Software', code: 'SOFT' },
      { name: 'Service', code: 'SRV' },
      { name: 'R&D', code: 'RND' },
      { name: 'Store', code: 'STR' },
      { name: 'Production', code: 'PROD' }
    ];
    const depts = {};
    for (const spec of deptSpecs) {
      const dept = await Department.create(spec);
      depts[spec.name] = dept;
      console.log(`  ✓ Department: ${spec.name} (${spec.code})`);
    }

    // 4. Seed Designations
    console.log('Seeding Designations...');
    const desgSpecs = [
      { name: 'Director', level: 10 },
      { name: 'Manager', level: 8 },
      { name: 'Team Lead', level: 6 },
      { name: 'Engineer', level: 4 }
    ];
    const desgs = {};
    for (const spec of desgSpecs) {
      const desg = await Designation.create(spec);
      desgs[spec.name] = desg;
      console.log(`  ✓ Designation: ${spec.name} (level ${spec.level})`);
    }

    // Update existing Super Admin references if it exists
    const superAdmin = await User.findOne({ role: 'super_admin' });
    if (superAdmin) {
      superAdmin.department = depts['Management']._id;
      superAdmin.designation = desgs['Director']._id;
      superAdmin.workLocation = headOffice._id;
      await superAdmin.save();
      console.log('  ✓ Updated existing Super Admin references');
    }

    // 5. Seed Users / Employees
    console.log('Seeding Employees & Admins...');
    const userSpecs = [
      // Management Admins
      { fullName: 'Aditya Pise', role: 'department_admin', departmentAdminType: 'management', dept: 'Management', desg: 'Director', employeeId: 'MGT001', email: 'aditya@ims.com', phone: '9876543201', password: 'password123' },
      { fullName: 'Minal Patil', role: 'department_admin', departmentAdminType: 'management', dept: 'Management', desg: 'Director', employeeId: 'MGT002', email: 'minal@ims.com', phone: '9876543202', password: 'password123' },
      { fullName: 'Vikas Sir', role: 'department_admin', departmentAdminType: 'management', dept: 'Management', desg: 'Director', employeeId: 'MGT003', email: 'vikas@ims.com', phone: '9876543203', password: 'password123' },
      { fullName: 'Nirmal Sir', role: 'department_admin', departmentAdminType: 'management', dept: 'Management', desg: 'Director', employeeId: 'MGT004', email: 'nirmal@ims.com', phone: '9876543204', password: 'password123' },
      { fullName: 'Nikhil Sir', role: 'department_admin', departmentAdminType: 'management', dept: 'Management', desg: 'Director', employeeId: 'MGT005', email: 'nikhil@ims.com', phone: '9876543205', password: 'password123' },

      // Accounts Admin
      { fullName: 'Account Head', role: 'department_admin', departmentAdminType: 'accounts', dept: 'Accounts', desg: 'Manager', employeeId: 'ACC001', email: 'account@ims.com', phone: '9876543206', password: 'password123' },

      // Software Department
      { fullName: 'Software', role: 'department_admin', departmentAdminType: 'software', dept: 'Software', desg: 'Manager', employeeId: 'SOFT001', email: 'software.admin@ims.com', phone: '9876543207', password: 'password123' },
      { fullName: 'Prathmesh Joshi', role: 'team_lead', departmentAdminType: null, dept: 'Software', desg: 'Team Lead', employeeId: 'SOFT002', email: 'prathmesh@ims.com', phone: '9876543208', password: 'password123' },
      { fullName: 'Adesh', role: 'employee', departmentAdminType: null, dept: 'Software', desg: 'Engineer', employeeId: 'SOFT003', email: 'adesh@ims.com', phone: '9876543209', password: 'password123' },
      { fullName: 'Mrunal Kudalkar', role: 'employee', departmentAdminType: null, dept: 'Software', desg: 'Engineer', employeeId: 'SOFT004', email: 'mrunal@ims.com', phone: '9876543210', password: 'password123' },

      // Service Department
      { fullName: 'Service Location', role: 'department_admin', departmentAdminType: 'service', dept: 'Service', desg: 'Manager', employeeId: 'SRV001', email: 'service.admin@ims.com', phone: '9876543211', password: 'password123' },
      { fullName: 'Abhay Mudgal', role: 'team_lead', departmentAdminType: null, dept: 'Service', desg: 'Team Lead', employeeId: 'SRV002', email: 'abhay@ims.com', phone: '9876543212', password: 'password123' },
      { fullName: 'Suraj Mane', role: 'employee', departmentAdminType: null, dept: 'Service', desg: 'Engineer', employeeId: 'SRV003', email: 'suraj.m@ims.com', phone: '9876543213', password: 'password123' },
      { fullName: 'Suraj Ghodake', role: 'employee', departmentAdminType: null, dept: 'Service', desg: 'Engineer', employeeId: 'SRV004', email: 'suraj.g@ims.com', phone: '9876543214', password: 'password123' },

      // R&D Department
      { fullName: 'R&D', role: 'department_admin', departmentAdminType: 'rnd', dept: 'R&D', desg: 'Manager', employeeId: 'RND001', email: 'rnd.admin@ims.com', phone: '9876543215', password: 'password123' },
      { fullName: 'Sanket Kharade', role: 'team_lead', departmentAdminType: null, dept: 'R&D', desg: 'Team Lead', employeeId: 'RND002', email: 'sanket.kh@ims.com', phone: '9876543216', password: 'password123' },
      { fullName: 'Devraj Powar', role: 'employee', departmentAdminType: null, dept: 'R&D', desg: 'Engineer', employeeId: 'RND003', email: 'devraj@ims.com', phone: '9876543217', password: 'password123' },
      { fullName: 'Akshay Kusale', role: 'employee', departmentAdminType: null, dept: 'R&D', desg: 'Engineer', employeeId: 'RND004', email: 'akshay@ims.com', phone: '9876543218', password: 'password123' },

      // Store Department
      { fullName: 'Gokul Shirgaon', role: 'department_admin', departmentAdminType: 'store', dept: 'Store', desg: 'Manager', employeeId: 'STR001', email: 'store@ims.com', phone: '9876543219', password: 'password123' },
      { fullName: 'Ayush Patil', role: 'team_lead', departmentAdminType: null, dept: 'Store', desg: 'Team Lead', employeeId: 'STR002', email: 'ayush@ims.com', phone: '9876543220', password: 'password123' },
      { fullName: 'Ganesh Naik', role: 'employee', departmentAdminType: null, dept: 'Store', desg: 'Engineer', employeeId: 'STR003', email: 'ganesh@ims.com', phone: '9876543221', password: 'password123' },
      { fullName: 'Ravi Sharma', role: 'employee', departmentAdminType: null, dept: 'Store', desg: 'Engineer', employeeId: 'STR004', email: 'ravi@ims.com', phone: '9876543222', password: 'password123' },

      // Production Department
      { fullName: 'Design Head', role: 'department_admin', departmentAdminType: 'production', dept: 'Production', desg: 'Manager', employeeId: 'PRD001', email: 'design.admin@ims.com', phone: '9876543223', password: 'password123' },
      { fullName: 'Imran Shaikh', role: 'team_lead', departmentAdminType: null, dept: 'Production', desg: 'Team Lead', employeeId: 'PRD002', email: 'imran@ims.com', phone: '9876543224', password: 'password123' },
      { fullName: 'Sanket Karande', role: 'employee', departmentAdminType: null, dept: 'Production', desg: 'Engineer', employeeId: 'PRD003', email: 'sanket.ka@ims.com', phone: '9876543225', password: 'password123' },
      { fullName: 'Shreyas Kadam', role: 'employee', departmentAdminType: null, dept: 'Production', desg: 'Engineer', employeeId: 'PRD004', email: 'shreyas@ims.com', phone: '9876543226', password: 'password123' }
    ];

    for (const spec of userSpecs) {
      await User.create({
        employeeId: spec.employeeId,
        fullName: spec.fullName,
        email: spec.email,
        phone: spec.phone,
        password: spec.password,
        role: spec.role,
        departmentAdminType: spec.departmentAdminType,
        department: depts[spec.dept]._id,
        designation: desgs[spec.desg]._id,
        workLocation: headOffice._id,
        status: 'active',
        mustChangePassword: false
      });
      console.log(`  ✓ Employee: ${spec.fullName} (${spec.employeeId}) [${spec.role}]`);
    }

    console.log('\nMaster seeding successfully completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error during master seeding:', error);
    process.exit(1);
  }
};

seedMasters();
