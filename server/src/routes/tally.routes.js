const express = require('express');
const router = express.Router();
const tallyController = require('../controllers/tally.controller');
const auth = require('../middleware/auth');

router.use(auth);

// Real-time proxy endpoint querying the company's live Tally Prime server
router.get('/inventory', tallyController.getLiveInventory);

module.exports = router;
