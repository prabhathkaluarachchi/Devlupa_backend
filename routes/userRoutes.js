const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getUserProfile, getProgressSummary } = require('../controllers/userController');
const User = require('../models/User'); // ✅ Required for progress routes
const { enrollInCourse } = require('../controllers/userController');

router.post('/enroll/:courseId', authMiddleware, enrollInCourse);

// Route: GET progress summary for the user
router.get('/progress-summary', authMiddleware, getProgressSummary);

// Route: GET user profile (if you're using this)
router.get('/profile', authMiddleware, getUserProfile);

// Route: GET watched videos for a course
router.get('/progress/:courseId', authMiddleware, async (req, res) => {
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
router.post('/progress/:courseId/:videoId', authMiddleware, async (req, res) => {
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


