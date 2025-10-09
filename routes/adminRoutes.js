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
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});
const upload = multer({ storage });

// Analyze CV
router.post(
  "/cv-filter",
  verifyToken,
  isAdmin,
  upload.single("cv"),
  cvController.analyzeCV
);

// Send registration link
router.post(
  "/send-link",
  verifyToken,
  isAdmin,
  cvController.sendRegistrationLink
);

module.exports = router;
