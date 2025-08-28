const mongoose = require("mongoose");

const assignmentSubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: true,
  },
  submission: {
    type: String,
    required: true, // student's answer text
  },
  score: {
    type: Number,
    default: null, // manual grading, null until graded
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
