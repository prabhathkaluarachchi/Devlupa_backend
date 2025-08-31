const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignmentId: { // <-- important for assignments
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
  },
  quizId: { // <-- optional if it's a quiz submission
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  taskType: {
    type: String,
    enum: ['quiz', 'assignment'],
    required: true,
  },
  content: {
    type: String,
  },
  fileUrl: { // <-- for uploaded assignment files
    type: String,
  },
  score: {
    type: Number,
  },
  feedback: {
    type: String,
  },
  status: { // "submitted" or "graded"
    type: String,
    enum: ['submitted', 'graded'],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Submission', submissionSchema);
