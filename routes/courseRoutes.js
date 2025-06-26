const express = require('express');
const router = express.Router();
const { createCourse, addVideo, deleteVideo, getCourses, getCourseById } = require('../controllers/courseController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getCourses);
router.get('/:courseId', getCourseById);

// Protect admin routes with verifyToken and isAdmin middleware
router.post('/', verifyToken, isAdmin, createCourse);
router.post('/video', verifyToken, isAdmin, addVideo);
router.delete('/:courseId/video/:videoId', verifyToken, isAdmin, deleteVideo);

module.exports = router;
