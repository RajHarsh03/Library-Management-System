/**
 * Settings Controller
 * Handles library settings CRUD operations
 * Auto-generates notifications on critical setting changes
 */

const Settings = require('../models/Settings');
const Notification = require('../models/Notification');

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

    // Get previous settings for comparison
    const prevSettings = await Settings.getSettings();

    const settings = await Settings.updateSettings(updates);

    // ─── Auto-generate notifications on critical changes ───

    // Maintenance mode toggled ON
    if (updates.maintenanceMode === true && !prevSettings.maintenanceMode) {
      await Notification.createSystemNotification({
        title: 'Maintenance Mode Activated',
        message: settings.maintenanceMessage || 'The system is now in maintenance mode. Students cannot access the library.',
        type: 'maintenance',
        audience: 'all',
        icon: 'construction',
        priority: 'urgent',
      });
    }

    // Maintenance mode toggled OFF
    if (updates.maintenanceMode === false && prevSettings.maintenanceMode) {
      await Notification.createSystemNotification({
        title: 'System Restored',
        message: 'The library system has been restored. All services are now available.',
        type: 'maintenance',
        audience: 'all',
        icon: 'check_circle',
        priority: 'high',
      });
    }

    // Registration toggled OFF
    if (updates.allowStudentRegistration === false && prevSettings.allowStudentRegistration) {
      await Notification.createSystemNotification({
        title: 'Student Registration Disabled',
        message: 'New student registrations have been disabled by the administrator.',
        type: 'registration',
        audience: 'admin',
        icon: 'person_off',
        priority: 'normal',
      });
    }

    // Registration toggled ON
    if (updates.allowStudentRegistration === true && !prevSettings.allowStudentRegistration) {
      await Notification.createSystemNotification({
        title: 'Student Registration Enabled',
        message: 'Student self-registration has been re-enabled.',
        type: 'registration',
        audience: 'admin',
        icon: 'person_add',
        priority: 'normal',
      });
    }

    // Circulation policy changes
    const policyFields = ['maxBooksPerStudent', 'defaultLoanDays', 'finePerDay', 'maxFineAmount', 'gracePeriodDays', 'maxRenewals'];
    const changedPolicies = policyFields.filter(f => updates[f] !== undefined && updates[f] !== prevSettings[f]);
    if (changedPolicies.length > 0) {
      await Notification.createSystemNotification({
        title: 'Circulation Policies Updated',
        message: `The following policies were updated: ${changedPolicies.join(', ')}.`,
        type: 'system',
        audience: 'admin',
        icon: 'policy',
        priority: 'normal',
        meta: { changedFields: changedPolicies },
      });
    }

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

    await Notification.createSystemNotification({
      title: 'Settings Reset to Defaults',
      message: 'All system settings have been reset to their factory defaults by the administrator.',
      type: 'system',
      audience: 'admin',
      icon: 'settings_backup_restore',
      priority: 'high',
    });

    res.json({ success: true, data: settings, message: 'Settings reset to defaults' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
