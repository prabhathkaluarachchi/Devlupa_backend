const Course = require('../models/Course');

// Admin creates a course
exports.createCourse = async (req, res) => {
  try {
    const { title, description, videoUrl, tasks } = req.body;
    const course = new Course({
      title,
      description,
      videoUrl,
      tasks,
      createdBy: req.user._id, // req.user should be set by auth middleware
    });
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create course' });
  }
};

// Get all courses (for students)
exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate('createdBy', 'name email');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
};

// Get course details by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('createdBy', 'name email');
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch course' });
  }
};
