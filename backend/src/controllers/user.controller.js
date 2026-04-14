/**
 * User Controller (Admin)
 * Handles user management operations for administrators
 */

const { validationResult } = require('express-validator');
const User = require('../models/User');
const { success, error, paginated, validationError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * @desc    Get all users with pagination and filters
 * @route   GET /api/users
 * @access  Private (Admin)
 */
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // Build query
    const query = {};

    // Exclude deleted users (soft delete not implemented in User model, but good practice)
    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: search },
      ];
    }

    // Role filter
    if (role) query.role = role;
    // Status filter
    if (status) query.status = status;

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password') // Exclude password
        .lean(),
      User.countDocuments(query),
    ]);

    logger.info('Users retrieved', { count: users.length, total, requestedBy: req.user._id });

    paginated(res, 'Users retrieved successfully', users, {
      page,
      limit,
      total,
    });
  } catch (err) {
    logger.error('Get users error', { error: err.message });
    error(res, 'Error retrieving users', 500);
  }
};

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private (Admin)
 */
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();

    if (!user) {
      return error(res, 'User not found', 404);
    }

    success(res, 'User retrieved successfully', { user });
  } catch (err) {
    logger.error('Get user error', { error: err.message, userId: req.params.id });
    error(res, 'Error retrieving user', 500);
  }
};

/**
 * @desc    Create new user (admin only)
 * @route   POST /api/users
 * @access  Private (Admin)
 */
const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { firstName, lastName, email, password, role, status, course, year, maxBooksAllowed } = req.body;

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
      status: status || 'active',
    };

    // Add student-specific fields
    if (userData.role === 'student') {
      userData.studentId = await User.generateStudentId();
      if (course) userData.course = course;
      if (year) userData.year = year;
      if (maxBooksAllowed) userData.maxBooksAllowed = maxBooksAllowed;
    }

    // Add admin-specific
    if (userData.role === 'admin' || userData.role === 'librarian') {
      userData.maxBooksAllowed = maxBooksAllowed || 10;
    }

    const user = await User.create(userData);

    logger.info('User created by admin', {
      userId: user._id,
      email: user.email,
      role: user.role,
      createdBy: req.user._id,
    });

    // Send welcome notification to the new student
    if (user.role === 'student') {
      const Notification = require('../models/Notification');
      await Notification.createSystemNotification({
        title: 'Welcome to The Archivist!',
        message: `Hi ${user.firstName}, your account has been created by the administrator. Browse the catalog and start borrowing books!`,
        type: 'account',
        audience: 'user',
        user: user._id,
        icon: 'waving_hand',
        priority: 'normal',
      });
    }

    success(res, 'User created successfully', {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        studentId: user.studentId,
        createdAt: user.createdAt,
      },
    }, 201);
  } catch (err) {
    logger.error('Create user error', { error: err.message });
    
    if (err.code === 11000) {
      return error(res, 'User with this email or student ID already exists', 400);
    }
    
    error(res, 'Error creating user', 500);
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Admin)
 */
const updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return error(res, 'User not found', 404);
    }

    // Prevent changing own role (to prevent locking yourself out)
    if (req.params.id === req.user._id.toString() && req.body.role && req.body.role !== user.role) {
      return error(res, 'Cannot change your own role', 400);
    }

    // Build update object - exclude sensitive fields
    const updateData = {};
    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'course', 'year', 
                           'status', 'role', 'maxBooksAllowed', 'fineAmount'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    logger.info('User updated', {
      userId: updatedUser._id,
      updatedBy: req.user._id,
      changes: Object.keys(updateData),
    });

    success(res, 'User updated successfully', { user: updatedUser });
  } catch (err) {
    logger.error('Update user error', { error: err.message, userId: req.params.id });
    error(res, 'Error updating user', 500);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
const deleteUser = async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user._id.toString()) {
      return error(res, 'Cannot delete your own account', 400);
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return error(res, 'User not found', 404);
    }

    // Check if user has active books issued
    if (user.currentBooksIssued > 0) {
      return error(res, 'Cannot delete user with active book loans', 400);
    }

    await User.findByIdAndDelete(req.params.id);

    logger.info('User deleted', {
      userId: req.params.id,
      email: user.email,
      deletedBy: req.user._id,
    });

    success(res, 'User deleted successfully');
  } catch (err) {
    logger.error('Delete user error', { error: err.message, userId: req.params.id });
    error(res, 'Error deleting user', 500);
  }
};

/**
 * @desc    Update user status (active/suspend)
 * @route   PATCH /api/users/:id/status
 * @access  Private (Admin)
 */
const updateStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { status } = req.body;

    // Prevent suspending yourself
    if (req.params.id === req.user._id.toString()) {
      return error(res, 'Cannot change your own status', 400);
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return error(res, 'User not found', 404);
    }

    user.status = status;
    await user.save();

    logger.info('User status updated', {
      userId: user._id,
      status,
      updatedBy: req.user._id,
    });

    success(res, `User ${status === 'active' ? 'activated' : 'suspended'} successfully`, {
      user: {
        id: user._id,
        status: user.status,
      },
    });
  } catch (err) {
    logger.error('Update status error', { error: err.message, userId: req.params.id });
    error(res, 'Error updating user status', 500);
  }
};

/**
 * @desc    Reset user password (admin)
 * @route   PATCH /api/users/:id/reset-password
 * @access  Private (Admin)
 */
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { newPassword } = req.body;

    const user = await User.findById(req.params.id).select('+password');

    if (!user) {
      return error(res, 'User not found', 404);
    }

    user.password = newPassword;
    await user.save();

    logger.info('Password reset by admin', {
      userId: user._id,
      adminId: req.user._id,
    });

    success(res, 'Password reset successfully');
  } catch (err) {
    logger.error('Reset password error', { error: err.message, userId: req.params.id });
    error(res, 'Error resetting password', 500);
  }
};

/**
 * @desc    Get user statistics
 * @route   GET /api/users/stats
 * @access  Private (Admin)
 */
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });

    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const usersByStatus = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Users with fines
    const usersWithFines = await User.countDocuments({ fineAmount: { $gt: 0 } });
    const totalFines = await User.aggregate([
      { $match: { fineAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$fineAmount' } } },
    ]);

    success(res, 'User statistics retrieved', {
      overview: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        recentRegistrations,
      },
      byRole: usersByRole.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      byStatus: usersByStatus.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      fines: {
        usersWithFines,
        totalAmount: totalFines[0]?.total || 0,
      },
    });
  } catch (err) {
    logger.error('Get user stats error', { error: err.message });
    error(res, 'Error retrieving user statistics', 500);
  }
};

/**
 * @desc    Get students with overdue books
 * @route   GET /api/users/overdue
 * @access  Private (Admin/Librarian)
 */
const getOverdueUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Find users who have books and have fines
    const query = {
      currentBooksIssued: { $gt: 0 },
      fineAmount: { $gt: 0 },
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ fineAmount: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password')
        .lean(),
      User.countDocuments(query),
    ]);

    paginated(res, 'Users with overdue books retrieved', users, {
      page,
      limit,
      total,
    });
  } catch (err) {
    logger.error('Get overdue users error', { error: err.message });
    error(res, 'Error retrieving overdue users', 500);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateStatus,
  resetPassword,
  getStats,
  getOverdueUsers,
};
