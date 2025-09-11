const mongoose = require("mongoose");
const Assignment = require("../models/Assignment");
const AssignmentSubmission = require("../models/AssignmentSubmission");

// ======================= ADMIN =======================

// Create new assignment with optional image and deadline
exports.createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, dueDate } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const assignment = new Assignment({
      title,
      description,
      courseId,
      dueDate: dueDate ? new Date(dueDate) : null,
      imageUrl,
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error creating assignment", error: error.message });
  }
};

// List All Assignments (Admin view)
exports.getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("courseId", "title")
      .sort({ dueDate: 1 });
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

// Delete Assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await Assignment.findByIdAndDelete(id);
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete assignment" });
  }
};

// ======================= STUDENT =======================

// Get assignments by course
exports.getAssignmentsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    const assignments = await Assignment.find({ courseId }).sort({
      dueDate: 1,
    });
    res.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({
      message: "Error fetching course assignments",
      error: error.message,
    });
  }
};

// Submit assignment (student)
exports.submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { content } = req.body;
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment)
      return res.status(404).json({ message: "Assignment not found" });

    const existing = await AssignmentSubmission.findOne({
      student: req.user.id,
      assignment: assignmentId,
    });
    if (existing)
      return res
        .status(400)
        .json({ message: "You have already submitted this assignment" });

    const submission = new AssignmentSubmission({
      student: req.user.id,
      assignment: assignmentId,
      submission: content,
      fileUrl,
      score: null,
    });

    await submission.save();
    res.status(201).json(submission);
  } catch (error) {
    console.error("Error submitting assignment:", error);
    res
      .status(500)
      .json({ message: "Error submitting assignment", error: error.message });
  }
};

// Get all assignments (student view)
exports.getAllAssignmentsForStudent = async (req, res) => {
  try {
    const assignments = await Assignment.find().sort({ dueDate: 1 });
    res.json(assignments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching assignments", error: error.message });
  }
};

// Get single assignment by ID (student view)
exports.getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate(
      "courseId",
      "title"
    );

    if (!assignment)
      return res.status(404).json({ message: "Assignment not found" });

    const submission = await AssignmentSubmission.findOne({
      assignment: assignment._id,
      student: req.user.id,
    });

    let studentSubmission = null;
    if (submission) {
      studentSubmission = {
        content: submission.submission,
        fileUrl: submission.fileUrl,
        grade: submission.score,
        remarks: submission.remarks, // ✅ include feedback
        status: submission.status || (submission.score != null ? "graded" : "submitted"),
      };
    }

    res.json({
      ...assignment.toObject(),
      submitted: !!submission,
      studentSubmission,
    });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    res
      .status(500)
      .json({ message: "Error fetching assignment", error: error.message });
  }
};


// ======================= ADMIN GRADING =======================

// Grade assignment (admin gives score + feedback)
exports.gradeAssignment = async (req, res) => {
  try {
    const { score, remarks } = req.body;

    const submission = await AssignmentSubmission.findByIdAndUpdate(
      req.params.submissionId,
      {
        score,
        remarks,             // ✅ store feedback
        status: "graded",    // ✅ mark as graded
      },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
  } catch (error) {
    console.error("Error grading assignment:", error);
    res
      .status(500)
      .json({ message: "Error grading assignment", error: error.message });
  }
};



// Get a specific student's submission for an assignment (Admin)
exports.getSubmissionForGrading = async (req, res) => {
  try {
    const { assignmentId, userId } = req.params;

    const submission = await AssignmentSubmission.findOne({
      assignment: assignmentId, // or assignmentId
      student: userId           // or userId depending on schema
    }).populate("assignment student", "title name email");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get assignment progress for logged-in student
exports.getStudentAssignmentProgress = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Fetch all assignments
    const assignments = await Assignment.find().sort({ dueDate: 1 });

    // Fetch student's submissions
    const submissions = await AssignmentSubmission.find({ student: studentId });

    const progress = assignments.map((assignment) => {
      const submission = submissions.find(
        (s) => s.assignment.toString() === assignment._id.toString()
      );

      return {
        assignmentId: assignment._id,
        assignmentTitle: assignment.title,
        status: submission
          ? submission.status === "graded"
            ? "Graded"
            : "Submitted"
          : "Pending",
        score: submission && submission.score != null ? submission.score : null, // ✅ include grade if exists
      };
    });

    res.json({ assignments: progress });
  } catch (error) {
    console.error("Error fetching student assignment progress:", error);
    res.status(500).json({ message: "Failed to fetch assignment progress" });
  }
};



