/**
 * Digital Archivist API Server
 * Main entry point for the backend application
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const env = require('./config/env');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const bookRoutes = require('./routes/book.routes');
const userRoutes = require('./routes/user.routes');
const transactionRoutes = require('./routes/transaction.routes');
const studentRoutes = require('./routes/student.routes');
const settingsRoutes = require('./routes/settings.routes');

// Create Express app
const app = express();

// Connect to database and seed admin
(async () => {
  await connectDB();
  await seedAdmin();
})();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable CSP for dev (frontend uses inline styles/scripts)
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/settings', settingsRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../public')));

// Serve frontend pages (SPA-style routing for clean URLs)
const servePage = (pagePath) => (req, res) => {
  res.sendFile(path.join(__dirname, '../../public', pagePath));
};

// Auth pages
app.get('/', servePage('pages/auth/index.html'));
app.get('/login', servePage('pages/auth/index.html'));
app.get('/signup', servePage('pages/auth/signup.html'));
app.get('/forgot-password', servePage('pages/auth/forgot-password.html'));

// Admin pages
app.get('/admin/dashboard', servePage('pages/admin/dashboard.html'));
app.get('/admin/books', servePage('pages/admin/books.html'));
app.get('/admin/users', servePage('pages/admin/users.html'));
app.get('/admin/transactions', servePage('pages/admin/transactions.html'));
app.get('/admin/settings', servePage('pages/admin/settings.html'));

// Student pages
app.get('/student/dashboard', servePage('pages/student/dashboard.html'));
app.get('/student/browse', servePage('pages/student/browse.html'));
app.get('/student/my-books', servePage('pages/student/my-books.html'));

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
    timestamp: new Date().toISOString(),
  });
});

// For non-API routes, serve the login page as fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../../public/pages/auth/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(err.status || 500).json({
    success: false,
    message: env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Seed default admin user if none exists
 */
async function seedAdmin() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('Database not connected, skipping admin seed');
      return;
    }

    const User = require('./models/User');
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (!existingAdmin) {
      await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD,
        role: 'admin',
        status: 'active',
        maxBooksAllowed: 10,
      });
      logger.info('Default admin user created', { email: env.ADMIN_EMAIL });
    } else {
      logger.info('Admin user already exists', { email: existingAdmin.email });
    }
  } catch (err) {
    logger.error('Error seeding admin', { error: err.message });
  }
}

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
  logger.info(`Frontend: http://localhost:${PORT}/`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', { error: err.message });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
