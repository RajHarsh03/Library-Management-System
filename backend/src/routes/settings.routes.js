/**
 * Settings Routes
 * Admin-only settings management + public status endpoint
 */

const express = require('express');
const router = express.Router();

const { getSettings, updateSettings, resetSettings } = require('../controllers/settings.controller');
const { protect, restrictTo } = require('../middleware/auth');
const Settings = require('../models/Settings');

// ─── Public endpoint: returns only public-facing flags ───
// Used by login/signup pages to check maintenance & registration status
router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      success: true,
      data: {
        libraryName: settings.libraryName,
        libraryTagline: settings.libraryTagline,
        allowStudentRegistration: settings.allowStudentRegistration,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Admin-only routes ───
router.use(protect, restrictTo('admin'));

router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/reset', resetSettings);

module.exports = router;
