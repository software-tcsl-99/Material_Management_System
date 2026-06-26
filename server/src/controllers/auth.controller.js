const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createAuditLog } = require('../middleware/audit.middleware');
const { emitToUser } = require('../config/socket');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, employeeId: user.employeeId, sessionVersion: user.sessionVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .populate('department', 'name')
      .populate('designation', 'name')
      .populate('workLocation', 'name address coordinates');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Invalidate other devices by incrementing session version and sending socket event
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    emitToUser(user._id.toString(), 'session:invalid', { message: 'Logged in from another device.' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store ONLY the current refresh token (forces logout of other sessions on next refresh)
    user.refreshTokens = [{
      token: refreshToken,
      device: req.headers['user-agent'] || 'Unknown',
    }];

    // Add to login history
    user.loginHistory.push({
      ip: req.ip || req.connection?.remoteAddress,
      device: req.headers['user-agent'] || 'Unknown',
      browser: req.body.browser || '',
      os: req.body.os || '',
    });

    // Keep only last 20 login entries
    if (user.loginHistory.length > 20) {
      user.loginHistory = user.loginHistory.slice(-20);
    }

    await user.save();

    await createAuditLog({
      user: user._id,
      action: 'login',
      entity: 'User',
      entityId: user.employeeId,
      req,
    });

    const userData = user.toJSON();

    res.json({
      user: userData,
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// POST /api/auth/refresh
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const tokenExists = user.refreshTokens.some((t) => t.token === refreshToken);
    if (!tokenExists) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token.' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const user = req.user;

    if (refreshToken) {
      user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
      await user.save();
    }

    await createAuditLog({
      user: user._id,
      action: 'logout',
      entity: 'User',
      entityId: user.employeeId,
      req,
    });

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout.' });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user.mustChangePassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect.' });
      }
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.',
      });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    emitToUser(user._id.toString(), 'session:invalid', { message: 'Password changed. Logging out other sessions.' });
    user.refreshTokens = [];
    await user.save();

    await createAuditLog({
      user: user._id,
      action: 'password_change',
      entity: 'User',
      entityId: user.employeeId,
      req,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens = [{
      token: refreshToken,
      device: req.headers['user-agent'] || 'Unknown',
    }];
    await user.save();

    res.json({
      message: 'Password changed successfully.',
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { login, refreshAccessToken, logout, changePassword, getMe };
