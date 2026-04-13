/**
 * Book Routes
 * Handles book CRUD operations
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Import controller
const {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  restoreBook,
  getCategories,
  getStats,
  bulkCreate,
} = require('../controllers/book.controller');

// Import middleware
const { protect, restrictTo } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Validation rules
const bookValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('authors')
    .isArray({ min: 1 })
    .withMessage('At least one author is required'),
  body('authors.*.name')
    .trim()
    .notEmpty()
    .withMessage('Author name is required'),
  body('isbn')
    .optional()
    .trim()
    .isISBN()
    .withMessage('Invalid ISBN format'),
  body('isbn13')
    .optional()
    .trim()
    .isISBN(13)
    .withMessage('Invalid ISBN-13 format'),
  body('totalCopies')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Total copies must be at least 1'),
  body('availableCopies')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Available copies cannot be negative'),
  body('pages')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Pages must be at least 1'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price cannot be negative'),
  body('status')
    .optional()
    .isIn(['available', 'issued', 'reserved', 'maintenance', 'lost', 'archived'])
    .withMessage('Invalid status value'),
];

const updateValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('totalCopies')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Total copies must be at least 1'),
  body('pages')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Pages must be at least 1'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price cannot be negative'),
];

// Middleware to parse JSON string fields from multipart/form-data
function parseFormDataJson(req, res, next) {
  // When using FormData, arrays come as JSON strings — parse them
  if (typeof req.body.authors === 'string') {
    try { req.body.authors = JSON.parse(req.body.authors); } catch (e) { /* leave as-is */ }
  }
  if (typeof req.body.categories === 'string') {
    try { req.body.categories = JSON.parse(req.body.categories); } catch (e) { /* leave as-is */ }
  }
  // Parse numeric fields
  if (req.body.totalCopies) req.body.totalCopies = Number(req.body.totalCopies);
  if (req.body.pages) req.body.pages = Number(req.body.pages);
  if (req.body.price) req.body.price = Number(req.body.price);
  next();
}

// Public routes
router.get('/', getBooks);
router.get('/categories', getCategories);
router.get('/stats', protect, restrictTo('admin', 'librarian'), getStats);
router.get('/:id', getBook);

// Protected routes (Admin/Librarian only)
router.post('/', protect, restrictTo('admin', 'librarian'), upload.single('coverImage'), parseFormDataJson, bookValidation, createBook);
router.post('/bulk', protect, restrictTo('admin', 'librarian'), bulkCreate);
router.put('/:id', protect, restrictTo('admin', 'librarian'), upload.single('coverImage'), parseFormDataJson, updateValidation, updateBook);
router.delete('/:id', protect, restrictTo('admin'), deleteBook);
router.patch('/:id/restore', protect, restrictTo('admin'), restoreBook);

module.exports = router;
