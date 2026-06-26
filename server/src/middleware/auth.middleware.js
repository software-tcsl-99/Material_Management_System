const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id)
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name address coordinates');

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (decoded.sessionVersion !== undefined && decoded.sessionVersion !== user.sessionVersion) {
      return res.status(401).json({ message: 'Session invalidated by another login.', code: 'SESSION_INVALID' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
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

module.exports = { authenticate };
