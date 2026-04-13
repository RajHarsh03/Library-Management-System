/**
 * Student Routes
 * Handles student-specific operations
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Import controller
const {
  browseBooks,
  getBookDetails,
  getMyBooks,
  getHistory,
  placeHold,
  cancelHold,
  getMyHolds,
  getDashboard,
  getCategories,
} = require('../controllers/student.controller');

// Import middleware
const { protect, restrictTo } = require('../middleware/auth');

// Validation rules
const holdValidation = [
  body('bookId')
    .trim()
    .notEmpty()
    .withMessage('Book ID is required'),
];

// All routes require student authentication
router.use(protect);
router.use(restrictTo('student'));

// Dashboard
router.get('/dashboard', getDashboard);

// Browse books
router.get('/browse', browseBooks);
router.get('/books/:id', getBookDetails);
router.get('/categories', getCategories);

// My books/loans
router.get('/my-books', getMyBooks);
router.get('/history', getHistory);

// Holds
router.get('/holds', getMyHolds);
router.post('/hold', holdValidation, placeHold);
router.delete('/hold/:id', cancelHold);

module.exports = router;
