const User = require("../models/User");
const Course = require("../models/Course");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");
const Assignment = require("../models/Assignment");
const AssignmentSubmission = require("../models/AssignmentSubmission");

// ==============================================
// 📊 ADMIN: Get all users' course video progress
// ==============================================
const getUsersProgress = async (req, res) => {
  try {
    const users = await User.find({ role: "student" }).lean();
    const courses = await Course.find({}).lean();

    const courseVideoCount = {};
    const courseTitleMap = {};
    courses.forEach((course) => {
      const id = course._id.toString();
      courseVideoCount[id] = course.videos.length;
      courseTitleMap[id] = course.title;
    });

    const usersWithProgress = users.map((user) => {
      const viewedByCourse = {};
      (user.viewedVideos || []).forEach((v) => {
        const cId = v.courseId.toString();
        if (!viewedByCourse[cId]) viewedByCourse[cId] = new Set();
        viewedByCourse[cId].add(v.videoId.toString());
      });

      const progressDetails = Object.entries(viewedByCourse).map(
        ([courseId, videoIdsSet]) => {
          const totalVideos = courseVideoCount[courseId] || 0;
          const completedCount = videoIdsSet.size;
          const percentage =
            totalVideos === 0
              ? 0
              : Math.round((completedCount / totalVideos) * 100);
          const courseTitle = courseTitleMap[courseId] || "Untitled Course";
          return { courseId, courseTitle, completedCount, totalVideos, percentage };
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
const getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "student" });
    const totalCourses = await Course.countDocuments();
    const totalQuizzes = await Quiz.countDocuments();
    const totalAssignments = await Assignment.countDocuments();

    res.json({ totalUsers, totalCourses, totalQuizzes, totalAssignments });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({ message: "Failed to fetch dashboard summary" });
  }
};

// =====================================================
// 📊 ADMIN: Get all users' quiz progress
// =====================================================
const getUsersQuizProgress = async (req, res) => {
  try {
    const users = await User.find({ role: "student" }).lean();
    const quizzes = await Quiz.find({}).lean();

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

        const quizDetails = results.map((result) => {
          const quizInfo = quizMap[result.quiz.toString()] || {};
          const totalQuestions = quizInfo.totalQuestions || 0;
          const correctAnswers = result.score || 0;
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

        return { userId: user._id.toString(), name: user.name, quizzes: quizDetails };
      })
    );

    res.json(usersQuizProgress);
  } catch (error) {
    console.error("Error fetching users quiz progress:", error);
    res.status(500).json({ message: "Failed to fetch users quiz progress" });
  }
};

// =====================================================
// 📂 ADMIN: Get all users' assignment progress
// =====================================================
const getUsersAssignmentProgress = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).lean();
    const allAssignments = await Assignment.find().lean();

    const results = await Promise.all(
      students.map(async (student) => {
        // Fetch submissions for this student
        const submissions = await AssignmentSubmission.find({ student: student._id }).lean();

        // Map assignment ID → submission
        const submissionMap = new Map();
        submissions.forEach((sub) => {
          submissionMap.set(sub.assignment.toString(), sub);
        });

        // Combine all assignments with student's submission info
        const assignmentsWithStatus = allAssignments.map((a) => {
          const sub = submissionMap.get(a._id.toString());
          return {
            assignmentId: a._id,
            title: a.title,
            submitted: !!sub,
            score: sub ? sub.score ?? null : null,
            totalScore: a.totalScore || 100,
          };
        });

        return {
          userId: student._id,
          name: student.name,
          assignments: assignmentsWithStatus,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch assignment progress" });
  }
};


// =====================================================
// ✅ EXPORT ALL CONTROLLERS
// =====================================================
module.exports = {
  getUsersProgress,
  getDashboardSummary,
  getUsersQuizProgress,
  getUsersAssignmentProgress,
};
