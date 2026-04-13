/**
 * Book Model
 * Defines the Book schema and methods for library management
 */

const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: [true, 'Book title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    index: true,
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: [200, 'Subtitle cannot exceed 200 characters'],
  },
  
  // Authors
  authors: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['author', 'editor', 'translator', 'contributor'],
      default: 'author',
    },
  }],
  
  // Identifiers
  isbn: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  isbn13: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
  },
  
  // Publishing Info
  publisher: {
    type: String,
    trim: true,
    maxlength: [100, 'Publisher name cannot exceed 100 characters'],
  },
  publishedDate: {
    type: Date,
  },
  edition: {
    type: String,
    trim: true,
    maxlength: [50, 'Edition cannot exceed 50 characters'],
  },
  language: {
    type: String,
    default: 'English',
    trim: true,
  },
  
  // Physical Attributes
  format: {
    type: String,
    enum: ['hardcover', 'paperback', 'ebook', 'audiobook', 'pdf'],
    default: 'paperback',
  },
  pages: {
    type: Number,
    min: [1, 'Pages must be at least 1'],
  },
  
  // Categorization
  categories: [{
    type: String,
    trim: true,
  }],
  genres: [{
    type: String,
    trim: true,
  }],
  tags: [{
    type: String,
    trim: true,
  }],
  
  // Content
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  tableOfContents: [{
    title: String,
    page: Number,
  }],
  
  // Media
  coverImage: {
    type: String, // URL to cover image
    default: null,
  },
  thumbnail: {
    type: String, // URL to thumbnail
    default: null,
  },
  
  // Library-specific
  status: {
    type: String,
    enum: ['available', 'issued', 'reserved', 'maintenance', 'lost', 'archived'],
    default: 'available',
    index: true,
  },
  totalCopies: {
    type: Number,
    default: 1,
    min: [0, 'Total copies cannot be negative'],
  },
  availableCopies: {
    type: Number,
    default: 1,
    min: [0, 'Available copies cannot be negative'],
  },
  location: {
    shelf: String,
    row: String,
    section: String,
  },
  
  // Acquisition
  acquisitionDate: {
    type: Date,
    default: Date.now,
  },
  source: {
    type: String,
    enum: ['purchase', 'donation', 'exchange', 'gift'],
    default: 'purchase',
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
  },
  currency: {
    type: String,
    default: 'INR',
  },
  
  // Condition
  condition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
    default: 'good',
  },
  
  // Metadata
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Statistics
  borrowCount: {
    type: Number,
    default: 0,
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  
  // Reviews (embedded)
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
    date: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // External IDs
  googleBooksId: String,
  openLibraryId: String,
  goodreadsId: String,
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    select: false,
  },
  deletedAt: {
    type: Date,
    select: false,
  },
  
  // Timestamps
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for search and filtering
bookSchema.index({ title: 'text', description: 'text', 'authors.name': 'text' });
bookSchema.index({ status: 1, availableCopies: 1 });
bookSchema.index({ categories: 1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index({ borrowCount: -1 });

// Pre-save middleware to sync available copies
bookSchema.pre('save', function(next) {
  // Ensure availableCopies doesn't exceed totalCopies
  if (this.availableCopies > this.totalCopies) {
    this.availableCopies = this.totalCopies;
  }
  
  // Update status based on available copies
  if (this.availableCopies === 0 && this.status === 'available') {
    this.status = 'issued';
  } else if (this.availableCopies > 0 && this.status === 'issued') {
    this.status = 'available';
  }
  
  next();
});

// Instance method: Check if book is available for borrowing
bookSchema.methods.isAvailable = function() {
  return this.availableCopies > 0 && 
         this.status === 'available' && 
         !this.isDeleted;
};

// Instance method: Decrement available copies
bookSchema.methods.borrow = async function() {
  if (!this.isAvailable()) {
    throw new Error('Book is not available for borrowing');
  }
  
  this.availableCopies -= 1;
  this.borrowCount += 1;
  
  if (this.availableCopies === 0) {
    this.status = 'issued';
  }
  
  return this.save();
};

// Instance method: Increment available copies (return)
bookSchema.methods.return = async function() {
  this.availableCopies += 1;
  
  if (this.availableCopies > this.totalCopies) {
    this.availableCopies = this.totalCopies;
  }
  
  if (this.availableCopies > 0) {
    this.status = 'available';
  }
  
  return this.save();
};

// Instance method: Soft delete
bookSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = 'archived';
  return this.save();
};

// Instance method: Restore
bookSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.status = this.availableCopies > 0 ? 'available' : 'issued';
  return this.save();
};

// Static method: Search books
bookSchema.statics.search = async function(query, filters = {}) {
  const searchCriteria = {
    isDeleted: false,
  };
  
  // Text search
  if (query) {
    searchCriteria.$text = { $search: query };
  }
  
  // Apply filters
  if (filters.status) searchCriteria.status = filters.status;
  if (filters.category) searchCriteria.categories = { $in: [filters.category] };
  if (filters.format) searchCriteria.format = filters.format;
  if (filters.availability === 'available') {
    searchCriteria.availableCopies = { $gt: 0 };
  }
  
  let booksQuery = this.find(searchCriteria);
  
  // Sort by text score if searching
  if (query) {
    booksQuery = booksQuery.sort({ score: { $meta: 'textScore' } });
  }
  
  return booksQuery;
};

// Virtual for availability status text
bookSchema.virtual('availabilityText').get(function() {
  if (this.isDeleted) return 'Archived';
  if (this.availableCopies === 0) return 'Not Available';
  if (this.availableCopies < this.totalCopies) return 'Limited Copies';
  return 'Available';
});

// Virtual for popularity score
bookSchema.virtual('popularity').get(function() {
  return (this.borrowCount * 2) + (this.viewCount * 0.5) + (this.rating.count * 10);
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
