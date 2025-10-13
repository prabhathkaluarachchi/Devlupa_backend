// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const path = require('path'); // For serving uploaded files
// const connectDB = require('./config/db');

// // ------------------------ ROUTES ------------------------ //
// const authRoutes = require('./routes/authRoutes');
// const courseRoutes = require('./routes/courseRoutes');
// const userRoutes = require('./routes/userRoutes'); // Student routes
// const adminRoutes = require('./routes/adminRoutes'); // Admin + CV filter
// const quizRoutes = require('./routes/quizRoutes');
// const assignmentRoutes = require('./routes/assignmentRoutes');

// // ------------------------ CONNECT TO DB ------------------------ //
// connectDB();

// // ------------------------ INITIALIZE APP ------------------------ //
// const app = express();

// // ------------------------ MIDDLEWARE ------------------------ //
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true })); // Optional, for form data

// // ------------------------ STATIC FILES ------------------------ //
// // Serve uploaded files (e.g., CVs, assignment submissions)
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // ------------------------ API ROUTES ------------------------ //
// // Authentication routes
// app.use('/api/auth', authRoutes);

// // Courses
// app.use('/api/courses', courseRoutes);

// // Student user routes
// app.use('/api/users', userRoutes);

// // Admin routes (includes dashboard + CV filter)
// app.use('/api/admin', adminRoutes);

// // Quiz routes
// app.use('/api/quizzes', quizRoutes);

// // Assignment routes
// app.use('/api/assignments', assignmentRoutes);

// // ------------------------ ERROR HANDLER ------------------------ //
// app.use((err, req, res, next) => {
//   console.error('❌ Server Error:', err.stack);
//   res.status(500).json({ message: 'Something went wrong!' });
// });

// // ------------------------ START SERVER ------------------------ //
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () =>
//   console.log(`🚀 Devlupa backend running on port ${PORT}`)
// );

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

// ------------------------ CONNECT TO DB ------------------------ //
connectDB();

// ------------------------ INITIALIZE APP ------------------------ //
const app = express();

// ------------------------ CORS CONFIGURATION ------------------------ //
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or server-to-server calls)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'https://devlupa-frontend.onrender.com',
      'https://devlupa-backend.onrender.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// ------------------------ MIDDLEWARE ------------------------ //
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------ STATIC FILES ------------------------ //
// Serve uploaded files (e.g., CVs, assignment submissions)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------------ ROOT ROUTE ------------------------ //
app.get('/', (req, res) => {
  res.json({
    message: '🚀 DevLupa Backend is running successfully!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      users: '/api/users',
      admin: '/api/admin',
      quizzes: '/api/quizzes',
      assignments: '/api/assignments'
    }
  });
});

// ------------------------ HEALTH CHECK ROUTE ------------------------ //
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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

// ------------------------ 404 HANDLER ------------------------ //
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: {
      root: '/',
      health: '/health',
      auth: '/api/auth',
      courses: '/api/courses',
      users: '/api/users',
      admin: '/api/admin',
      quizzes: '/api/quizzes',
      assignments: '/api/assignments'
    }
  });
});

// ------------------------ ERROR HANDLER ------------------------ //
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS Error: Origin not allowed',
      error: 'Access from your domain is not permitted'
    });
  }
  
  // Other errors
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// ------------------------ START SERVER ------------------------ //
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DevLupa backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${corsOptions.origin}`);
});
