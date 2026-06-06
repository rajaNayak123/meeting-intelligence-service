import express from 'express';
import { body, param, query } from 'express-validator';
import {
  createActionItem,
  updateStatus,
  listActionItems,
  getActionItem,
  getOverdueActionItems,
  deleteActionItem
} from '../controllers/actionItemController.js';
import authenticate from '../middleware/auth.js';
import validate from '../middleware/validate.js';
const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Action Items
 *   description: Action item management endpoints
 */

router.use(authenticate);

// Important: /overdue must come before /:id
router.get('/overdue',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  validate,
  getOverdueActionItems
);

router.post('/',
  [
    body('meetingId').isMongoId().withMessage('Valid meeting ID is required'),
    body('task').trim().notEmpty().withMessage('Task description is required').isLength({ max: 1000 }).withMessage('Task too long'),
    body('assignee').trim().notEmpty().withMessage('Assignee is required'),
    body('dueDate').isISO8601().withMessage('Due date must be a valid ISO 8601 date'),
    body('citations').optional().isArray().withMessage('Citations must be an array')
  ],
  validate,
  createActionItem
);

router.get('/',
  [
    query('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']).withMessage('Invalid status'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  validate,
  listActionItems
);

router.get('/:id',
  [param('id').isMongoId().withMessage('Invalid action item ID')],
  validate,
  getActionItem
);

router.patch('/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid action item ID'),
    body('status').isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']).withMessage('Status must be PENDING, IN_PROGRESS, or COMPLETED')
  ],
  validate,
  updateStatus
);

router.delete('/:id',
  [param('id').isMongoId().withMessage('Invalid action item ID')],
  validate,
  deleteActionItem
);

export {router};
