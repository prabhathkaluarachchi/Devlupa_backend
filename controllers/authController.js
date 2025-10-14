const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

// ------------------ 🔸 Nodemailer (Disabled for Render Free Plan) ------------------ //
// const nodemailer = require("nodemailer");
// const transporter = nodemailer.createTransport({
//   service: "gmail", // Or use "Outlook", "Yahoo", etc.
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// transporter.verify((err, success) => {
//   if (err) {
//     console.error("❌ Email transporter error:", err);
//   } else {
//     console.log("✅ Email transporter ready");
//   }
// });

// ------------------ 🔹 Resend (Active Email Service) ------------------ //
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// ------------------ Common Setup ------------------ //
const adminEmails = ["fmprabhath@gmail.com", "admin@devlupa.com"];

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ------------------ Register User ------------------ //
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Assign role based on email
    const userRole = adminEmails.includes(email) ? "admin" : "student";

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
    });

    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ------------------ Login User ------------------ //
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ------------------ Request Password Reset ------------------ //
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetLink = `https://devlupa.netlify.app/reset-password/${token}`;

    // ------------------ Resend Email Sending ------------------ //
    try {
      await resend.emails.send({
        from: "onboarding@resend.dev", // use verified domain or sandbox email
        to: user.email,
        subject: "DevLupa Password Reset",
        html: `
          <p>Hello ${user.name || "User"},</p>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>If you didn’t request this, you can safely ignore this email.</p>
          <p>– DevLupa Team</p>
        `,
      });

      console.log("✅ Password reset email sent successfully to:", user.email);
    } catch (emailError) {
      console.error("❌ Error sending email via Resend:", emailError);
      return res.status(500).json({
        message:
          "Error sending email. Please check Resend setup or try again later.",
      });
    }

    res.json({ message: "Password reset link has been sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error, please try again later." });
  }
};

// ------------------ Reset Password ------------------ //
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = newPassword; // Let pre('save') handle hashing
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
