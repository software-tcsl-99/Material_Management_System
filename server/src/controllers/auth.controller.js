const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, sessionVersion: user.sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  const refreshToken = jwt.sign(
    { id: user._id, sessionVersion: user.sessionVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('department', 'name code')
      .populate('designation', 'name')
      .populate('workLocation', 'name address');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken,
      device: req.headers['user-agent'] || 'unknown',
    });

    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    // Add login history
    user.loginHistory.push({
      ip: req.ip,
      device: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      os: 'unknown',
    });

    await user.save();

    // Audit log
    await AuditLog.create({
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id.toString(),
      user: user._id,
      userName: user.fullName,
      description: `${user.fullName} logged in`,
      ip: req.ip,
      device: req.headers['user-agent'],
    });

    const userResponse = user.toJSON();

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: userResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    const tokenExists = user.refreshTokens.some((t) => t.token === refreshToken);
    if (!tokenExists) {
      return res.status(401).json({ message: 'Refresh token not found.' });
    }

    // Remove old refresh token
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);

    // Generate new tokens
    const tokens = generateTokens(user);
    user.refreshTokens.push({
      token: tokens.refreshToken,
      device: req.headers['user-agent'] || 'unknown',
    });

    await user.save();

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid refresh token.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken && req.user) {
      req.user.refreshTokens = req.user.refreshTokens.filter((t) => t.token !== refreshToken);
      await req.user.save();
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout.' });
  }
};

exports.me = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.sessionVersion += 1;
    user.refreshTokens = [];
    await user.save();

    const tokens = generateTokens(user);

    res.json({
      message: 'Password changed successfully.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
};
