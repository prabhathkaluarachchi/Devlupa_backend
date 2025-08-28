const express = require("express");
const router = express.Router();

const {
  getUsersProgress,
  getDashboardSummary,
  getUsersQuizProgress,
    getUsersAssignmentProgress,
} = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

router.get("/users-progress", verifyToken, isAdmin, getUsersProgress);
router.get("/dashboard-summary", verifyToken, isAdmin, getDashboardSummary);
router.get("/users-quiz-progress", verifyToken, isAdmin, getUsersQuizProgress);
router.get(
  "/users-assignment-progress",
  verifyToken,
  isAdmin,
  getUsersAssignmentProgress
);


module.exports = router;
