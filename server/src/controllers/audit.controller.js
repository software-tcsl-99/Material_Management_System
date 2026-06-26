const AuditLog = require('../models/AuditLog');

// GET /api/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, user, action, entity, startDate, endDate } = req.query;
    const query = {};

    if (user) query.user = user;
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const logs = await AuditLog.find(query)
      .populate('user', 'fullName employeeId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { getAuditLogs };
