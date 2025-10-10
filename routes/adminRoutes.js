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

const cvController = require("../controllers/cvController"); // add CV controller
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

// ------------------- Multer setup for CV uploads ------------------- //
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Analyze Multiple CVs - UPDATED for multiple files
router.post(
  "/cv-filter",
  verifyToken,
  isAdmin,
  upload.array("cvs", 100), // Changed from single() to array(), max 100 files
  cvController.analyzeCV
);

// Send registration link (single email)
router.post(
  "/send-link",
  verifyToken,
  isAdmin,
  cvController.sendRegistrationLink
);

// Send bulk registration links (NEW ENDPOINT)
router.post(
  "/send-bulk-links",
  verifyToken,
  isAdmin,
  cvController.sendBulkRegistrationLinks
);

module.exports = router;