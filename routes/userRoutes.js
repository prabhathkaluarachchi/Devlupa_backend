const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware'); // should be a function
const { getUserProfile } = require('../controllers/userController'); // should be a function

router.get('/profile', protect, getUserProfile);

module.exports = router;

