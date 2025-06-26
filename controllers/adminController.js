const User = require('../models/User');
const Course = require('../models/Course');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');

// ==============================================
// 📊 ADMIN: Get all users' course video progress
// ==============================================
exports.getUsersProgress = async (req, res) => {
  try {
    // Get all students and all courses
    const users = await User.find({ role: 'student' }).lean();
    const courses = await Course.find({}).lean();

    // Build maps for total video count and course titles
    const courseVideoCount = {};
    const courseTitleMap = {};

    courses.forEach(course => {
      const id = course._id.toString();
      courseVideoCount[id] = course.videos.length;
      courseTitleMap[id] = course.title;
    });

    // For each user, compute course-wise video progress
    const usersWithProgress = users.map(user => {
      const viewedByCourse = {};
      (user.viewedVideos || []).forEach(v => {
        const cId = v.courseId.toString();
        if (!viewedByCourse[cId]) viewedByCourse[cId] = new Set();
        viewedByCourse[cId].add(v.videoId.toString());
      });

      // Build progress report per course
      const progressDetails = Object.entries(viewedByCourse).map(([courseId, videoIdsSet]) => {
        const totalVideos = courseVideoCount[courseId] || 0;
        const completedCount = videoIdsSet.size;
        const percentage = totalVideos === 0 ? 0 : Math.round((completedCount / totalVideos) * 100);
        const courseTitle = courseTitleMap[courseId] || 'Untitled Course';
        return {
          courseId,
          courseTitle,
          completedCount,
          totalVideos,
          percentage,
        };
      });

      return {
        _id: user._id,
        name: user.name || user.email,
        progress: progressDetails,
      };
    });

    res.json(usersWithProgress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching users progress' });
  }
};

// =====================================================
// 📋 ADMIN: Dashboard summary - counts for top widgets
// =====================================================
exports.getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();
    const totalQuizzes = await Quiz.countDocuments();
    const totalAssignments = await Submission.countDocuments({ taskType: 'assignment' });

    res.json({
      totalUsers,
      totalCourses,
      totalQuizzes,
      totalAssignments,
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};
