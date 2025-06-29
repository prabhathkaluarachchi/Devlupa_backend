const express = require('express');
const router = express.Router();

// import the actual middleware functions you exported
const { verifyToken } = require('../middleware/authMiddleware');
const { getUserProfile, getProgressSummary, enrollInCourse, getStudentProgress } = require('../controllers/userController');
const User = require('../models/User'); // For progress routes
const { getStudentQuizProgress } = require("../controllers/quizController");


router.get('/studentquizprogress', verifyToken, getStudentQuizProgress);

// Replace authMiddleware with verifyToken
router.post('/enroll/:courseId', verifyToken, enrollInCourse);

// Route: GET progress summary for the user
router.get('/progress-summary', verifyToken, getProgressSummary);
// Route: GET student progress for dashboard
router.get('/studentprogress', verifyToken, getStudentProgress);


// Route: GET user profile
router.get('/profile', verifyToken, getUserProfile);

// Route: GET watched videos for a course
router.get('/progress/:courseId', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const watched = user.viewedVideos.filter(
      (v) => v.courseId.toString() === courseId
    );

    res.json(watched.map((v) => v.videoId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route: POST mark a video as watched
router.post('/progress/:courseId/:videoId', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId, videoId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyWatched = user.viewedVideos.some(
      (v) =>
        v.courseId.toString() === courseId &&
        v.videoId.toString() === videoId
    );

    if (!alreadyWatched) {
      user.viewedVideos.push({ courseId, videoId });
      await user.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
