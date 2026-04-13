/**
 * Settings Controller
 * Handles library settings CRUD operations
 */

const Settings = require('../models/Settings');

// GET /api/settings — Retrieve current settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/settings — Update settings
exports.updateSettings = async (req, res) => {
  try {
    const allowedFields = [
      'libraryName', 'libraryTagline', 'contactEmail', 'contactPhone', 'address',
      'maxBooksPerStudent', 'defaultLoanDays', 'maxRenewals',
      'finePerDay', 'maxFineAmount', 'gracePeriodDays',
      'enableEmailNotifications', 'dueDateReminderDays', 'enableOverdueAlerts',
      'allowStudentRegistration', 'maintenanceMode', 'maintenanceMessage',
    ];

    // Filter to only allowed fields
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const settings = await Settings.updateSettings(updates);
    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/settings/reset — Reset to defaults
exports.resetSettings = async (req, res) => {
  try {
    await Settings.deleteMany({});
    const settings = await Settings.getSettings(); // Creates fresh defaults
    res.json({ success: true, data: settings, message: 'Settings reset to defaults' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
