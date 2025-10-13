const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const {
  getUsersProgress,
  getDashboardSummary,
  getUsersQuizProgress,
  getUsersAssignmentProgress,
} = require("../controllers/adminController");

const cvController = require("../controllers/cvController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// ================== ADMIN DASHBOARD ROUTES ==================
router.get("/users-progress", verifyToken, isAdmin, getUsersProgress);
router.get("/dashboard-summary", verifyToken, isAdmin, getDashboardSummary);
router.get("/users-quiz-progress", verifyToken, isAdmin, getUsersQuizProgress);
router.get(
  "/users-assignment-progress",
  verifyToken,
  isAdmin,
  getUsersAssignmentProgress
);

// ------------------- Multer setup for CV uploads (UPDATED FOR MEMORY STORAGE) ------------------- //
const storage = multer.memoryStorage(); // Use memory storage instead of disk storage

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Analyze Multiple CVs
router.post(
  "/cv-filter",
  verifyToken,
  isAdmin,
  upload.array("cvs", 100),
  cvController.analyzeCV
);

// Send registration link (single)
router.post(
  "/send-link",
  verifyToken,
  isAdmin,
  cvController.sendRegistrationLink
);

// Send bulk registration links
router.post(
  "/send-bulk-links",
  verifyToken,
  isAdmin,
  cvController.sendBulkRegistrationLinks
);

// Generate PDF report (NEW)
router.post(
  "/generate-report",
  verifyToken,
  isAdmin,
  cvController.generateReport
);

// ================== CV SCREENING HISTORY & MANAGEMENT ==================

// Get CV screening history
router.get(
  "/cv-screening-history",
  verifyToken,
  isAdmin,
  cvController.getScreeningHistory
);

// Get specific screening details
router.get(
  "/cv-screening/:screeningId",
  verifyToken,
  isAdmin,
  cvController.getScreeningDetails
);

// Download CV file
router.get(
  "/download-cv/:fileId",
  verifyToken,
  isAdmin,
  cvController.downloadCV
);


module.exports = router;