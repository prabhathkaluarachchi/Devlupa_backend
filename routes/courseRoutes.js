// routes/courseRoutes.js
const express = require('express');
const {
  createCourse,
  getCourses,
  getCourseById,
} = require('../controllers/courseController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(getCourses)                       // Public: list all courses
  .post(protect, adminOnly, createCourse); // Admin only to create

router.get('/:id', getCourseById);      // Public: Get course details by id

module.exports = router;
