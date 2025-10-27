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

// ------------------ 🔹 SendGrid (Active Email Service) ------------------ //
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ------------------ Common Setup ------------------ //
const adminEmails = ["fmprabhath@gmail.com", "achintha@allinoneholdings.com", "chandula@allinoneholdings.com", "kanchana@allinoneholdings.com", "djprabhathmix@gmail.com"];

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

    // ------------------ SendGrid Email Sending ------------------ //
    try {
      const msg = {
        to: user.email,
        from: {
          email: 'fmprabhath@gmail.com', // Your verified SendGrid sender
          name: 'DevLupa Support'
        },
        subject: 'DevLupa Password Reset',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2 style="color: #2c3e50;">Password Reset Request</h2>
            <p>Hello ${user.name || "User"},</p>
            <p>You requested a password reset for your DevLupa account.</p>
            <p>Click the link below to reset your password:</p>
            <p>
              <a href="${resetLink}" 
                 style="background-color: #007bff; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                 Reset Password
              </a>
            </p>
            <p><strong>Reset Link:</strong> ${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <br/>
            <p>Best regards,<br>DevLupa Team</p>
          </div>
        `,
      };

      await sgMail.send(msg);
      
      console.log("✅ Password reset email sent successfully to:", user.email);
    } catch (emailError) {
      console.error("❌ Error sending email via SendGrid:", emailError.response?.body || emailError);
      return res.status(500).json({
        message: "Error sending email. Please try again later.",
        error: emailError.response?.body || emailError.message,
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