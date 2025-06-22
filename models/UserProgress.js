const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  videosWatched: [{ type: String }], // store watched video URLs or video IDs
  quizzesCompleted: [{ quizId: mongoose.Schema.Types.ObjectId, score: Number }],
  assignmentsCompleted: [{ assignmentId: mongoose.Schema.Types.ObjectId, score: Number }],
  percentage: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('UserProgress', progressSchema);
