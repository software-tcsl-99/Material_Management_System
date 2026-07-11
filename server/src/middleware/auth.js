const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id)
      .populate('department', 'name code')
      .populate('designation', 'name')
      .populate('workLocation', 'name address');

    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Invalid token or user deactivated.' });
    }

    if (decoded.sessionVersion !== undefined && decoded.sessionVersion !== user.sessionVersion) {
      return res.status(401).json({ message: 'Session expired. Please login again.', code: 'SESSION_INVALID' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

module.exports = auth;
