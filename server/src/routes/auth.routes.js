const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.me);
router.post('/change-password', auth, authController.changePassword);

module.exports = router;
