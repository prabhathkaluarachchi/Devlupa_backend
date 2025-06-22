// models/Course.js
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true }, // YouTube URL
  order: { type: Number, required: true }, // order in playlist
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  videos: [videoSchema], // array of videos
  tasks: [String],       // e.g. quiz ids or assignment ids
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
