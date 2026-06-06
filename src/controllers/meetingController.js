import { Meeting } from '../models/Meeting.js';
import { ActionItem } from '../models/ActionItem.js';
import { analyzeMeeting } from '../services/groqService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';


/**
 * @swagger
 * /api/meetings:
 *   post:
 *     tags: [Meetings]
 *     summary: Create a new meeting
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, participants, meetingDate]
 *             properties:
 *               title:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *               transcript:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/TranscriptEntry'
 *     responses:
 *       201:
 *         description: Meeting created successfully
 */
const createMeeting = async (req, res, next) => {
  try {
    const { title, participants, meetingDate, transcript = [] } = req.body;
    const traceId = res.locals.traceId;

    const meeting = await Meeting.create({
      title,
      participants,
      meetingDate: new Date(meetingDate),
      transcript,
      createdBy: req.user._id
    });

    logger.info('Meeting created', { traceId, meetingId: meeting._id, userId: req.user._id });

    return successResponse(res, { meeting }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/meetings/{id}:
 *   get:
 *     tags: [Meetings]
 *     summary: Get a meeting by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting data
 *       404:
 *         description: Meeting not found
 */
const getMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    }).populate('createdBy', 'name email');

    if (!meeting) {
      return errorResponse(res, 'NOT_FOUND', 'Meeting not found', 404);
    }

    return successResponse(res, { meeting });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/meetings:
 *   get:
 *     tags: [Meetings]
 *     summary: List all meetings with pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of meetings
 */
const listMeetings = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      from,
      to
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { createdBy: req.user._id };

    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    if (from || to) {
      filter.meetingDate = {};
      if (from) filter.meetingDate.$gte = new Date(from);
      if (to) filter.meetingDate.$lte = new Date(to);
    }

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ meetingDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-transcript -analysis')
        .lean(),
      Meeting.countDocuments(filter)
    ]);

    return paginatedResponse(res, meetings, total, pageNum, limitNum);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/meetings/{id}/analyze:
 *   post:
 *     tags: [Meetings]
 *     summary: Analyze a meeting transcript using AI
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis results with citations
 *       404:
 *         description: Meeting not found
 */
const analyzeMeetingEndpoint = async (req, res, next) => {
  try {
    const traceId = res.locals.traceId;

    const meeting = await Meeting.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!meeting) {
      return errorResponse(res, 'NOT_FOUND', 'Meeting not found', 404);
    }

    if (!meeting.transcript || meeting.transcript.length === 0) {
      return errorResponse(res, 'NO_TRANSCRIPT', 'Meeting has no transcript to analyze', 400);
    }

    logger.info('Starting meeting analysis', { traceId, meetingId: meeting._id });

    const analysis = await analyzeMeeting(meeting, traceId);

    // Save analysis back to meeting
    meeting.analysis = analysis;
    await meeting.save();

    // Auto-create action items in the ActionItems collection from AI results
    if (analysis.actionItems && analysis.actionItems.length > 0) {
      const actionItemDocs = analysis.actionItems.map(item => ({
        meetingId: meeting._id,
        task: item.task,
        assignee: item.assignee,
        dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days
        status: 'PENDING',
        citations: item.citations || [],
        createdBy: req.user._id
      }));

      await ActionItem.insertMany(actionItemDocs, { ordered: false }).catch(err => {
        logger.warn('Some action items failed to auto-create', { traceId, error: err.message });
      });
    }

    logger.info('Meeting analysis completed and saved', {
      traceId,
      meetingId: meeting._id,
      actionItemsCreated: analysis.actionItems?.length || 0
    });

    return successResponse(res, { analysis });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/meetings/{id}:
 *   delete:
 *     tags: [Meetings]
 *     summary: Delete a meeting
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting deleted
 */
const deleteMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!meeting) {
      return errorResponse(res, 'NOT_FOUND', 'Meeting not found', 404);
    }

    // Also delete associated action items
    await ActionItem.deleteMany({ meetingId: req.params.id });

    logger.info('Meeting deleted', { traceId: res.locals.traceId, meetingId: req.params.id });

    return successResponse(res, { message: 'Meeting deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export { createMeeting, getMeeting, listMeetings, analyzeMeetingEndpoint, deleteMeeting };
