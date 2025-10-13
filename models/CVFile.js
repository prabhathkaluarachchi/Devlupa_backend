const mongoose = require("mongoose");

const cvFileSchema = new mongoose.Schema({
  fileName: {
    type: String,
    // Remove required: true since we're generating it
  },
  originalName: {
    type: String,
    required: true
  },
  fileData: {
    type: Buffer,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("CVFile", cvFileSchema);