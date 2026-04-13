/**
 * Authentication Controller
 * Handles user registration, login, and token management
 */

const { validationResult } = require('express-validator');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { success, error, validationError } = require('../utils/response');
const { generateToken, setTokenCookie } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { firstName, lastName, email, password, role, course, year } = req.body;

    // Check if student registration is allowed (skip check for admin-created users)
    const isAdminCreating = req.user && req.user.role === 'admin';
    if (!isAdminCreating && (!role || role === 'student')) {
      try {
        const settings = await Settings.getSettings();
        if (!settings.allowStudentRegistration) {
          return error(res, 'Student registration is currently disabled. Please contact the administrator.', 403);
        }
      } catch (e) {
        // If settings can't be loaded, allow registration (fail-open)
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return error(res, 'User already exists with this email', 400);
    }

    // Prepare user data
    const userData = {
      firstName,
      lastName,
      email,
      password,
      role: role || 'student',
    };

    // Add student-specific fields
    if (userData.role === 'student') {
      userData.studentId = await User.generateStudentId();
      if (course) userData.course = course;
      if (year) userData.year = year;
    }

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    // Log successful registration
    logger.info('New user registered', {
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    // Return success (without password)
    success(res, 'Registration successful', {
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        maxBooksAllowed: user.maxBooksAllowed,
      },
    }, 201);
  } catch (err) {
    logger.error('Registration error', { error: err.message });
    error(res, 'Error creating user', 500);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return error(res, 'Invalid credentials', 401);
    }

    // Check if account is locked
    if (user.isLocked()) {
      return error(res, 'Account is temporarily locked. Please try again later', 403);
    }

    // Check if account is active
    if (user.status !== 'active') {
      return error(res, 'Account is not active. Please contact administrator', 403);
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment failed attempts
      await user.incrementLoginAttempts();
      
      logger.warn('Failed login attempt', { email, ip: req.ip });
      return error(res, 'Invalid credentials', 401);
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 },
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id);

    // Set cookie if requested
    if (req.body.rememberMe) {
      setTokenCookie(res, token);
    }

    // Log successful login
    logger.info('User logged in', {
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    // Return success
    success(res, 'Login successful', {
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        maxBooksAllowed: user.maxBooksAllowed,
        currentBooksIssued: user.currentBooksIssued,
        fineAmount: user.fineAmount,
      },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    error(res, 'Error logging in', 500);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    success(res, 'User profile retrieved', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        course: user.course,
        year: user.year,
        phone: user.phone,
        address: user.address,
        maxBooksAllowed: user.maxBooksAllowed,
        currentBooksIssued: user.currentBooksIssued,
        fineAmount: user.fineAmount,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    logger.error('Get profile error', { error: err.message });
    error(res, 'Error retrieving profile', 500);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/update-profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { firstName, lastName, phone, course, year, address } = req.body;

    // Build update object
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    if (course && req.user.role === 'student') updateData.course = course;
    if (year && req.user.role === 'student') updateData.year = year;
    if (address) updateData.address = address;

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    logger.info('Profile updated', { userId: user._id });

    success(res, 'Profile updated successfully', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        course: user.course,
        year: user.year,
      },
    });
  } catch (err) {
    logger.error('Update profile error', { error: err.message });
    error(res, 'Error updating profile', 500);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
const updatePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return error(res, 'Current password is incorrect', 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    logger.info('Password updated', { userId: user._id });

    success(res, 'Password updated successfully', { token });
  } catch (err) {
    logger.error('Update password error', { error: err.message });
    error(res, 'Error updating password', 500);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Clear cookie if exists
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    logger.info('User logged out', { userId: req.user._id });

    success(res, 'Logged out successfully');
  } catch (err) {
    error(res, 'Error logging out', 500);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
  logout,
};
