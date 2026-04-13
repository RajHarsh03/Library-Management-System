/**
 * Settings Model
 * Stores library-wide configuration settings
 */

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Library Information
  libraryName: {
    type: String,
    default: 'The Archivist',
    trim: true,
  },
  libraryTagline: {
    type: String,
    default: 'Digital Library Management System',
    trim: true,
  },
  contactEmail: {
    type: String,
    default: '',
    trim: true,
  },
  contactPhone: {
    type: String,
    default: '',
    trim: true,
  },
  address: {
    type: String,
    default: '',
    trim: true,
  },

  // Circulation Policies
  maxBooksPerStudent: {
    type: Number,
    default: 5,
    min: 1,
    max: 50,
  },
  defaultLoanDays: {
    type: Number,
    default: 14,
    min: 1,
    max: 365,
  },
  maxRenewals: {
    type: Number,
    default: 2,
    min: 0,
    max: 10,
  },
  finePerDay: {
    type: Number,
    default: 1.00,
    min: 0,
  },
  maxFineAmount: {
    type: Number,
    default: 50.00,
    min: 0,
  },
  gracePeriodDays: {
    type: Number,
    default: 1,
    min: 0,
    max: 30,
  },

  // Notification Settings
  enableEmailNotifications: {
    type: Boolean,
    default: false,
  },
  dueDateReminderDays: {
    type: Number,
    default: 2,
    min: 1,
    max: 14,
  },
  enableOverdueAlerts: {
    type: Boolean,
    default: true,
  },

  // System Settings
  allowStudentRegistration: {
    type: Boolean,
    default: true,
  },
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  maintenanceMessage: {
    type: String,
    default: 'The library system is currently under maintenance. Please try again later.',
    trim: true,
  },

}, { timestamps: true });

// Ensure only one settings document exists (singleton pattern)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

settingsSchema.statics.updateSettings = async function (updates) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(updates);
  } else {
    Object.assign(settings, updates);
    await settings.save();
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
