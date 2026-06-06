import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'UNAUTHORIZED', 'Authentication token is required', 401);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'TOKEN_EXPIRED', 'Authentication token has expired', 401);
      }
      return errorResponse(res, 'INVALID_TOKEN', 'Invalid authentication token', 401);
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return errorResponse(res, 'USER_NOT_FOUND', 'User associated with token not found', 401);
    }

    req.user = user;
    logger.debug('User authenticated', { traceId: res.locals.traceId, userId: user._id });
    next();
  } catch (error) {
    logger.error('Authentication error', { traceId: res.locals.traceId, error: error.message });
    return errorResponse(res, 'AUTH_ERROR', 'Authentication failed', 500);
  }
};

export { authenticate };
export default authenticate;
