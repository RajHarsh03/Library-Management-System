/**
 * Transaction Controller
 * Handles book borrow, return, renew, and fine operations
 */

const { validationResult } = require('express-validator');
const dayjs = require('dayjs');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const User = require('../models/User');
const { success, error, paginated, validationError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * @desc    Get all transactions with filters
 * @route   GET /api/transactions
 * @access  Private (Admin/Librarian)
 */
const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      userId,
      bookId,
      overdue,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.user = userId;
    if (bookId) query.book = bookId;
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $in: ['active', 'overdue'] };
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'firstName lastName email studentId')
        .populate('book', 'title authors isbn coverImage')
        .populate('processedBy', 'firstName lastName')
        .lean(),
      Transaction.countDocuments(query),
    ]);

    paginated(res, 'Transactions retrieved', transactions, { page, limit, total });
  } catch (err) {
    logger.error('Get transactions error', { error: err.message });
    error(res, 'Error retrieving transactions', 500);
  }
};

/**
 * @desc    Get transaction by ID
 * @route   GET /api/transactions/:id
 * @access  Private
 */
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('book', 'title authors isbn coverImage')
      .populate('processedBy', 'firstName lastName');

    if (!transaction) {
      return error(res, 'Transaction not found', 404);
    }

    // Students can only view their own transactions
    if (req.user.role === 'student' && transaction.user._id.toString() !== req.user._id.toString()) {
      return error(res, 'Not authorized to view this transaction', 403);
    }

    success(res, 'Transaction retrieved', { transaction });
  } catch (err) {
    logger.error('Get transaction error', { error: err.message });
    error(res, 'Error retrieving transaction', 500);
  }
};

/**
 * @desc    Borrow a book
 * @route   POST /api/transactions/borrow
 * @access  Private (Admin/Librarian - or self for students with approval)
 */
const borrowBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { bookId, userId, days = 14 } = req.body;

    // Check if book exists and is available
    const book = await Book.findById(bookId);
    if (!book || book.isDeleted) {
      return error(res, 'Book not found', 404);
    }

    if (!book.isAvailable()) {
      return error(res, 'Book is not available for borrowing', 400);
    }
    
    // Check if user exists and is active
    const user = await User.findById(userId);
    if (!user) {
      return error(res, 'User not found', 404);
    }

    if (user.status !== 'active') {
      return error(res, 'User account is not active', 403);
    }

    // Check user's borrowing limit
    const activeBorrows = await Transaction.countDocuments({
      user: userId,
      type: 'borrow',
      status: { $in: ['active', 'overdue'] },
    });

    if (activeBorrows >= user.maxBooksAllowed) {
      return error(res, `User has reached maximum borrowing limit (${user.maxBooksAllowed} books)`, 400);
    }

    // Check for pending fines
    if (user.fineAmount > 0) {
      return error(res, 'User has pending fines. Please clear fines before borrowing.', 400);
    }

    // Create transaction
    const dueDate = dayjs().add(days, 'day').toDate();
    const transaction = await Transaction.create({
      book: bookId,
      user: userId,
      type: 'borrow',
      dueDate,
      maxRenewals: user.role === 'student' ? 2 : 3,
    });

    // Update book
    await book.borrow();

    // Update user's book count
    user.currentBooksIssued = activeBorrows + 1;
    await user.save({ validateBeforeSave: false });

    logger.info('Book borrowed', {
      transactionId: transaction._id,
      bookId,
      userId,
      processedBy: req.user._id,
    });

    success(res, 'Book borrowed successfully', {
      transaction: await Transaction.findById(transaction._id)
        .populate('book', 'title authors')
        .populate('user', 'firstName lastName'),
    }, 201);
  } catch (err) {
    logger.error('Borrow book error', { error: err.message });
    error(res, 'Error borrowing book', 500);
  }
};

/**
 * @desc    Return a book
 * @route   POST /api/transactions/return
 * @access  Private (Admin/Librarian)
 */
const returnBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationError(res, errors);
    }

    const { transactionId, condition = 'good' } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return error(res, 'Transaction not found', 404);
    }

    if (transaction.type !== 'borrow' || transaction.status === 'completed') {
      return error(res, 'Invalid transaction for return', 400);
    }

    // Process return
    await transaction.returnBook(condition, req.user._id);

    // Update book
    const book = await Book.findById(transaction.book);
    await book.return();

    // Update user's book count and fines
    const user = await User.findById(transaction.user);
    user.currentBooksIssued = Math.max(0, user.currentBooksIssued - 1);
    
    // Add fine to user's account if applicable
    if (transaction.fineAmount > 0) {
      user.fineAmount += transaction.fineAmount;
    }
    
    await user.save({ validateBeforeSave: false });

    logger.info('Book returned', {
      transactionId,
      bookId: transaction.book,
      userId: transaction.user,
      fineAmount: transaction.fineAmount,
      processedBy: req.user._id,
    });

    success(res, 'Book returned successfully', {
      transaction: await Transaction.findById(transactionId)
        .populate('book', 'title authors')
        .populate('user', 'firstName lastName'),
      fineAmount: transaction.fineAmount,
    });
  } catch (err) {
    logger.error('Return book error', { error: err.message });
    error(res, 'Error returning book', 500);
  }
};

/**
 * @desc    Renew a book loan
 * @route   POST /api/transactions/:id/renew
 * @access  Private (Student - own loans only, Admin/Librarian - any)
 */
const renewBook = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return error(res, 'Transaction not found', 404);
    }

    // Students can only renew their own loans
    if (req.user.role === 'student' && transaction.user.toString() !== req.user._id.toString()) {
      return error(res, 'Not authorized to renew this loan', 403);
    }

    if (!transaction.canRenew()) {
      return error(res, 'This loan cannot be renewed', 400);
    }

    const days = req.body.days || 14;
    await transaction.renew(days);

    logger.info('Book renewed', {
      transactionId: transaction._id,
      newDueDate: transaction.dueDate,
      renewedBy: req.user._id,
    });

    success(res, 'Book renewed successfully', {
      transaction: await Transaction.findById(req.params.id)
        .populate('book', 'title authors')
        .populate('user', 'firstName lastName'),
    });
  } catch (err) {
    logger.error('Renew book error', { error: err.message });
    error(res, err.message || 'Error renewing book', 500);
  }
};

/**
 * @desc    Get overdue transactions
 * @route   GET /api/transactions/overdue
 * @access  Private (Admin/Librarian)
 */
const getOverdue = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // First, mark overdue transactions
    const overdueTransactions = await Transaction.getOverdue();
    for (const transaction of overdueTransactions) {
      if (transaction.status !== 'overdue') {
        await transaction.markOverdue();
      }
    }

    // Get paginated results
    const [transactions, total] = await Promise.all([
      Transaction.find({
        type: 'borrow',
        status: 'overdue',
      })
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'firstName lastName email studentId phone')
        .populate('book', 'title authors isbn')
        .lean(),
      Transaction.countDocuments({
        type: 'borrow',
        status: 'overdue',
      }),
    ]);

    // Add calculated fields
    const transactionsWithCalcs = transactions.map(t => ({
      ...t,
      daysOverdue: dayjs().diff(dayjs(t.dueDate), 'day'),
      currentFine: dayjs().diff(dayjs(t.dueDate), 'day') * 5,
    }));

    paginated(res, 'Overdue transactions retrieved', transactionsWithCalcs, {
      page,
      limit,
      total,
    });
  } catch (err) {
    logger.error('Get overdue error', { error: err.message });
    error(res, 'Error retrieving overdue transactions', 500);
  }
};

/**
 * @desc    Get transaction statistics
 * @route   GET /api/transactions/stats
 * @access  Private (Admin/Librarian)
 */
const getStats = async (req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();
    const thirtyDaysAgo = dayjs().subtract(30, 'days').toDate();

    const [
      totalTransactions,
      activeLoans,
      overdueCount,
      todayBorrowed,
      todayReturned,
      recentTransactions,
      fineStats,
    ] = await Promise.all([
      Transaction.countDocuments(),
      Transaction.countDocuments({
        type: 'borrow',
        status: { $in: ['active', 'overdue'] },
      }),
      Transaction.countDocuments({
        type: 'borrow',
        status: 'overdue',
      }),
      Transaction.countDocuments({
        type: 'borrow',
        createdAt: { $gte: today },
      }),
      Transaction.countDocuments({
        type: 'borrow',
        status: 'completed',
        returnDate: { $gte: today },
      }),
      Transaction.find({
        createdAt: { $gte: thirtyDaysAgo },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'firstName lastName')
        .populate('book', 'title'),
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            totalFines: { $sum: '$fineAmount' },
            paidFines: {
              $sum: {
                $cond: [{ $eq: ['$finePaid', true] }, '$fineAmount', 0],
              },
            },
            pendingFines: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$fineAmount', 0] }, { $eq: ['$finePaid', false] }] },
                  '$fineAmount',
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    success(res, 'Transaction statistics retrieved', {
      overview: {
        total: totalTransactions,
        active: activeLoans,
        overdue: overdueCount,
        todayBorrowed,
        todayReturned,
      },
      fines: fineStats[0] || {
        totalFines: 0,
        paidFines: 0,
        pendingFines: 0,
      },
      recentActivity: recentTransactions,
    });
  } catch (err) {
    logger.error('Get transaction stats error', { error: err.message });
    error(res, 'Error retrieving statistics', 500);
  }
};

/**
 * @desc    Pay fine for a transaction
 * @route   POST /api/transactions/:id/pay-fine
 * @access  Private (Admin/Librarian)
 */
const payFine = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return error(res, 'Transaction not found', 404);
    }

    if (transaction.fineAmount === 0 || transaction.finePaid) {
      return error(res, 'No pending fine for this transaction', 400);
    }

    transaction.finePaid = true;
    transaction.finePaidDate = new Date();
    transaction.type = 'fine_payment';
    await transaction.save();

    // Update user's total fine amount
    const user = await User.findById(transaction.user);
    user.fineAmount = Math.max(0, user.fineAmount - transaction.fineAmount);
    await user.save({ validateBeforeSave: false });

    logger.info('Fine paid', {
      transactionId: transaction._id,
      amount: transaction.fineAmount,
      paidBy: req.user._id,
    });

    success(res, 'Fine paid successfully', {
      transaction,
      remainingFines: user.fineAmount,
    });
  } catch (err) {
    logger.error('Pay fine error', { error: err.message });
    error(res, 'Error processing fine payment', 500);
  }
};

module.exports = {
  getTransactions,
  getTransaction,
  borrowBook,
  returnBook,
  renewBook,
  getOverdue,
  getStats,
  payFine,
};
