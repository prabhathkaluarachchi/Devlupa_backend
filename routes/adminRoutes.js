const express = require("express");
const router = express.Router();

const { getUsersProgress, getDashboardSummary, getUsersQuizProgress } = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

router.get("/users-progress", verifyToken, isAdmin, getUsersProgress);
router.get("/dashboard-summary", verifyToken, isAdmin, getDashboardSummary);
router.get('/users-quiz-progress', verifyToken, isAdmin, getUsersQuizProgress);


module.exports = router;


