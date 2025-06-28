const mongoose = require('mongoose');

// Option sub-schema
const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
});

// Ensure each question has exactly 4 options
function validateOptions(val) {
  return val.length === 4;
}

// Question sub-schema
const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [optionSchema],
    required: true,
    validate: [validateOptions, '{PATH} must have exactly 4 options'],
  },
});

// Ensure the quiz has exactly 2 questions (for now)
function validateQuestions(val) {
  return val.length === 2;
}

// Quiz schema
const quizSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  questions: {
    type: [questionSchema],
    required: true,
    validate: [validateQuestions, '{PATH} must have exactly 2 questions'],
  },
  timeLimit: { type: Number, default: 30 },
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
