const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Email is invalid"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
    viewedVideos: [
      {
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        videoId: { type: mongoose.Schema.Types.ObjectId },
      },
    ],

    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    scores: [
      {
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        quizScore: { type: Number, default: 0 },
        assignmentScore: { type: Number, default: 0 },
      },
    ],
    certificates: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Certificate" },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
