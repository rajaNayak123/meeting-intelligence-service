const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    return errorResponse(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
  }
  next();
};

module.exports = validate;
