const User = require('../models/User');
const Course = require('../models/Course');

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.password) user.password = req.body.password;

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get progress summary
const getProgressSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find user with enrolledCourses and viewedVideos populated
    const user = await User.findById(userId).populate('enrolledCourses');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`User enrolled courses count: ${user.enrolledCourses.length}`);
    user.enrolledCourses.forEach(course => {
      console.log(`Course: ${course.title}, Videos: ${course.videos.length}`);
    });
    console.log(`User viewed videos count: ${user.viewedVideos.length}`);

    // Build progress array for each enrolled course
    const progressSummary = user.enrolledCourses.map((course) => {
      const totalVideos = course.videos.length;

      // Count watched videos for this course
      const watchedVideosCount = user.viewedVideos.filter(
        (v) => v.courseId.toString() === course._id.toString()
      ).length;

      const completionPercent =
        totalVideos === 0 ? 0 : Math.round((watchedVideosCount / totalVideos) * 100);

      return {
        courseId: course._id,
        courseTitle: course.title,
        totalVideos,
        watchedVideos: watchedVideosCount,
        completionPercent,
      };
    });

    console.log('Progress summary:', progressSummary);

    res.json(progressSummary);
  } catch (err) {
    console.error('Error in getProgressSummary:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Enroll user in a course
const enrollInCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const courseId = req.params.courseId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if already enrolled
    if (user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ message: "Already enrolled in this course" });
    }

    // Add courseId to user's enrolledCourses
    user.enrolledCourses.push(courseId);
    await user.save();

    res.json({ message: "Enrolled successfully", enrolledCourses: user.enrolledCourses });
  } catch (err) {
    console.error("Enroll error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getProgressSummary,
  enrollInCourse,
};
