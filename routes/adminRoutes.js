const express = require("express");
const router = express.Router();

const { getUsersProgress, getDashboardSummary } = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

router.get("/users-progress", verifyToken, isAdmin, getUsersProgress);
router.get("/dashboard-summary", verifyToken, isAdmin, getDashboardSummary);

module.exports = router;


