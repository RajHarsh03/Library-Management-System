/**
 * Student Controller
 * Handles student-specific operations
 */

const { validationResult } = require('express-validator');
const dayjs = require('dayjs');
const Book = require('../models/Book');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { success, error, paginated, validationError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * @desc    Browse books (search, filter, paginate)
 * @route   GET /api/student/browse
 * @access  Private (Student)
 */
const browseBooks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      availability,
      sortBy = 'popularity',
    } = req.query;

    const query = { isDeleted: false };

    // Search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'authors.name': { $regex: search, $options: 'i' } },
        { isbn: search },
      ];
    }

    // Category filter
    if (category) query.categories = { $in: [category] };

    // Availability filter
    if (availability === 'available') {
      query.availableCopies = { $gt: 0 };
    }

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'title':
        sortOptions = { title: 1 };
        break;
      case 'rating':
        sortOptions = { 'rating.average': -1 };
        break;
      case 'popularity':
      default:
        sortOptions = { borrowCount: -1 };
        break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [books, total] = await Promise.all([
      Book.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-reviews -tableOfContents -isDeleted')
        .lean(),
      Book.countDocuments(query),
    ]);

    // Add user's hold/borrow status for each book
    const userTransactions = await Transaction.find({
      user: req.user._id,
      book: { $in: books.map(b => b._id) },
      status: { $in: ['active', 'overdue', 'hold'] },
    }).select('book type status');

    const booksWithStatus = books.map(book => {
      const transaction = userTransactions.find(
        t => t.book.toString() === book._id.toString()
      );
      return {
        ...book,
        userStatus: transaction ? transaction.type : null,
        isAvailable: book.availableCopies > 0,
      };
    });

    paginated(res, 'Books retrieved', booksWithStatus, { page, limit, total });
  } catch (err) {
    logger.error('Browse books error', { error: err.message, userId: req.user._id });
    error(res, 'Error retrieving books', 500);
  }
};

/**
 * @desc    Get book details for student view
 * @route   GET /api/student/books/:id
 * @access  Private (Student)
 */
const getBookDetails = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .select('-isDeleted')
      .lean();

    if (!book || book.isDeleted) {
      return error(res, 'Book not found', 404);
    }

    // Check user's relationship with this book
    const activeTransaction = await Transaction.findOne({
      user: req.user._id,
      book: req.params.id,
      status: { $in: ['active', 'overdue', 'hold'] },
    });

    // Get hold queue position if on hold
    let holdPosition = null;
    if (activeTransaction?.type === 'hold') {
      const holdsBefore = await Transaction.countDocuments({
        book: req.params.id,
        type: 'hold',
        status: 'active',
        holdPosition: { $lt: activeTransaction.holdPosition },
      });
      holdPosition = holdsBefore + 1;
    }

    // Increment view count
    await Book.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    success(res, 'Book details retrieved', {
      book: {
        ...book,
        userStatus: activeTransaction?.type || null,
        transactionId: activeTransaction?._id || null,
        dueDate: activeTransaction?.dueDate || null,
        holdPosition,
        isAvailable: book.availableCopies > 0,
      },
    });
  } catch (err) {
    logger.error('Get book details error', { error: err.message });
    error(res, 'Error retrieving book details', 500);
  }
};

/**
 * @desc    Get student's current loans
 * @route   GET /api/student/my-books
 * @access  Private (Student)
 */
const getMyBooks = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find({
        user: req.user._id,
        type: 'borrow',
        status: { $in: ['active', 'overdue'] },
      })
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('book', 'title authors isbn coverImage')
        .lean(),
      Transaction.countDocuments({
        user: req.user._id,
        type: 'borrow',
        status: { $in: ['active', 'overdue'] },
      }),
    ]);

    // Add calculated fields
    const loansWithDetails = transactions.map(loan => {
      const daysRemaining = dayjs(loan.dueDate).diff(dayjs(), 'day');
      const daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;
      const fineAmount = daysOverdue * 5;

      return {
        ...loan,
        daysRemaining: Math.max(0, daysRemaining),
        daysOverdue,
        fineAmount,
        canRenew: daysRemaining >= 0 && loan.renewalCount < loan.maxRenewals,
      };
    });

    paginated(res, 'Your current loans retrieved', loansWithDetails, {
      page,
      limit,
      total,
    });
  } catch (err) {
    logger.error('Get my books error', { error: err.message, userId: req.user._id });
    error(res, 'Error retrieving your books', 500);
  }
};

/**
 * @desc    Get student's loan history
 * @route   GET /api/student/history
 * @access  Private (Student)
 */
const getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const { transactions, total } = await Transaction.getUserHistory(
      req.user._id,
      parseInt(page),
      parseInt(limit)
    );

    paginated(res, 'Loan history retrieved', transactions, { page, limit, total });
  } catch (err) {
    logger.error('Get history error', { error: err.message, userId: req.user._id });
    error(res, 'Error retrieving history', 500);
  }
};

/**
 * @desc    Place a hold on a book
 * @route   POST /api/student/hold
 * @access  Private (Student)
 */
const placeHold = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { bookId } = req.body;

    // Check book
    const book = await Book.findById(bookId);
    if (!book || book.isDeleted) {
      return error(res, 'Book not found', 404);
    }

    // Check if user already has this book
    const existingTransaction = await Transaction.findOne({
      user: req.user._id,
      book: bookId,
      status: { $in: ['active', 'overdue', 'hold'] },
    });

    if (existingTransaction) {
      if (existingTransaction.type === 'borrow') {
        return error(res, 'You already have this book borrowed', 400);
      }
      if (existingTransaction.type === 'hold') {
        return error(res, 'You already have a hold on this book', 400);
      }
    }

    // Check user's borrowing limit (including holds)
    const activeHolds = await Transaction.countDocuments({
      user: req.user._id,
      type: 'hold',
      status: 'active',
    });

    const totalActive = req.user.currentBooksIssued + activeHolds;
    if (totalActive >= req.user.maxBooksAllowed) {
      return error(res, `You have reached your maximum limit (${req.user.maxBooksAllowed} items)`, 400);
    }

    // Calculate hold position
    const holdsCount = await Transaction.countDocuments({
      book: bookId,
      type: 'hold',
      status: 'active',
    });

    // Create hold transaction
    const hold = await Transaction.create({
      book: bookId,
      user: req.user._id,
      type: 'hold',
      status: 'active',
      holdPosition: holdsCount + 1,
      holdExpiresAt: dayjs().add(7, 'days').toDate(),
    });

    logger.info('Hold placed', {
      holdId: hold._id,
      bookId,
      userId: req.user._id,
      position: hold.holdPosition,
    });

    success(res, 'Hold placed successfully', {
      hold: await Transaction.findById(hold._id)
        .populate('book', 'title authors')
        .populate('user', 'firstName lastName'),
      position: hold.holdPosition,
    }, 201);
  } catch (err) {
    logger.error('Place hold error', { error: err.message, userId: req.user._id });
    error(res, 'Error placing hold', 500);
  }
};

/**
 * @desc    Cancel a hold
 * @route   DELETE /api/student/hold/:id
 * @access  Private (Student)
 */
const cancelHold = async (req, res) => {
  try {
    const hold = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id,
      type: 'hold',
      status: 'active',
    });

    if (!hold) {
      return error(res, 'Hold not found', 404);
    }

    hold.status = 'cancelled';
    hold.type = 'hold_cancel';
    await hold.save();

    // Reorder remaining holds
    const remainingHolds = await Transaction.find({
      book: hold.book,
      type: 'hold',
      status: 'active',
      holdPosition: { $gt: hold.holdPosition },
    }).sort({ holdPosition: 1 });

    for (let i = 0; i < remainingHolds.length; i++) {
      remainingHolds[i].holdPosition = hold.holdPosition + i;
      await remainingHolds[i].save();
    }

    logger.info('Hold cancelled', {
      holdId: hold._id,
      bookId: hold.book,
      userId: req.user._id,
    });

    success(res, 'Hold cancelled successfully');
  } catch (err) {
    logger.error('Cancel hold error', { error: err.message });
    error(res, 'Error cancelling hold', 500);
  }
};

/**
 * @desc    Get student's holds
 * @route   GET /api/student/holds
 * @access  Private (Student)
 */
const getMyHolds = async (req, res) => {
  try {
    const holds = await Transaction.find({
      user: req.user._id,
      type: 'hold',
      status: 'active',
    })
      .sort({ holdPosition: 1 })
      .populate('book', 'title authors coverImage availableCopies')
      .lean();

    // Add estimated availability
    const holdsWithEstimate = holds.map(hold => ({
      ...hold,
      estimatedAvailability: hold.book.availableCopies > 0 
        ? 'Soon (book available)' 
        : `Approximately ${hold.holdPosition * 14} days`,
    }));

    success(res, 'Your holds retrieved', { holds: holdsWithEstimate, count: holds.length });
  } catch (err) {
    logger.error('Get my holds error', { error: err.message, userId: req.user._id });
    error(res, 'Error retrieving your holds', 500);
  }
};

/**
 * @desc    Get student dashboard data
 * @route   GET /api/student/dashboard
 * @access  Private (Student)
 */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Parallel queries for dashboard data
    const [
      activeLoans,
      overdueLoans,
      holds,
      recentActivity,
      recommendedBooks,
    ] = await Promise.all([
      // Active loans
      Transaction.find({
        user: userId,
        type: 'borrow',
        status: { $in: ['active', 'overdue'] },
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .populate('book', 'title authors coverImage')
        .lean(),

      // Overdue count
      Transaction.countDocuments({
        user: userId,
        type: 'borrow',
        status: 'overdue',
      }),

      // Active holds
      Transaction.countDocuments({
        user: userId,
        type: 'hold',
        status: 'active',
      }),

      // Recent activity (last 5)
      Transaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('book', 'title')
        .lean(),

      // Recommended books (popular in user's categories)
      Book.find({
        isDeleted: false,
        availableCopies: { $gt: 0 },
      })
        .sort({ borrowCount: -1 })
        .limit(4)
        .select('title authors coverImage borrowCount rating')
        .lean(),
    ]);

    // Calculate stats
    const stats = {
      activeLoans: activeLoans.length,
      overdueLoans,
      holds,
      maxAllowed: req.user.maxBooksAllowed,
      available: req.user.maxBooksAllowed - activeLoans.length - holds,
      fineAmount: req.user.fineAmount,
    };

    // Add due info to loans
    const loansWithDueInfo = activeLoans.map(loan => {
      const daysRemaining = dayjs(loan.dueDate).diff(dayjs(), 'day');
      return {
        ...loan,
        daysRemaining,
        isOverdue: daysRemaining < 0,
        daysOverdue: daysRemaining < 0 ? Math.abs(daysRemaining) : 0,
      };
    });

    success(res, 'Dashboard data retrieved', {
      stats,
      activeLoans: loansWithDueInfo,
      recentActivity,
      recommendedBooks,
    });
  } catch (err) {
    logger.error('Get dashboard error', { error: err.message, userId: req.user._id });
    error(res, 'Error retrieving dashboard data', 500);
  }
};

/**
 * @desc    Get categories with book counts
 * @route   GET /api/student/categories
 * @access  Private (Student)
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Book.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 },
          availableCount: {
            $sum: {
              $cond: [{ $gt: ['$availableCopies', 0] }, 1, 0],
            },
          },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          name: '$_id',
          count: 1,
          availableCount: 1,
          _id: 0,
        },
      },
    ]);

    success(res, 'Categories retrieved', { categories });
  } catch (err) {
    logger.error('Get categories error', { error: err.message });
    error(res, 'Error retrieving categories', 500);
  }
};

module.exports = {
  browseBooks,
  getBookDetails,
  getMyBooks,
  getHistory,
  placeHold,
  cancelHold,
  getMyHolds,
  getDashboard,
  getCategories,
};
