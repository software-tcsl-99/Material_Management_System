const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

exports.getEmployees = async (req, res) => {
  try {
    const { department, role, status, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (req.user.role === 'department_admin' && req.query.allDepartments !== 'true') {
      filter.department = req.user.department._id || req.user.department;
    }

    if (department) filter.department = department;
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      User.find(filter)
        .populate('department', 'name')
        .populate('designation', 'name')
        .populate('workLocation', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      data: employees, // Added for frontend compatibility
      employees,
      total,
      page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name');

    if (!user) return res.status(404).json({ message: 'Employee not found.' });
    res.json({
      data: user, // Added for frontend compatibility
      employee: user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { employeeId, fullName, email, phone, password, department, designation, workLocation, role } = req.body;

    if (role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot create another Super Admin user.' });
    }

    const existing = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existing) return res.status(400).json({ message: 'Employee ID or email already exists.' });

    let finalRole = role || 'employee';
    let departmentAdminType = null;
    if (role === 'management') {
      finalRole = 'department_admin';
      departmentAdminType = 'management';
    } else if (role === 'department_admin') {
      const Department = require('../models/Department');
      const dept = await Department.findById(department);
      if (dept) {
        const name = dept.name.toLowerCase();
        if (name.includes('store')) departmentAdminType = 'store';
        else if (name.includes('finance')) departmentAdminType = 'accounts';
        else if (name.includes('management')) departmentAdminType = 'management';
        else if (name.includes('production')) departmentAdminType = 'production';
        else if (name.includes('quality')) departmentAdminType = 'quality';
        else if (name.includes('maintenance')) departmentAdminType = 'maintenance';
        else if (name.includes('purchase')) departmentAdminType = 'purchase';
        else if (name.includes('hr')) departmentAdminType = 'hr';
        else if (name.includes('it')) departmentAdminType = 'it';
      }
    }

    const user = await User.create({
      employeeId, fullName, email, phone,
      password: password || 'password123',
      department, designation, workLocation,
      role: finalRole,
      departmentAdminType,
    });

    await AuditLog.create({
      action: 'CREATE',
      entity: 'User',
      entityId: user._id.toString(),
      user: req.user._id,
      userName: req.user.fullName,
      description: `Created user ${fullName} (${employeeId})`,
    });

    res.status(201).json({ message: 'Employee created.', employee: user });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    const updates = req.body;
    delete updates.password; // Don't allow password update here

    if (req.user.role !== 'super_admin') {
      const restrictedFields = ['fullName', 'email', 'employeeId', 'department', 'designation', 'role', 'status', 'departmentAdminType', 'workLocation', 'phone'];
      const attemptedToChangeRestricted = restrictedFields.some(field => {
        if (updates[field] === undefined) return false;
        const oldVal = user[field] ? user[field].toString() : '';
        const newVal = updates[field] ? updates[field].toString() : '';
        return oldVal !== newVal;
      });
      if (attemptedToChangeRestricted) {
        return res.status(403).json({ message: 'Only Super Admin can change employee profile info (names, email, department, designation, etc.). Other users can only change password.' });
      }
    }

    if (updates.role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot promote a user to Super Admin.' });
    }

    if (user.role === 'super_admin' && updates.role && updates.role !== 'super_admin') {
      return res.status(400).json({ message: 'Cannot change the role of the Super Admin user.' });
    }

    // Auto update departmentAdminType if role or department changed
    const inputRole = updates.role !== undefined ? updates.role : user.role;
    const finalDept = updates.department !== undefined ? updates.department : user.department;

    if (inputRole === 'management') {
      updates.role = 'department_admin';
      updates.departmentAdminType = 'management';
    } else if (inputRole === 'department_admin') {
      updates.role = 'department_admin';
      const Department = require('../models/Department');
      const dept = await Department.findById(finalDept);
      if (dept) {
        const name = dept.name.toLowerCase();
        if (name.includes('store')) updates.departmentAdminType = 'store';
        else if (name.includes('finance')) updates.departmentAdminType = 'accounts';
        else if (name.includes('management')) updates.departmentAdminType = 'management';
        else if (name.includes('production')) updates.departmentAdminType = 'production';
        else if (name.includes('quality')) updates.departmentAdminType = 'quality';
        else if (name.includes('maintenance')) updates.departmentAdminType = 'maintenance';
        else if (name.includes('purchase')) updates.departmentAdminType = 'purchase';
        else if (name.includes('hr')) updates.departmentAdminType = 'hr';
        else if (name.includes('it')) updates.departmentAdminType = 'it';
        else updates.departmentAdminType = null;
      }
    } else {
      if (updates.role !== undefined) {
        updates.departmentAdminType = null;
      }
    }

    Object.assign(user, updates);
    await user.save();

    res.json({ message: 'Employee updated.', employee: user });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only Super Admin can toggle employee status.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    user.status = user.status === 'active' ? 'disabled' : 'active';
    await user.save();

    res.json({ message: `Employee ${user.status}.`, employee: user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

const multer = require('multer');
const { uploadToCloudinary } = require('../config/cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

exports.profilePhotoMiddleware = upload.single('photo');

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updates = req.body;
    delete updates.password;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only Super Admin can change profile info. Other users can only change password.' });
    }

    Object.assign(user, updates);
    await user.save();

    res.json({ message: 'Profile updated successfully.', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.updateProfilePhoto = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only Super Admin can change profile photo. Other users can only change password.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'mms');

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.profilePhoto = result.secure_url;
    await user.save();

    res.json({
      message: 'Profile photo updated.',
      url: result.secure_url,
      profilePhoto: result.secure_url
    });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({ message: 'Upload failed.' });
  }
};
