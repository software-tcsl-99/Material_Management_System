const User = require('../models/User');
const { createAuditLog } = require('../middleware/audit.middleware');
const { uploadToCloudinary } = require('../config/cloudinary');
const { emitToUser } = require('../config/socket');

// GET /api/employees
const getEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, department, status } = req.query;
    const query = {};

    if (req.user?.role !== 'super_admin') {
      query.role = { $ne: 'super_admin' };
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (department) query.department = department;
    if (status) query.status = status;

    const employees = await User.find(query)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Return response in `data` envelope so frontend components expecting `response.data.data` work
    res.json({
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/employees/:id
const getEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name address coordinates');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (employee.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied to super admin record.' });
    }

    // Return single employee inside `data` for consistency with list endpoint
    res.json({ data: employee });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/employees
const createEmployee = async (req, res) => {
  try {
    const { employeeId, fullName, email, phone, department, designation, workLocation, role, joiningDate } = req.body;

    const existing = await User.findOne({
      $or: [{ employeeId: employeeId.toUpperCase() }, { email: email.toLowerCase() }],
    });

    if (existing) {
      return res.status(400).json({ message: 'Employee ID or email already exists.' });
    }

    // Generate default password
    const defaultPassword = `${employeeId.toUpperCase()}@${new Date().getFullYear()}`;

    const employee = new User({
      employeeId: employeeId.toUpperCase(),
      fullName,
      email: email.toLowerCase(),
      phone,
      password: defaultPassword,
      department,
      designation,
      workLocation,
      role: role || 'employee',
      joiningDate: joiningDate || new Date(),
      mustChangePassword: true,
    });

    await employee.save();

    await createAuditLog({
      user: req.user._id,
      action: 'create',
      entity: 'User',
      entityId: employee.employeeId,
      newData: { employeeId: employee.employeeId, fullName, email, role },
      req,
    });

    const populated = await User.findById(employee._id)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name');

    res.status(201).json({
      employee: populated,
      defaultPassword,
      message: 'Employee created successfully.',
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (employee.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied to super admin record.' });
    }

    const oldData = employee.toJSON();
    const { fullName, email, phone, department, designation, workLocation, role, joiningDate } = req.body;

    if (email && email.toLowerCase() !== employee.email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: employee._id } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use.' });
      }
    }

    Object.assign(employee, {
      ...(fullName && { fullName }),
      ...(email && { email: email.toLowerCase() }),
      ...(phone && { phone }),
      ...(department && { department }),
      ...(designation && { designation }),
      ...(workLocation && { workLocation }),
      ...(role && { role }),
      ...(joiningDate && { joiningDate }),
    });

    await employee.save();

    await createAuditLog({
      user: req.user._id,
      action: 'edit',
      entity: 'User',
      entityId: employee.employeeId,
      oldData,
      newData: employee.toJSON(),
      req,
    });

    const populated = await User.findById(employee._id)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name address coordinates');

    // Emit socket event to reflect changes instantly on the updated user's active session
    emitToUser(employee._id.toString(), 'employee:updated', populated.toJSON());

    res.json({ employee: populated, message: 'Employee updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/employees/:id/status
const toggleEmployeeStatus = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (employee.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied to super admin record.' });
    }

    const oldStatus = employee.status;
    employee.status = employee.status === 'active' ? 'disabled' : 'active';

    if (employee.status === 'disabled') {
      employee.sessionVersion = (employee.sessionVersion || 0) + 1;
      employee.refreshTokens = [];
    }

    await employee.save();

    await createAuditLog({
      user: req.user._id,
      action: 'edit',
      entity: 'User',
      entityId: employee.employeeId,
      oldData: { status: oldStatus },
      newData: { status: employee.status },
      req,
    });

    if (employee.status === 'disabled') {
      emitToUser(employee._id.toString(), 'session:invalid', { message: 'Your account has been disabled by an administrator.' });
    } else {
      const populated = await User.findById(employee._id)
        .populate('department', 'name')
        .populate('designation', 'name')
        .populate('workLocation', 'name address coordinates');
      emitToUser(employee._id.toString(), 'employee:updated', populated.toJSON());
    }

    res.json({ employee, message: `Employee ${employee.status === 'active' ? 'enabled' : 'disabled'} successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PATCH /api/employees/:id/reset-password
const resetPassword = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (employee.role === 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied to super admin record.' });
    }

    const newPassword = `${employee.employeeId}@${new Date().getFullYear()}`;
    employee.password = newPassword;
    employee.mustChangePassword = true;
    employee.sessionVersion = (employee.sessionVersion || 0) + 1;
    employee.refreshTokens = [];
    await employee.save();

    await createAuditLog({
      user: req.user._id,
      action: 'edit',
      entity: 'User',
      entityId: employee.employeeId,
      newData: { action: 'password_reset' },
      req,
    });

    emitToUser(employee._id.toString(), 'session:invalid', { message: 'Password has been reset by an administrator.' });

    res.json({ message: 'Password reset successfully.', defaultPassword: newPassword });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// PUT /api/employees/profile
const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const { fullName, phone, email } = req.body;

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use.' });
      }
      user.email = email.toLowerCase();
    }

    if (fullName && fullName.trim()) user.fullName = fullName.trim();
    if (phone) user.phone = phone;
    await user.save();

    // Re-fetch with populated fields so frontend gets full data
    const populated = await User.findById(user._id)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name address coordinates');

    // Emit socket event so all pages reflect the change in real-time
    emitToUser(user._id.toString(), 'employee:updated', populated.toJSON());

    res.json({ user: populated, message: 'Profile updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// POST /api/employees/profile-photo
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'mms/profiles');
    req.user.profilePhoto = result.secure_url;
    await req.user.save();

    res.json({ url: result.secure_url, message: 'Profile photo updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed.', error: error.message });
  }
};

const uploadEmployeesCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const fileContent = req.file.buffer.toString('utf8');
    const lines = fileContent.split(/\r?\n/);
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV file is empty or lacks headers.' });
    }

    // Extract headers (case-insensitive & trimmed)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

    const empIdIdx = headers.indexOf('employeeid');
    const fullNameIdx = headers.indexOf('fullname');
    const emailIdx = headers.indexOf('email');
    const phoneIdx = headers.indexOf('phone');
    const roleIdx = headers.indexOf('role');
    const deptIdx = headers.indexOf('department');
    const desigIdx = headers.indexOf('designation');
    const locIdx = headers.indexOf('worklocation');

    if (empIdIdx === -1 || fullNameIdx === -1 || emailIdx === -1 || phoneIdx === -1) {
      return res.status(400).json({
        message: 'Invalid CSV format. Must include "employeeId", "fullName", "email", and "phone" columns.',
      });
    }

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    const Department = require('../models/Department');
    const Designation = require('../models/Designation');
    const Location = require('../models/Location');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse columns taking quotes into account
      const values = [];
      let current = '';
      let inQuotes = false;
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));

      const employeeIdVal = values[empIdIdx]?.trim().toUpperCase();
      const fullNameVal = values[fullNameIdx]?.trim();
      const emailVal = values[emailIdx]?.trim().toLowerCase();
      const phoneVal = values[phoneIdx]?.trim();

      if (!employeeIdVal || !fullNameVal || !emailVal) {
        skippedCount++;
        continue;
      }

      // Check duplicate in DB
      const exists = await User.findOne({
        $or: [{ employeeId: employeeIdVal }, { email: emailVal }],
      });
      if (exists) {
        skippedCount++;
        continue;
      }

      const roleValRaw = roleIdx !== -1 ? values[roleIdx]?.trim().toLowerCase() : 'employee';
      // Restrict role to admin/employee. Do NOT allow super_admin!
      const roleVal = roleValRaw === 'admin' ? 'admin' : 'employee';

      const deptName = deptIdx !== -1 ? values[deptIdx]?.trim() : '';
      const desigName = desigIdx !== -1 ? values[desigIdx]?.trim() : '';
      const locName = locIdx !== -1 ? values[locIdx]?.trim() : '';

      try {
        // Resolve references
        let deptId = null;
        if (deptName) {
          let dept = await Department.findOne({ name: { $regex: new RegExp(`^${deptName}$`, 'i') } });
          if (!dept) {
            dept = await Department.create({ name: deptName, status: 'active', createdBy: req.user._id });
          }
          deptId = dept._id;
        }

        let desigId = null;
        if (desigName) {
          let desig = await Designation.findOne({ name: { $regex: new RegExp(`^${desigName}$`, 'i') } });
          if (!desig) {
            desig = await Designation.create({ name: desigName, status: 'active', createdBy: req.user._id });
          }
          desigId = desig._id;
        }

        let locId = null;
        if (locName) {
          let loc = await Location.findOne({ name: { $regex: new RegExp(`^${locName}$`, 'i') } });
          if (!loc) {
            loc = await Location.create({
              name: locName,
              status: 'active',
              createdBy: req.user._id,
            });
          }
          locId = loc._id;
        }

        // Generate default password
        const defaultPassword = `${employeeIdVal}@${new Date().getFullYear()}`;

        const employee = new User({
          employeeId: employeeIdVal,
          fullName: fullNameVal,
          email: emailVal,
          phone: phoneVal || '—',
          password: defaultPassword,
          role: roleVal,
          department: deptId || (await Department.findOne())?._id, // fallback if empty
          designation: desigId || (await Designation.findOne())?._id,
          workLocation: locId || (await Location.findOne())?._id,
          mustChangePassword: true,
        });

        // Ensure we have resolved IDs, if not throw
        if (!employee.department || !employee.designation || !employee.workLocation) {
          throw new Error('Default Department, Designation, or Work Location could not be resolved.');
        }

        await employee.save();

        await createAuditLog({
          user: req.user._id,
          action: 'create',
          entity: 'User',
          entityId: employee.employeeId,
          newData: { employeeId: employee.employeeId, fullName: employee.fullName, email: employee.email, role: employee.role },
          req,
        });

        createdCount++;
      } catch (err) {
        errors.push(`Row ${i + 1} (${employeeIdVal}): ${err.message}`);
        skippedCount++;
      }
    }

    return res.json({
      message: `Employee CSV upload completed. Created: ${createdCount}, Skipped/Duplicates: ${skippedCount}`,
      errors,
    });
  } catch (error) {
    console.error('Upload employees CSV error:', error);
    return res.status(500).json({ message: 'Server error parsing CSV.', error: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  resetPassword,
  updateProfile,
  uploadProfilePhoto,
  uploadEmployeesCSV,
};
