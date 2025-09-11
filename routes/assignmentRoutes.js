const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const { verifyToken } = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const multer = require("multer");
const path = require("path");

// ================== MULTER CONFIG ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});
const upload = multer({ storage });

// ================== ADMIN ROUTES ==================

// Create assignment with optional image upload
router.post(
  "/",
  verifyToken,
  adminMiddleware,
  upload.single("image"),
  assignmentController.createAssignment
);

// Get all assignments (Admin view)
router.get(
  "/",
  verifyToken,
  adminMiddleware,
  assignmentController.getAssignments
);

// Delete assignment
router.delete(
  "/:id",
  verifyToken,
  adminMiddleware,
  assignmentController.deleteAssignment
);

// Grade assignment
router.put(
  "/grade/:submissionId",
  verifyToken,
  adminMiddleware,
  assignmentController.gradeAssignment
);

// Admin fetch submission for grading
router.get(
  "/:assignmentId/user/:userId",
  verifyToken,
  adminMiddleware,
  assignmentController.getSubmissionForGrading
);

// ================== STUDENT ROUTES ==================

// Student assignment progress (must come first to avoid route conflicts)
router.get(
  "/progress",
  verifyToken,
  assignmentController.getStudentAssignmentProgress
);

// Get assignments by course
router.get(
  "/course/:courseId",
  verifyToken,
  assignmentController.getAssignmentsByCourse
);

// Get all assignments (student view)
router.get(
  "/all",
  verifyToken,
  assignmentController.getAllAssignmentsForStudent
);

// Submit assignment (student with optional file upload)
router.post(
  "/:id/submit",
  verifyToken,
  upload.single("file"),
  assignmentController.submitAssignment
);

// Get single assignment (student view)
router.get("/:id", verifyToken, assignmentController.getAssignmentById);

module.exports = router;
