const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { globalSearch } = require('../controllers/search.controller');

router.use(auth);
router.get('/', globalSearch);

module.exports = router;
