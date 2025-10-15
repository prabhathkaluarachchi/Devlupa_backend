require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // For serving uploaded files
const connectDB = require('./config/db');

// ------------------------ ROUTES ------------------------ //
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const userRoutes = require('./routes/userRoutes'); // Student routes
const adminRoutes = require('./routes/adminRoutes'); // Admin + CV filter
const quizRoutes = require('./routes/quizRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const certificateRoutes = require('./routes/certificateRoutes');

// ------------------------ CONNECT TO DB ------------------------ //
connectDB();

// ------------------------ INITIALIZE APP ------------------------ //
const app = express();

// ------------------------ MIDDLEWARE ------------------------ //
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Optional, for form data

// ------------------------ STATIC FILES ------------------------ //
// Serve uploaded files (e.g., CVs, assignment submissions)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------------ API ROUTES ------------------------ //
// Authentication routes
app.use('/api/auth', authRoutes);

// Courses
app.use('/api/courses', courseRoutes);

// Student user routes
app.use('/api/users', userRoutes);

// Admin routes (includes dashboard + CV filter)
app.use('/api/admin', adminRoutes);

// Quiz routes
app.use('/api/quizzes', quizRoutes);

// Assignment routes
app.use('/api/assignments', assignmentRoutes);

// Add this with your other route uses
app.use('/api/admin', certificateRoutes);


// ------------------------ ROOT ROUTE ------------------------ //
app.get('/', (req, res) => {
  res.send('🚀 Devlupa Backend is Running Successfully!');
});

// ------------------------ ERROR HANDLER ------------------------ //
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// ------------------------ START SERVER ------------------------ //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Devlupa backend running on port ${PORT}`)
);

