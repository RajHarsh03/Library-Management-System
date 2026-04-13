/**
 * Maintenance Mode Middleware
 * Blocks student API access when maintenance mode is enabled in settings.
 * Admin users bypass the check entirely.
 */

const Settings = require('../models/Settings');

const maintenanceGuard = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();

    if (!settings.maintenanceMode) {
      return next(); // Not in maintenance — proceed
    }

    // Admins always bypass maintenance
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    // Block students and unauthenticated users
    return res.status(503).json({
      success: false,
      maintenance: true,
      message: settings.maintenanceMessage || 'The library system is currently under maintenance. Please try again later.',
    });
  } catch (err) {
    // If settings can't be loaded, allow access (fail-open)
    return next();
  }
};

module.exports = maintenanceGuard;
