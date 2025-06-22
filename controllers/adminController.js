const User = require('../models/User');
const Course = require('../models/Course');

exports.getUsersProgress = async (req, res) => {
  try {
    const users = await User.find({ role: 'student' }).lean();
    const courses = await Course.find({}).lean();

    const courseVideoCount = {};
    const courseTitleMap = {};

    courses.forEach(course => {
      const id = course._id.toString();
      courseVideoCount[id] = course.videos.length;
      courseTitleMap[id] = course.title;
    });

    const usersWithProgress = users.map(user => {
      const viewedByCourse = {};
      (user.viewedVideos || []).forEach(v => {
        const cId = v.courseId.toString();
        if (!viewedByCourse[cId]) viewedByCourse[cId] = new Set();
        viewedByCourse[cId].add(v.videoId.toString());
      });

      const progressDetails = Object.entries(viewedByCourse).map(([courseId, videoIdsSet]) => {
        const totalVideos = courseVideoCount[courseId] || 0;
        const completedCount = videoIdsSet.size;
        const percentage = totalVideos === 0 ? 0 : Math.round((completedCount / totalVideos) * 100);
        const courseTitle = courseTitleMap[courseId] || 'Untitled Course';
        return {
          courseId,
          courseTitle, // ✅ Add course title here
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
