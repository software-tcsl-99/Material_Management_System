const express = require('express');
const router = express.Router();
const notifController = require('../controllers/notification.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', notifController.getNotifications);
router.get('/unread-count', notifController.getUnreadCount);
router.put('/:id/read', notifController.markRead);
router.put('/read-all', notifController.markAllRead);

module.exports = router;
