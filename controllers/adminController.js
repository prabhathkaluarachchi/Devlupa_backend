const User = require("../models/User");
const Course = require("../models/Course");
const Quiz = require("../models/Quiz");
const Submission = require("../models/Submission");
const QuizResult = require("../models/QuizResult");

// ==============================================
// 📊 ADMIN: Get all users' course video progress
// ==============================================
exports.getUsersProgress = async (req, res) => {
  try {
    // Get all students and all courses
    const users = await User.find({ role: "student" }).lean();
    const courses = await Course.find({}).lean();

    // Build maps for total video count and course titles
    const courseVideoCount = {};
    const courseTitleMap = {};

    courses.forEach((course) => {
      const id = course._id.toString();
      courseVideoCount[id] = course.videos.length;
      courseTitleMap[id] = course.title;
    });

    // For each user, compute course-wise video progress
    const usersWithProgress = users.map((user) => {
      const viewedByCourse = {};
      (user.viewedVideos || []).forEach((v) => {
        const cId = v.courseId.toString();
        if (!viewedByCourse[cId]) viewedByCourse[cId] = new Set();
        viewedByCourse[cId].add(v.videoId.toString());
      });

      // Build progress report per course
      const progressDetails = Object.entries(viewedByCourse).map(
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

      return {
        _id: user._id,
        name: user.name || user.email,
        progress: progressDetails,
      };
    });

    res.json(usersWithProgress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching users progress" });
  }
};

// =====================================================
// 📋 ADMIN: Dashboard summary - counts for top widgets
// =====================================================
exports.getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "student" });
    const totalCourses = await Course.countDocuments();
    const totalQuizzes = await Quiz.countDocuments();
    const totalAssignments = await Submission.countDocuments({
      taskType: "assignment",
    });

    res.json({
      totalUsers,
      totalCourses,
      totalQuizzes,
      totalAssignments,
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
};

exports.getUsersQuizProgress = async (req, res) => {
  try {
    const users = await User.find({ role: "student" }).lean();
    // Fetch all quizzes once (for title and question count)
    const quizzes = await Quiz.find({}).lean();

    // Map quizzes by ID for quick access
    const quizMap = {};
    quizzes.forEach((q) => {
      quizMap[q._id.toString()] = {
        title: q.title,
        totalQuestions: q.questions.length,
      };
    });

    const usersQuizProgress = await Promise.all(
      users.map(async (user) => {
        const results = await QuizResult.find({ student: user._id }).lean();

        // Map results by quiz to calculate score
        const quizDetails = results.map((result) => {
          const quizInfo = quizMap[result.quiz.toString()] || {};
          const totalQuestions = quizInfo.totalQuestions || 0;
          const correctAnswers = result.score; // Assuming score = correct answers count
          const scorePercentage =
            totalQuestions === 0
              ? 0
              : Math.round((correctAnswers / totalQuestions) * 100);

          return {
            quizTitle: quizInfo.title || "Unknown Quiz",
            totalQuestions,
            correctAnswers,
            scorePercentage,
          };
        });

        return {
          userId: user._id.toString(),
          name: user.name,
          quizzes: quizDetails,
        };
      })
    );

    res.json(usersQuizProgress);
  } catch (error) {
    console.error("Error fetching users quiz progress:", error);
    res.status(500).json({ message: "Failed to fetch users quiz progress" });
  }
};
