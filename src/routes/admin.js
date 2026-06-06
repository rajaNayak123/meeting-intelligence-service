import express from 'express';
import { runReminderJob } from '../services/reminderService.js';
import { successResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative endpoints
 */

/**
 * @swagger
 * /api/admin/trigger-reminders:
 *   post:
 *     tags: [Admin]
 *     summary: Manually trigger the overdue reminder job
 *     description: Immediately runs the reminder job - finds all overdue action items and sends Slack notifications. Useful for testing the integration.
 *     security: []
 *     responses:
 *       200:
 *         description: Job ran successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         processed:
 *                           type: integer
 *                         succeeded:
 *                           type: integer
 *                         failed:
 *                           type: integer
 */
router.post('/trigger-reminders', async (req, res, next) => {
  try {
    const traceId = res.locals.traceId;
    logger.info('Manual reminder trigger initiated', { traceId });

    const result = await runReminderJob();

    return successResponse(res, {
      message: 'Reminder job executed successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

export {router};
