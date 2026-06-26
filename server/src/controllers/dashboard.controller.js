const Transaction = require('../models/Transaction');
const InternalReceipt = require('../models/InternalReceipt');
const ExternalReceipt = require('../models/ExternalReceipt');
const ActivityLog = require('../models/ActivityLog');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

// GET /api/dashboard/stats
const getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const baseQuery = isAdmin ? {} : { $or: [{ sender: userId }, { receiver: userId }] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [total, pending, accepted, rejected, completed, todayCount, monthCount, internalCount, externalCount] =
      await Promise.all([
        Transaction.countDocuments(baseQuery),
        Transaction.countDocuments({ ...baseQuery, status: 'pending' }),
        Transaction.countDocuments({ ...baseQuery, status: 'accepted' }),
        Transaction.countDocuments({ ...baseQuery, status: 'rejected' }),
        Transaction.countDocuments({ ...baseQuery, status: 'completed' }),
        Transaction.countDocuments({ ...baseQuery, createdAt: { $gte: today } }),
        Transaction.countDocuments({ ...baseQuery, createdAt: { $gte: firstDayOfMonth } }),
        InternalReceipt.countDocuments(isAdmin ? {} : { receiver: userId }),
        ExternalReceipt.countDocuments(isAdmin ? {} : { receiver: userId }),
      ]);

    res.json({
      data: {
        stats: {
          total,
          pending,
          accepted,
          rejected,
          completed,
          todayCount,
          monthCount,
          internalReceipts: internalCount,
          externalReceipts: externalCount,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/dashboard/charts
const getChartData = async (req, res) => {
  try {
    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const userId = req.user._id;

    // Daily transactions for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const matchStage = isAdmin
      ? { createdAt: { $gte: thirtyDaysAgo } }
      : { createdAt: { $gte: thirtyDaysAgo }, $or: [{ sender: userId }, { receiver: userId }] };

    const dailyTransactions = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly transactions for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyMatch = isAdmin
      ? { createdAt: { $gte: twelveMonthsAgo } }
      : { createdAt: { $gte: twelveMonthsAgo }, $or: [{ sender: userId }, { receiver: userId }] };

    const monthlyTransactions = await Transaction.aggregate([
      { $match: monthlyMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Status distribution
    const statusDistribution = await Transaction.aggregate([
      { $match: isAdmin ? {} : { $or: [{ sender: userId }, { receiver: userId }] } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Document type distribution
    const docTypeDistribution = await Transaction.aggregate([
      { $match: isAdmin ? {} : { $or: [{ sender: userId }, { receiver: userId }] } },
      { $group: { _id: '$documentType', count: { $sum: 1 } } },
    ]);

    res.json({
      data: {
        charts: {
          dailyTransactions,
          monthlyTransactions,
          statusDistribution,
          docTypeDistribution,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/dashboard/recent
// Return recent audit logs for admin visibility; fall back to activity logs
const getRecentActivities = async (req, res) => {
  try {
    // Prefer AuditLog (created by audit middleware) as it contains system events
    const audits = await AuditLog.find()
      .populate('user', 'fullName employeeId profilePhoto')
      .sort({ createdAt: -1 })
      .limit(20);

    if (audits && audits.length > 0) {
      // Map audits into a shape compatible with client RecentActivities
      const mapped = audits.map((a) => ({
        _id: a._id,
        user: a.user,
        action: a.action,
        details: `${a.entity} ${a.entityId} ${a.newData ? '' : ''}`.trim(),
        createdAt: a.createdAt,
      }));
      return res.json({ data: mapped });
    }

    // Fallback to ActivityLog if no audit records
    const activities = await ActivityLog.find()
      .populate('user', 'fullName employeeId profilePhoto')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ data: activities });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// GET /api/dashboard/pending
const getPendingApprovals = async (req, res) => {
  try {
    const query = { status: 'pending' };
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      query.receiver = req.user._id;
    }

    const pending = await Transaction.find(query)
      .populate('sender', 'fullName employeeId')
      .populate('receiver', 'fullName employeeId')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ data: pending });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { getStats, getChartData, getRecentActivities, getPendingApprovals };
