import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/response.js';

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

export default validate;
