const express = require('express');
const router = express.Router();
const {
  createCourse,
  addVideo,
  deleteVideo,
  getCourses,
  getCourseById,
  deleteCourse,
} = require('../controllers/courseController');

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Public Routes
router.get('/', getCourses);                     // GET /api/courses
router.get('/:courseId', getCourseById);         // GET /api/courses/:courseId

// Admin Routes
router.post('/', verifyToken, isAdmin, createCourse);
router.post('/video', verifyToken, isAdmin, addVideo);
router.delete('/:courseId/video/:videoId', verifyToken, isAdmin, deleteVideo);
router.delete('/:courseId', verifyToken, isAdmin, deleteCourse);

module.exports = router;

