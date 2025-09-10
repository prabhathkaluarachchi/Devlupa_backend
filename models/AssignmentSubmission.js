const mongoose = require("mongoose");

const assignmentSubmissionSchema = new mongoose.Schema(
  {
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
      type: String, // student's answer text
    },
    fileUrl: {
      type: String, // optional file upload
    },
    score: {
      type: Number,
      default: null, // stays null until admin grades
    },
    remarks: {
      type: String, // feedback from admin
      default: "",
    },
    status: {
      type: String,
      enum: ["submitted", "graded"],
      default: "submitted",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "AssignmentSubmission",
  assignmentSubmissionSchema
);
