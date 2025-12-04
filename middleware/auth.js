// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Protect routes by verifying JWT
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  // NOTE: We are NOT using cookies, only header tokens for API.

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route (No token)'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the admin object (without password) to the request
    req.admin = await Admin.findById(decoded.id)
      .select('-password')
      .populate('workerProfile');

    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route (Invalid token)'
      });
    }

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route (Token failed)'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if the role of the logged-in admin is included in the authorized roles
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: `Admin role ${req.admin.role} is not authorized to access this route`
      });
    }
    next();
  };
};