/**
 * Transaction Routes
 * Handles book borrow, return, and transaction history
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Import controller
const {
  getTransactions,
  getTransaction,
  borrowBook,
  returnBook,
  renewBook,
  getOverdue,
  getStats,
  payFine,
} = require('../controllers/transaction.controller');

// Import middleware
const { protect, restrictTo } = require('../middleware/auth');

// Validation rules
const borrowValidation = [
  body('bookId')
    .trim()
    .notEmpty()
    .withMessage('Book ID is required'),
  body('userId')
    .trim()
    .notEmpty()
    .withMessage('User ID is required'),
  body('days')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Days must be between 1 and 30'),
];

const returnValidation = [
  body('transactionId')
    .trim()
    .notEmpty()
    .withMessage('Transaction ID is required'),
  body('condition')
    .optional()
    .isIn(['excellent', 'good', 'fair', 'poor', 'damaged'])
    .withMessage('Invalid condition value'),
];

const renewValidation = [
  body('days')
    .optional()
    .isInt({ min: 7, max: 30 })
    .withMessage('Days must be between 7 and 30'),
];

// All routes require authentication
router.use(protect);

// Admin/Librarian only routes
router.get('/', restrictTo('admin', 'librarian'), getTransactions);
router.get('/stats', restrictTo('admin', 'librarian'), getStats);
router.get('/overdue', restrictTo('admin', 'librarian'), getOverdue);
router.post('/borrow', restrictTo('admin', 'librarian'), borrowValidation, borrowBook);
router.post('/return', restrictTo('admin', 'librarian'), returnValidation, returnBook);
router.post('/:id/pay-fine', restrictTo('admin', 'librarian'), payFine);

// Shared routes (student can view own, admin can view any)
router.get('/:id', getTransaction);
router.post('/:id/renew', renewValidation, renewBook);

module.exports = router;
