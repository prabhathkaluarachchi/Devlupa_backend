const express = require("express");
const router = express.Router();

const { verifyToken, isAdmin  } = require("../middleware/authMiddleware");
const User = require("../models/User");
const {
  getUserProfile,
  getProgressSummary,
  enrollInCourse,
  getStudentProgress,
  getAllUsersWithProgress, deleteUser,
} = require("../controllers/userController");
const { getStudentQuizProgress } = require("../controllers/quizController");

// -------------------- STUDENT ROUTES -------------------- //

// Get student's quiz progress
router.get("/studentquizprogress", verifyToken, getStudentQuizProgress);

// Enroll in a course
router.post("/enroll/:courseId", verifyToken, enrollInCourse);

// Get progress summary for the student
router.get("/progress-summary", verifyToken, getProgressSummary);

// Get detailed student progress for dashboard
router.get("/studentprogress", verifyToken, getStudentProgress);

// Get user profile
router.get("/profile", verifyToken, getUserProfile);

// Get watched videos for a course
router.get("/progress/:courseId", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const watched = user.viewedVideos.filter(
      (v) => v.courseId.toString() === courseId
    );

    res.json(watched.map((v) => v.videoId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin routes
router.get("/", verifyToken, isAdmin, getAllUsersWithProgress);
router.delete("/:userId", verifyToken, isAdmin, deleteUser);

// Mark a video as watched
router.post("/progress/:courseId/:videoId", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, videoId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const alreadyWatched = user.viewedVideos.some(
      (v) =>
        v.courseId.toString() === courseId && v.videoId.toString() === videoId
    );

    if (!alreadyWatched) {
      user.viewedVideos.push({ courseId, videoId });
      await user.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
