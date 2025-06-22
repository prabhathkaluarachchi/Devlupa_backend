const express = require('express');
const router = express.Router();
const { createCourse, addVideo, deleteVideo, getCourses, getCourseById } = require('../controllers/courseController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.get('/', getCourses);
router.get('/:courseId', getCourseById);

// Protect admin routes
router.post('/', authMiddleware, createCourse);
router.post('/video', authMiddleware, addVideo);
router.delete('/:courseId/video/:videoId', authMiddleware, deleteVideo);

module.exports = router;

