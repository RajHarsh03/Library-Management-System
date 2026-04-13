/**
 * User Routes
 * Handles user management (admin only)
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Import controller
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateStatus,
  resetPassword,
  getStats,
  getOverdueUsers,
} = require('../controllers/user.controller');

// Import middleware
const { protect, restrictTo } = require('../middleware/auth');

// Validation rules
const createUserValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 }),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 }),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['student', 'admin', 'librarian'])
    .withMessage('Role must be student, admin, or librarian'),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'inactive'])
    .withMessage('Invalid status value'),
];

const updateUserValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }),
  body('role')
    .optional()
    .isIn(['student', 'admin', 'librarian']),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'inactive']),
  body('maxBooksAllowed')
    .optional()
    .isInt({ min: 1, max: 20 }),
  body('fineAmount')
    .optional()
    .isFloat({ min: 0 }),
];

const statusValidation = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'suspended', 'inactive'])
    .withMessage('Status must be active, suspended, or inactive'),
];

const resetPasswordValidation = [
  body('newPassword')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

// All routes require admin authentication
router.use(protect);
router.use(restrictTo('admin'));

// Statistics
router.get('/stats', getStats);
router.get('/overdue', getOverdueUsers);

// CRUD operations
router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', createUserValidation, createUser);
router.put('/:id', updateUserValidation, updateUser);
router.delete('/:id', deleteUser);

// Special operations
router.patch('/:id/status', statusValidation, updateStatus);
router.patch('/:id/reset-password', resetPasswordValidation, resetPassword);

module.exports = router;
