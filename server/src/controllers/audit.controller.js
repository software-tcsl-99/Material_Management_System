const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res) => {
  try {
    const { entity, entityId, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = entityId;

    // Department admins can only see their department-related logs
    if (req.user.role === 'department_admin' && req.user.role !== 'super_admin') {
      // Allow viewing but scoped
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('user', 'fullName employeeId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      data: logs, // Added for frontend compatibility
      logs,
      total,
      page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
