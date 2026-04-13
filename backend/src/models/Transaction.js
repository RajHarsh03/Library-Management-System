/**
 * Transaction Model
 * Handles book borrow/return transactions and holds/queue
 */

const mongoose = require('mongoose');
const dayjs = require('dayjs');
const Settings = require('./Settings');

const transactionSchema = new mongoose.Schema({
  // References
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Transaction Type
  type: {
    type: String,
    enum: ['borrow', 'return', 'renew', 'hold', 'hold_cancel', 'fine_payment'],
    required: true,
    index: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'overdue', 'cancelled'],
    default: 'active',
    index: true,
  },
  
  // Dates
  borrowDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
  },
  returnDate: {
    type: Date,
  },
  
  // Renewals
  renewalCount: {
    type: Number,
    default: 0,
  },
  maxRenewals: {
    type: Number,
    default: 2,
  },
  
  // Fine Calculation
  fineAmount: {
    type: Number,
    default: 0,
  },
  finePaid: {
    type: Boolean,
    default: false,
  },
  finePaidDate: {
    type: Date,
  },
  
  // Hold Queue Info (for holds)
  holdPosition: {
    type: Number,
    default: null,
  },
  holdExpiresAt: {
    type: Date,
    default: null,
  },
  
  // Book condition on return
  returnCondition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
  },
  
  // Notes
  notes: {
    type: String,
    trim: true,
  },
  
  // Processed by (for returns, etc.)
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for common queries
transactionSchema.index({ user: 1, status: 1 });
transactionSchema.index({ book: 1, status: 1 });
transactionSchema.index({ dueDate: 1, status: 1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

// Pre-save middleware
transactionSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Calculate fine if overdue and returned
  if (this.returnDate && this.status === 'completed' && this.dueDate < this.returnDate) {
    try {
      const settings = await Settings.getSettings();
      const totalDaysLate = dayjs(this.returnDate).diff(dayjs(this.dueDate), 'day');
      const daysOverdue = Math.max(0, totalDaysLate - (settings.gracePeriodDays || 0));
      let fine = daysOverdue * (settings.finePerDay || 5);
      if (settings.maxFineAmount > 0) fine = Math.min(fine, settings.maxFineAmount);
      this.fineAmount = fine;
    } catch (e) {
      const daysOverdue = dayjs(this.returnDate).diff(dayjs(this.dueDate), 'day');
      this.fineAmount = daysOverdue * 5;
    }
  }
  
  next();
});

// Instance method: Check if transaction is overdue
transactionSchema.methods.isOverdue = function() {
  if (this.status !== 'active' || this.type !== 'borrow') return false;
  return dayjs().isAfter(dayjs(this.dueDate));
};

// Instance method: Get days remaining
transactionSchema.methods.getDaysRemaining = function() {
  if (this.status !== 'active' || this.type !== 'borrow') return 0;
  return dayjs(this.dueDate).diff(dayjs(), 'day');
};

// Instance method: Get days overdue
transactionSchema.methods.getDaysOverdue = function() {
  if (!this.isOverdue()) return 0;
  return dayjs().diff(dayjs(this.dueDate), 'day');
};

// Instance method: Can renew
transactionSchema.methods.canRenew = function() {
  return this.type === 'borrow' && 
         this.status === 'active' && 
         this.renewalCount < this.maxRenewals &&
         !this.isOverdue();
};

// Instance method: Renew loan
transactionSchema.methods.renew = async function(days = 14) {
  if (!this.canRenew()) {
    throw new Error('Cannot renew this loan');
  }
  
  this.dueDate = dayjs(this.dueDate).add(days, 'day').toDate();
  this.renewalCount += 1;
  
  return this.save();
};

// Instance method: Return book
transactionSchema.methods.returnBook = async function(condition = 'good', processedBy = null) {
  this.returnDate = new Date();
  this.returnCondition = condition;
  this.status = 'completed';
  
  if (processedBy) {
    this.processedBy = processedBy;
  }
  
  // Calculate fine if overdue (settings-aware)
  if (this.dueDate < this.returnDate) {
    try {
      const settings = await Settings.getSettings();
      const totalDaysLate = dayjs(this.returnDate).diff(dayjs(this.dueDate), 'day');
      const daysOverdue = Math.max(0, totalDaysLate - (settings.gracePeriodDays || 0));
      let fine = daysOverdue * (settings.finePerDay || 5);
      if (settings.maxFineAmount > 0) fine = Math.min(fine, settings.maxFineAmount);
      this.fineAmount = fine;
    } catch (e) {
      const daysOverdue = dayjs(this.returnDate).diff(dayjs(this.dueDate), 'day');
      this.fineAmount = daysOverdue * 5;
    }
  }
  
  return this.save();
};

// Instance method: Mark as overdue
transactionSchema.methods.markOverdue = async function() {
  if (this.isOverdue() && this.status === 'active') {
    this.status = 'overdue';
    
    // Calculate current fine (settings-aware)
    try {
      const settings = await Settings.getSettings();
      const totalDaysLate = this.getDaysOverdue();
      const daysOverdue = Math.max(0, totalDaysLate - (settings.gracePeriodDays || 0));
      let fine = daysOverdue * (settings.finePerDay || 5);
      if (settings.maxFineAmount > 0) fine = Math.min(fine, settings.maxFineAmount);
      this.fineAmount = fine;
    } catch (e) {
      this.fineAmount = this.getDaysOverdue() * 5;
    }
    
    return this.save();
  }
  return this;
};

// Static method: Get overdue transactions
transactionSchema.statics.getOverdue = async function() {
  return this.find({
    type: 'borrow',
    status: { $in: ['active', 'overdue'] },
    dueDate: { $lt: new Date() },
  }).populate('user', 'firstName lastName email').populate('book', 'title authors');
};

// Static method: Get user's active borrows
transactionSchema.statics.getUserActiveBorrows = async function(userId) {
  return this.find({
    user: userId,
    type: 'borrow',
    status: { $in: ['active', 'overdue'] },
  }).populate('book', 'title authors isbn coverImage');
};

// Static method: Get book's active borrows
transactionSchema.statics.getBookActiveBorrows = async function(bookId) {
  return this.find({
    book: bookId,
    type: 'borrow',
    status: { $in: ['active', 'overdue'] },
  }).populate('user', 'firstName lastName email');
};

// Static method: Get user's transaction history
transactionSchema.statics.getUserHistory = async function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const [transactions, total] = await Promise.all([
    this.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('book', 'title authors coverImage')
      .lean(),
    this.countDocuments({ user: userId }),
  ]);
  
  return { transactions, total, page, limit };
};

// Virtual for fine status
transactionSchema.virtual('fineStatus').get(function() {
  if (this.fineAmount === 0) return 'no_fine';
  if (this.finePaid) return 'paid';
  return 'pending';
});

// Virtual for transaction duration
transactionSchema.virtual('duration').get(function() {
  const endDate = this.returnDate || new Date();
  return dayjs(endDate).diff(dayjs(this.borrowDate), 'day');
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
