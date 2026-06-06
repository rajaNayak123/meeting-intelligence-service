import cron from 'node-cron';
import { ActionItem } from '../models/ActionItem.js';
import { sendOverdueReminder, sendOverdueSummary } from './slackService.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';


let schedulerTask = null;

const runReminderJob = async () => {
  const traceId = uuidv4();
  logger.info('Reminder job started', { traceId });

  try {
    const overdueItems = await ActionItem.find({
      status: { $ne: 'COMPLETED' },
      dueDate: { $lt: new Date() }
    }).populate('meetingId', 'title').lean();

    if (overdueItems.length === 0) {
      logger.info('No overdue action items found', { traceId });
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    logger.info(`Found ${overdueItems.length} overdue action items`, { traceId });

    let succeeded = 0;
    let failed = 0;

    for (const item of overdueItems) {
      try {
        const meeting = item.meetingId;
        const result = await sendOverdueReminder(item, meeting, traceId);

        await ActionItem.findByIdAndUpdate(item._id, {
          reminderSent: true,
          lastReminderAt: new Date(),
          $push: {
            reminderHistory: {
              sentAt: new Date(),
              channel: 'slack',
              success: result.success,
              message: result.error || 'Reminder sent successfully'
            }
          }
        });

        if (result.success) {
          succeeded++;
          logger.info('Slack reminder sent for action item', {
            traceId,
            actionItemId: item._id,
            assignee: item.assignee
          });
        } else {
          failed++;
          logger.warn('Slack reminder failed for action item', {
            traceId,
            actionItemId: item._id,
            error: result.error
          });
        }
      } catch (err) {
        failed++;
        logger.error('Error processing reminder', {
          traceId,
          actionItemId: item._id,
          error: err.message
        });
      }
    }

    if (overdueItems.length > 1) {
      await sendOverdueSummary(overdueItems, traceId);
    }

    logger.info('Reminder job completed', {
      traceId,
      processed: overdueItems.length,
      succeeded,
      failed
    });

    return { processed: overdueItems.length, succeeded, failed };
  } catch (error) {
    logger.error('Reminder job encountered fatal error', { traceId, error: error.message });
    throw error;
  }
};

const startScheduler = () => {
  const schedule = process.env.REMINDER_CRON_SCHEDULE || '0 * * * *';

  if (!cron.validate(schedule)) {
    logger.error(`Invalid cron schedule: ${schedule}`);
    return;
  }

  schedulerTask = cron.schedule(schedule, async () => {
    await runReminderJob().catch(err => {
      logger.error('Reminder job failed', { error: err.message });
    });
  }, { scheduled: true, timezone: 'UTC' });

  logger.info(`Reminder scheduler started with schedule: ${schedule}`);
};

const stopScheduler = () => {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    logger.info('Reminder scheduler stopped');
  }
};

export { startScheduler, stopScheduler, runReminderJob };
