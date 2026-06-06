import axios from 'axios';
import logger from '../utils/logger';

const sendSlackMessage = async (blocks, text, traceId = 'system') => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured', { traceId });
    return { success: false, error: 'Slack webhook URL not configured' };
  }

  try {
    const payload = { text, blocks };
    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 200 && response.data === 'ok') {
      logger.info('Slack message sent successfully', { traceId });
      return { success: true };
    } else {
      throw new Error(`Slack returned unexpected response: ${response.data}`);
    }
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    logger.error('Slack message failed', { traceId, error: errorMsg });
    return { success: false, error: String(errorMsg) };
  }
};

const sendOverdueReminder = async (actionItem, meeting, traceId = 'system') => {
  const dueDate = new Date(actionItem.dueDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const daysOverdue = Math.floor((Date.now() - new Date(actionItem.dueDate)) / (1000 * 60 * 60 * 24));
  const overdueText = daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '⚠️ Overdue Action Item Reminder', emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Task:*\n${actionItem.task}` },
        { type: 'mrkdwn', text: `*Assigned To:*\n${actionItem.assignee}` },
        { type: 'mrkdwn', text: `*Due Date:*\n${dueDate}` },
        { type: 'mrkdwn', text: `*Status:*\n🔴 ${actionItem.status} (${overdueText})` }
      ]
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Meeting:* ${meeting?.title || 'Unknown Meeting'}` }
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: 'This action item is past its due date and requires attention.' }
      ]
    }
  ];

  const fallbackText = `⚠️ Overdue: "${actionItem.task}" assigned to ${actionItem.assignee} (due ${dueDate})`;
  return sendSlackMessage(blocks, fallbackText, traceId);
};

const sendOverdueSummary = async (overdueItems, traceId = 'system') => {
  if (overdueItems.length === 0) return { success: true, skipped: true };

  const itemsList = overdueItems.slice(0, 10).map((item, idx) => {
    const dueDate = new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${idx + 1}. *${item.task}* — ${item.assignee} _(due ${dueDate})_`;
  }).join('\n');

  const moreText = overdueItems.length > 10
    ? `\n_...and ${overdueItems.length - 10} more overdue items_`
    : '';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🔔 Overdue Action Items Summary`, emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Total overdue: ${overdueItems.length}*\n\n${itemsList}${moreText}` }
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: 'Please review and update the status of these action items.' }
      ]
    }
  ];

  const fallbackText = `🔔 ${overdueItems.length} overdue action items need attention.`;
  return sendSlackMessage(blocks, fallbackText, traceId);
};

export { sendSlackMessage, sendOverdueReminder, sendOverdueSummary };
