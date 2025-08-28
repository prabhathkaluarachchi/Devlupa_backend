require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import route files
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const userRoutes = require('./routes/userRoutes'); // Student routes only
const adminRoutes = require('./routes/adminRoutes');
const quizRoutes = require('./routes/quizRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // parse JSON bodies

// ------------------------ ROUTES ------------------------ //
// Auth routes
app.use('/api/auth', authRoutes);

// Course routes
app.use('/api/courses', courseRoutes);

// Student user routes
app.use('/api/users', userRoutes); // Mount user routes ONCE here

// Admin-specific routes
app.use('/api/admin', adminRoutes);

// Quiz routes
app.use('/api/quizzes', quizRoutes);

// Assignment routes
app.use('/api/assignments', assignmentRoutes);

// ------------------------ ERROR HANDLER ------------------------ //
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// ------------------------ SERVER START ------------------------ //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Devlupa backend running on port ${PORT}`)
);
