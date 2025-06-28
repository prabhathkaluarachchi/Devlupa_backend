const Course = require("../models/Course");

// Create a new course
exports.createCourse = async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = new Course({ title, description, createdBy: req.user._id });
    await course.save();
    res.status(201).json(course);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create course", error: error.message });
  }
};

// Add a video to a course
exports.addVideo = async (req, res) => {
  try {
    const { courseId, title, url } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const order = course.videos.length + 1;
    course.videos.push({ title, url, order });

    await course.save();
    res.status(200).json(course);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to add video", error: error.message });
  }
};

// Delete a video from a course
exports.deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    course.videos = course.videos.filter(
      (video) => video._id.toString() !== videoId
    );
    await course.save();
    res.status(200).json(course);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete video", error: error.message });
  }
};

// Get all courses (with videos)
exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate("createdBy", "name email");
    res.json(courses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch courses", error: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).populate(
      "createdBy",
      "name email"
    );
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch course", error: error.message });
  }
};

// Delete a course
exports.deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const deleted = await Course.findByIdAndDelete(courseId);
    if (!deleted) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Delete course failed:", error);
    res.status(500).json({ message: "Server error" });
  }
};
