const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { verifyToken } = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const multer = require('multer');
const path = require('path');

// ================== MULTER CONFIG ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const upload = multer({ storage });

// ================== ADMIN ROUTES ==================

// Add this near the top, after your existing multer setup
router.post(
  '/:id/submit',
  verifyToken,
  upload.single('file'), // ← handle student uploaded file
  assignmentController.submitAssignment
);


// Create assignment with optional image upload
router.post(
  '/',
  verifyToken,
  adminMiddleware,
  upload.single('image'),
  assignmentController.createAssignment
);

// Get all assignments (Admin view)
router.get('/', verifyToken, adminMiddleware, assignmentController.getAssignments);

// Delete assignment
router.delete('/:id', verifyToken, adminMiddleware, assignmentController.deleteAssignment);

// Grade assignment
router.put('/grade/:submissionId', verifyToken, adminMiddleware, assignmentController.gradeAssignment);

// ================== STUDENT ROUTES ==================

// Get assignments by course
router.get('/course/:courseId', verifyToken, assignmentController.getAssignmentsByCourse);

// Submit assignment
router.post('/:id/submit', verifyToken, assignmentController.submitAssignment);

// Get all assignments (student view)
router.get('/all', verifyToken, assignmentController.getAllAssignmentsForStudent);

// Get single assignment (student)
router.get('/:id', verifyToken, assignmentController.getAssignmentById);


// Admin fetch submission for grading
router.get(
  "/:assignmentId/user/:userId",
  verifyToken,
  adminMiddleware,
  assignmentController.getSubmissionForGrading
);



module.exports = router;
