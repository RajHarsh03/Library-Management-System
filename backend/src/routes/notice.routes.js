/**
 * Notice Routes
 * POST   /api/notices         — create notice (admin only)
 * GET    /api/notices         — list active notices (any authenticated user)
 * DELETE /api/notices/:id     — delete notice (admin only)
 */

const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const { protect, restrictTo } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/notices — List active notices (students & admins)
router.get('/', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const notices = await Notice.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('publishedBy', 'firstName lastName')
      .lean();

    const result = notices.map(n => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      priority: n.priority,
      publishedBy: n.publishedBy
        ? `${n.publishedBy.firstName} ${n.publishedBy.lastName}`
        : 'Admin',
      createdAt: n.createdAt,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notices — Create notice (admin only)
router.post('/', restrictTo('admin'), async (req, res) => {
  try {
    const { title, message, priority } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const notice = await Notice.create({
      title,
      message,
      priority: priority || 'normal',
      publishedBy: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Notice published', data: notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notices/:id — Delete / deactivate notice (admin only)
router.delete('/:id', restrictTo('admin'), async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found' });
    }
    res.json({ success: true, message: 'Notice removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
