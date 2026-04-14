/**
 * Notification Routes
 * GET /api/notifications        — list notifications for current user
 * POST /api/notifications/:id/read — mark as read
 * POST /api/notifications/read-all — mark all as read
 * GET /api/notifications/unread-count — get unread count
 */

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/notifications — List for current user (admin or student)
router.get('/', async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    let notifications;

    if (req.user.role === 'admin') {
      notifications = await Notification.getAdminNotifications(parseInt(limit));
    } else {
      notifications = await Notification.getStudentNotifications(req.user._id, parseInt(limit), req.user.createdAt);
    }

    // Mark which are read by this user
    const userId = req.user._id.toString();
    const result = notifications.map(n => ({
      ...n,
      read: n.readBy.some(id => id.toString() === userId),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    let notifications;
    if (req.user.role === 'admin') {
      notifications = await Notification.getAdminNotifications(50);
    } else {
      notifications = await Notification.getStudentNotifications(req.user._id, 50, req.user.createdAt);
    }
    const userId = req.user._id.toString();
    const unread = notifications.filter(n => !n.readBy.some(id => id.toString() === userId)).length;
    res.json({ success: true, data: { unread } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: req.user._id },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req, res) => {
  try {
    let filter;
    if (req.user.role === 'admin') {
      filter = { audience: { $in: ['admin', 'all'] } };
    } else {
      filter = {
        $or: [
          { user: req.user._id },
          {
            audience: { $in: ['student', 'all'] },
            ...(req.user.createdAt ? { createdAt: { $gte: req.user.createdAt } } : {}),
          },
        ],
      };
    }
    await Notification.updateMany(filter, { $addToSet: { readBy: req.user._id } });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
