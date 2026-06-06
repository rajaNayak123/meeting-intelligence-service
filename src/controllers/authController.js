import jwt from 'jsonwebtoken';
import User  from '../models/User';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already exists
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const traceId = res.locals.traceId;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 'EMAIL_EXISTS', 'Email address is already registered', 409);
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    logger.info('User registered', { traceId, userId: user._id, email });

    return successResponse(res, {
      user: { id: user._id, name: user.name, email: user.email },
      token
    }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const traceId = res.locals.traceId;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return errorResponse(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const token = generateToken(user._id);
    logger.info('User logged in', { traceId, userId: user._id });

    return successResponse(res, {
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     responses:
 *       200:
 *         description: Current user data
 */
const getMe = async (req, res, next) => {
  try {
    return successResponse(res, {
      user: { id: req.user._id, name: req.user.name, email: req.user.email }
    });
  } catch (error) {
    next(error);
  }
};

export { register, login, getMe };
