import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createMeeting,
  getMeeting,
  listMeetings,
  analyzeMeetingEndpoint,
  deleteMeeting
} from '../controllers/meetingController.js';
import authenticate from '../middleware/auth.js';
import validate from '../middleware/validate.js';
const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Meetings
 *   description: Meeting management endpoints
 */

// All meeting routes require authentication
router.use(authenticate);

router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Meeting title is required').isLength({ max: 500 }).withMessage('Title too long'),
    body('participants').isArray({ min: 1 }).withMessage('At least one participant is required'),
    body('participants.*').isEmail().withMessage('Each participant must be a valid email address'),
    body('meetingDate').isISO8601().withMessage('Meeting date must be a valid ISO 8601 date'),
    body('transcript').optional().isArray().withMessage('Transcript must be an array'),
    body('transcript.*.timestamp').optional().notEmpty().withMessage('Transcript timestamp is required'),
    body('transcript.*.speaker').optional().trim().notEmpty().withMessage('Transcript speaker is required'),
    body('transcript.*.text').optional().trim().notEmpty().withMessage('Transcript text is required')
  ],
  validate,
  createMeeting
);

router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('from').optional().isISO8601().withMessage('From date must be a valid ISO 8601 date'),
    query('to').optional().isISO8601().withMessage('To date must be a valid ISO 8601 date')
  ],
  validate,
  listMeetings
);

router.get('/:id',
  [param('id').isMongoId().withMessage('Invalid meeting ID')],
  validate,
  getMeeting
);

router.post('/:id/analyze',
  [param('id').isMongoId().withMessage('Invalid meeting ID')],
  validate,
  analyzeMeetingEndpoint
);

router.delete('/:id',
  [param('id').isMongoId().withMessage('Invalid meeting ID')],
  validate,
  deleteMeeting
);

export { router };
