const mongoose = require("mongoose");

const cvScreeningSchema = new mongoose.Schema({
  screeningId: {
    type: String,
    unique: true,
    required: true
  },
  jobRequirement: {
    type: String,
    required: true
  },
  threshold: {
    type: Number,
    required: true,
    default: 45
  },
  cvFiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "CVFile"
  }],
  results: [{
    cvFile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CVFile",
      required: true
    },
    fileName: String,
    matchScore: Number,
    matchingRequirements: [String],
    missingRequirements: [String],
    extractedEmail: String,
    eligible: Boolean,
    error: String,
    emailSent: {
      type: Boolean,
      default: false
    },
    emailSentTo: String,
    emailSentAt: Date
  }],
  totalAnalyzed: Number,
  eligibleCount: Number,
  invitationsSent: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ["completed", "in_progress", "failed"],
    default: "completed"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

// Generate screening ID before save
cvScreeningSchema.pre("save", function(next) {
  if (!this.screeningId) {
    this.screeningId = `SCR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model("CVScreening", cvScreeningSchema);