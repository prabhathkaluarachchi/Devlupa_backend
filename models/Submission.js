const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  score: {
    type: Number,
    default: 0,
  },
  feedback: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Submission', submissionSchema);
