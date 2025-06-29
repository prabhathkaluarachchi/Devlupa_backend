const User = require("../models/User");
const Course = require("../models/Course");
const UserProgress = require("../models/UserProgress");







// GET /api/users/progress-summary
const getStudentProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const courses = await Course.find({}).lean();
    const courseVideoCount = {};
    const courseTitleMap = {};
    courses.forEach((course) => {
      const id = course._id.toString();
      courseVideoCount[id] = course.videos.length;
      courseTitleMap[id] = course.title;
    });

    const viewedByCourse = {};
    (user.viewedVideos || []).forEach((v) => {
      const cId = v.courseId.toString();
      if (!viewedByCourse[cId]) viewedByCourse[cId] = new Set();
      viewedByCourse[cId].add(v.videoId.toString());
    });

    const progress = Object.entries(viewedByCourse).map(
      ([courseId, videoIdsSet]) => {
        const totalVideos = courseVideoCount[courseId] || 0;
        const completedCount = videoIdsSet.size;
        const percentage =
          totalVideos === 0
            ? 0
            : Math.round((completedCount / totalVideos) * 100);
        const courseTitle = courseTitleMap[courseId] || "Untitled Course";
        return {
          courseId,
          courseTitle,
          completedCount,
          totalVideos,
          percentage,
        };
      }
    );

    res.json(progress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch progress summary" });
  }
};

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

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
    res.status(500).json({ message: "Server error" });
  }
};

// Get progress summary
const getProgressSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find user with enrolledCourses and viewedVideos populated
    const user = await User.findById(userId).populate("enrolledCourses");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build progress array for each enrolled course
    const progressSummary = user.enrolledCourses.map((course) => {
      const totalVideos = course.videos.length;

      // Count watched videos for this course
      const watchedVideosCount = user.viewedVideos.filter(
        (v) => v.courseId.toString() === course._id.toString()
      ).length;

      const completionPercent =
        totalVideos === 0
          ? 0
          : Math.round((watchedVideosCount / totalVideos) * 100);

      return {
        courseId: course._id,
        courseTitle: course.title,
        totalVideos,
        watchedVideos: watchedVideosCount,
        completionPercent,
      };
    });

    console.log("Progress summary:", progressSummary);

    res.json(progressSummary);
  } catch (err) {
    console.error("Error in getProgressSummary:", err);
    res.status(500).json({ message: "Server error" });
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
      return res
        .status(400)
        .json({ message: "Already enrolled in this course" });
    }

    // Add courseId to user's enrolledCourses
    user.enrolledCourses.push(courseId);
    await user.save();

    res.json({
      message: "Enrolled successfully",
      enrolledCourses: user.enrolledCourses,
    });
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
  getStudentProgress,
};
