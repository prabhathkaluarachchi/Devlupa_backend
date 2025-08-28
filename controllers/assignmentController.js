const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

// ======================= ADMIN =======================

// Create new assignment
exports.createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, imageUrl, dueDate } = req.body;

    const assignment = new Assignment({
      courseId,
      title,
      description,
      imageUrl,
      dueDate,
      createdBy: req.user.id, // admin
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error creating assignment', error: error.message });
  }
};

// Get all assignments (admin view)
exports.getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find().populate('courseId', 'title');
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignments', error: error.message });
  }
};

// Delete assignment
exports.deleteAssignment = async (req, res) => {
  try {
    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting assignment', error: error.message });
  }
};

// ======================= STUDENT =======================

// Get assignments by course (student view)
exports.getAssignmentsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;

    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    // Fetch assignments for this course
    const assignments = await Assignment.find({
      courseId: mongoose.Types.ObjectId(courseId),
    }).sort({ dueDate: 1 }); // optional: sort by due date

    res.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({
      message: "Error fetching course assignments",
      error: error.message,
    });
  }
};


// Submit assignment (student submits code as text)
exports.submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id; // get assignment ID from URL
    const { content } = req.body;       // submission text/code

    // Optional: fetch assignment to get courseId
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if student already submitted
    const existing = await Submission.findOne({
      userId: req.user.id,
      assignmentId,
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted this assignment' });
    }

    const submission = new Submission({
      userId: req.user.id,
      assignmentId,
      courseId: assignment.courseId,
      taskType: 'assignment',
      content,
    });

    await submission.save();
    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting assignment', error: error.message });
  }
};

// Get all assignments (student view)
exports.getAllAssignmentsForStudent = async (req, res) => {
  try {
    const assignments = await Assignment.find(); // fetch all assignments
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignments', error: error.message });
  }
};

// Get single assignment by ID (student view)
exports.getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate(
      "courseId",
      "title"
    );
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: "Error fetching assignment", error: error.message });
  }
};




// ======================= ADMIN GRADING =======================

// Grade assignment (admin gives score + feedback)
exports.gradeAssignment = async (req, res) => {
  try {
    const { score, feedback } = req.body;

    const submission = await Submission.findByIdAndUpdate(
      req.params.submissionId,
      { score, feedback },
      { new: true }
    );

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: 'Error grading assignment', error: error.message });
  }
};
