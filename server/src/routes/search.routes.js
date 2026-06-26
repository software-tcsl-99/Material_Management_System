const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { globalSearch } = require('../controllers/search.controller');

router.get('/', authenticate, globalSearch);

module.exports = router;
