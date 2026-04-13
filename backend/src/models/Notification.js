/**
 * Notification Model
 * Stores system notifications for admins and students
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who this notification is for ('admin', 'student', 'all')
  audience: {
    type: String,
    enum: ['admin', 'student', 'all'],
    default: 'admin',
    index: true,
  },
  // Specific user (null = broadcast to audience)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  // Notification type
  type: {
    type: String,
    enum: ['system', 'overdue', 'due_reminder', 'account', 'maintenance', 'registration', 'fine', 'borrow', 'return'],
    required: true,
    index: true,
  },
  // Content
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  // Icon (Material Icons name)
  icon: {
    type: String,
    default: 'notifications',
  },
  // Priority for ordering
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  // Read status tracking per user (for broadcast notifications)
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  // Metadata (optional extra data like transactionId, bookId, etc.)
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Index for efficient queries
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ audience: 1, createdAt: -1 });

// Static: Get notifications for admin
notificationSchema.statics.getAdminNotifications = async function (limit = 20) {
  return this.find({ audience: { $in: ['admin', 'all'] } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static: Get notifications for a specific student
notificationSchema.statics.getStudentNotifications = async function (userId, limit = 20) {
  return this.find({
    $or: [
      { user: userId },
      { audience: { $in: ['student', 'all'] } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static: Create a system notification
notificationSchema.statics.createSystemNotification = async function ({ title, message, type = 'system', audience = 'admin', icon = 'notifications', priority = 'normal', user = null, meta = {} }) {
  return this.create({ title, message, type, audience, icon, priority, user, meta });
};

// Static: Get unread count for admin
notificationSchema.statics.getAdminUnreadCount = async function (adminId) {
  const notifications = await this.find({ audience: { $in: ['admin', 'all'] } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return notifications.filter(n => !n.readBy.some(id => id.toString() === adminId.toString())).length;
};

module.exports = mongoose.model('Notification', notificationSchema);
