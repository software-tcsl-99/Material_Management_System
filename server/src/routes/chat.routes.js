const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/:transactionId/messages', chatController.getMessages);
router.post('/:transactionId/messages', chatController.sendMessage);
router.get('/:transactionId/members', chatController.getChatMembers);

module.exports = router;
