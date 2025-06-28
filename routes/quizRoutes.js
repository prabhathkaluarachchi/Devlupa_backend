const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Get all quizzes
router.get('/', verifyToken, quizController.getAllQuizzes);

// Create a new quiz (Admin only)
router.post('/', verifyToken, isAdmin, quizController.createQuiz);

// Get all quizzes by course ID (Student access)
router.get('/course/:courseId', verifyToken, quizController.getQuizzesByCourse);

// Get quiz details by quiz ID (Student access)
router.get('/:quizId', verifyToken, quizController.getQuizById);

// Submit quiz answers (Student access)
router.post('/:quizId/submit', verifyToken, quizController.submitQuiz);

// Get quiz results for a quiz (Admin only)
router.get('/:quizId/results', verifyToken, isAdmin, quizController.getQuizResults);

// Delete a quiz by ID (Admin only) <--- Add this route
router.delete('/:quizId', verifyToken, isAdmin, quizController.deleteQuiz);

module.exports = router;

