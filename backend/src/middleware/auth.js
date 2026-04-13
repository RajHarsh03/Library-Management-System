/**
 * Authentication Middleware
 * JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { error } = require('../utils/response');

/**
 * Verify JWT token and attach user to request
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies (if cookie-parser is added later)
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return error(res, 'Not authorized to access this route', 401);
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, env.JWT_SECRET);

      // Check if user still exists
      const user = await User.findById(decoded.id);
      if (!user) {
        return error(res, 'User not found', 401);
      }

      // Check if user is active
      if (user.status !== 'active') {
        return error(res, 'Account is not active. Please contact administrator', 403);
      }

      // Check if account is locked
      if (user.isLocked()) {
        return error(res, 'Account is temporarily locked due to multiple failed login attempts', 403);
      }

      // Check if password was changed after token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return error(res, 'Password recently changed. Please log in again', 401);
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return error(res, 'Token expired. Please log in again', 401);
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return error(res, 'Invalid token', 401);
      }
      throw jwtError;
    }
  } catch (err) {
    return error(res, 'Not authorized to access this route', 401);
  }
};

/**
 * Restrict access to specific roles
 * @param  {...string} roles - Allowed roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Not authorized', 401);
    }

    if (!roles.includes(req.user.role)) {
      return error(res, 'Not authorized to perform this action', 403);
    }

    next();
  };
};

/**
 * Optional authentication - attach user if token valid, but don't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user && user.status === 'active' && !user.isLocked()) {
          req.user = user;
        }
      } catch (err) {
        // Silent fail - user not attached
      }
    }

    next();
  } catch (err) {
    next();
  }
};

/**
 * Generate JWT token
 * @param {string} id - User ID
 * @returns {string} JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE,
  });
};

/**
 * Generate refresh token (longer expiry)
 * @param {string} id - User ID
 * @returns {string} Refresh token
 */
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * Set token cookie (for cookie-based auth)
 * @param {Object} res - Express response
 * @param {string} token - JWT token
 */
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('token', token, cookieOptions);
};

module.exports = {
  protect,
  restrictTo,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  setTokenCookie,
};
