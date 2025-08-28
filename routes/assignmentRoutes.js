const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { verifyToken } = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware'); // ✅ default function export

// ================== ADMIN ROUTES ==================

// Create assignment
router.post('/', verifyToken, adminMiddleware, assignmentController.createAssignment);

// Get all assignments
router.get('/', verifyToken, adminMiddleware, assignmentController.getAllAssignments);

// Delete assignment
router.delete('/:id', verifyToken, adminMiddleware, assignmentController.deleteAssignment);

// Grade assignment
router.put('/grade/:submissionId', verifyToken, adminMiddleware, assignmentController.gradeAssignment);

// ================== STUDENT ROUTES ==================

// Get assignments by course
router.get('/course/:courseId', verifyToken, assignmentController.getAssignmentsByCourse);

// Submit assignment
router.post('/:id/submit', verifyToken, assignmentController.submitAssignment);

// GET all assignments (student view)
router.get('/all', verifyToken, assignmentController.getAllAssignmentsForStudent);

// Get single assignment (student)
router.get("/:id", verifyToken, assignmentController.getAssignmentById);



module.exports = router;
