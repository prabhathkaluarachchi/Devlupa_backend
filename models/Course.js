// models/Course.js
const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    videoUrl: { type: String },
    tasks: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', CourseSchema);
