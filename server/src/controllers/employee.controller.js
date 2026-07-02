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
    const { employeeId, fullName, email, phone, password, department, designation, workLocation, role, departmentAdminType } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existing) return res.status(400).json({ message: 'Employee ID or email already exists.' });

    const user = await User.create({
      employeeId, fullName, email, phone,
      password: password || 'Welcome@123',
      department, designation, workLocation,
      role: role || 'employee',
      departmentAdminType: departmentAdminType || null,
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

    Object.assign(user, updates);
    await user.save();

    res.json({ message: 'Employee updated.', employee: user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    user.status = user.status === 'active' ? 'disabled' : 'active';
    await user.save();

    res.json({ message: `Employee ${user.status}.`, employee: user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
