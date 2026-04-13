/**
 * API Response Utilities
 * Standardized response format for all API endpoints
 */

/**
 * Success Response
 * @param {Object} res - Express response object
 * @param {String} message - Success message
 * @param {Object} data - Response data
 * @param {Number} statusCode - HTTP status code
 */
const success = (res, message = 'Success', data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error Response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code
 * @param {Object} errors - Detailed errors (validation errors, etc.)
 */
const error = (res, message = 'Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated Response
 * @param {Object} res - Express response object
 * @param {String} message - Success message
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination metadata
 */
const paginated = (res, message = 'Success', data = [], pagination = {}) => {
  const { page = 1, limit = 10, total = 0 } = pagination;
  
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Validation Error Response
 * @param {Object} res - Express response object
 * @param {Array} errors - Validation errors from express-validator
 */
const validationError = (res, errors) => {
  const formattedErrors = errors.array().map(err => ({
    field: err.path,
    message: err.msg,
    value: err.value,
  }));

  return error(res, 'Validation Error', 400, formattedErrors);
};

module.exports = {
  success,
  error,
  paginated,
  validationError,
};
