// routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const { getUsersProgress } = require('../controllers/adminController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/users-progress', authMiddleware, adminMiddleware, getUsersProgress);

module.exports = router;

