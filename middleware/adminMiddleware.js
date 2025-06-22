// middleware/adminMiddleware.js

function adminMiddleware(req, res, next) {
  // Assuming user role is stored in req.user.role by your authMiddleware
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied, admin only' });
  }
}

module.exports = adminMiddleware;
