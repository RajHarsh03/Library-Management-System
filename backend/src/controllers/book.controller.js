/**
 * Book Controller
 * Handles CRUD operations for books
 */

const { validationResult } = require('express-validator');
const Book = require('../models/Book');
const { success, error, paginated, validationError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * @desc    Get all books with pagination and filters
 * @route   GET /api/books
 * @access  Public/Private
 */
const getBooks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      format,
      availability,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // Build query
    const query = { isDeleted: false };

    // Search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'authors.name': { $regex: search, $options: 'i' } },
        { isbn: search },
        { isbn13: search },
        { sku: search.toUpperCase() },
      ];
    }

    // Filters
    if (status) query.status = status;
    if (category) query.categories = { $in: [category] };
    if (format) query.format = format;
    if (availability === 'available') {
      query.availableCopies = { $gt: 0 };
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [books, total] = await Promise.all([
      Book.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Book.countDocuments(query),
    ]);

    logger.info('Books retrieved', { count: books.length, total });

    paginated(res, 'Books retrieved successfully', books, {
      page,
      limit,
      total,
    });
  } catch (err) {
    logger.error('Get books error', { error: err.message });
    error(res, 'Error retrieving books', 500);
  }
};

/**
 * @desc    Get single book by ID
 * @route   GET /api/books/:id
 * @access  Public/Private
 */
const getBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).lean();

    if (!book || book.isDeleted) {
      return error(res, 'Book not found', 404);
    }

    // Increment view count
    await Book.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    success(res, 'Book retrieved successfully', { book });
  } catch (err) {
    logger.error('Get book error', { error: err.message, bookId: req.params.id });
    error(res, 'Error retrieving book', 500);
  }
};

/**
 * @desc    Create new book
 * @route   POST /api/books
 * @access  Private (Admin/Librarian)
 */
const createBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const bookData = {
      ...req.body,
      addedBy: req.user._id,
    };

    // Parse JSON string fields that come from FormData
    if (typeof bookData.authors === 'string') {
      try { bookData.authors = JSON.parse(bookData.authors); } catch(e) {}
    }
    if (typeof bookData.categories === 'string') {
      try { bookData.categories = JSON.parse(bookData.categories); } catch(e) {}
    }

    // Handle cover image upload
    if (req.file) {
      bookData.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    // Ensure availableCopies doesn't exceed totalCopies
    if (bookData.availableCopies > bookData.totalCopies) {
      bookData.availableCopies = bookData.totalCopies;
    }

    const book = await Book.create(bookData);

    logger.info('Book created', {
      bookId: book._id,
      title: book.title,
      addedBy: req.user._id,
    });

    success(res, 'Book created successfully', { book }, 201);
  } catch (err) {
    logger.error('Create book error', { error: err.message });
    
    if (err.code === 11000) {
      return error(res, 'Book with this ISBN/SKU already exists', 400);
    }
    
    error(res, 'Error creating book', 500);
  }
};

/**
 * @desc    Update book
 * @route   PUT /api/books/:id
 * @access  Private (Admin/Librarian)
 */
const updateBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const book = await Book.findById(req.params.id);

    if (!book || book.isDeleted) {
      return error(res, 'Book not found', 404);
    }

    // Update fields
    const updateData = {
      ...req.body,
      updatedBy: req.user._id,
    };

    // Parse JSON string fields that come from FormData
    if (typeof updateData.authors === 'string') {
      try { updateData.authors = JSON.parse(updateData.authors); } catch(e) {}
    }
    if (typeof updateData.categories === 'string') {
      try { updateData.categories = JSON.parse(updateData.categories); } catch(e) {}
    }

    // Handle cover image upload
    if (req.file) {
      updateData.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    // Prevent direct modification of availableCopies (use borrow/return instead)
    delete updateData.availableCopies;
    delete updateData.borrowCount;
    delete updateData.viewCount;

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    logger.info('Book updated', {
      bookId: updatedBook._id,
      title: updatedBook.title,
      updatedBy: req.user._id,
    });

    success(res, 'Book updated successfully', { book: updatedBook });
  } catch (err) {
    logger.error('Update book error', { error: err.message, bookId: req.params.id });
    
    if (err.code === 11000) {
      return error(res, 'Book with this ISBN/SKU already exists', 400);
    }
    
    error(res, 'Error updating book', 500);
  }
};

/**
 * @desc    Delete book (soft delete)
 * @route   DELETE /api/books/:id
 * @access  Private (Admin)
 */
const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book || book.isDeleted) {
      return error(res, 'Book not found', 404);
    }

    // Check if book is currently issued
    if (book.status === 'issued' && book.availableCopies < book.totalCopies) {
      return error(res, 'Cannot delete book that is currently issued', 400);
    }

    await book.softDelete();

    logger.info('Book deleted', {
      bookId: book._id,
      title: book.title,
      deletedBy: req.user._id,
    });

    success(res, 'Book deleted successfully');
  } catch (err) {
    logger.error('Delete book error', { error: err.message, bookId: req.params.id });
    error(res, 'Error deleting book', 500);
  }
};

/**
 * @desc    Restore deleted book
 * @route   PATCH /api/books/:id/restore
 * @access  Private (Admin)
 */
const restoreBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return error(res, 'Book not found', 404);
    }

    if (!book.isDeleted) {
      return error(res, 'Book is not deleted', 400);
    }

    await book.restore();

    logger.info('Book restored', {
      bookId: book._id,
      title: book.title,
      restoredBy: req.user._id,
    });

    success(res, 'Book restored successfully', { book });
  } catch (err) {
    logger.error('Restore book error', { error: err.message, bookId: req.params.id });
    error(res, 'Error restoring book', 500);
  }
};

/**
 * @desc    Get book categories
 * @route   GET /api/books/categories
 * @access  Public
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Book.distinct('categories', { isDeleted: false });

    success(res, 'Categories retrieved successfully', { categories });
  } catch (err) {
    logger.error('Get categories error', { error: err.message });
    error(res, 'Error retrieving categories', 500);
  }
};

/**
 * @desc    Get book statistics
 * @route   GET /api/books/stats
 * @access  Private (Admin/Librarian)
 */
const getStats = async (req, res) => {
  try {
    const stats = await Book.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalBooks: { $sum: 1 },
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' },
          totalBorrowed: { $sum: '$borrowCount' },
          avgRating: { $avg: '$rating.average' },
        },
      },
    ]);

    const statusCount = await Book.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryCount = await Book.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    success(res, 'Book statistics retrieved', {
      overview: stats[0] || {
        totalBooks: 0,
        totalCopies: 0,
        availableCopies: 0,
        totalBorrowed: 0,
        avgRating: 0,
      },
      byStatus: statusCount.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      topCategories: categoryCount,
    });
  } catch (err) {
    logger.error('Get book stats error', { error: err.message });
    error(res, 'Error retrieving statistics', 500);
  }
};

/**
 * @desc    Bulk add books
 * @route   POST /api/books/bulk
 * @access  Private (Admin/Librarian)
 */
const bulkCreate = async (req, res) => {
  try {
    const { books } = req.body;

    if (!Array.isArray(books) || books.length === 0) {
      return error(res, 'Please provide an array of books', 400);
    }

    const booksWithUser = books.map(book => ({
      ...book,
      addedBy: req.user._id,
    }));

    const createdBooks = await Book.insertMany(booksWithUser, {
      ordered: false, // Continue on error
    });

    logger.info('Bulk books created', {
      count: createdBooks.length,
      addedBy: req.user._id,
    });

    success(res, `${createdBooks.length} books created successfully`, {
      books: createdBooks,
    }, 201);
  } catch (err) {
    logger.error('Bulk create books error', { error: err.message });
    error(res, 'Error creating books', 500);
  }
};

module.exports = {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  restoreBook,
  getCategories,
  getStats,
  bulkCreate,
};
