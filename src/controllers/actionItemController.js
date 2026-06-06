import { ActionItem, STATUS } from '../models/ActionItem.js';
import { Meeting } from '../models/Meeting.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../config/redis.js';

const hashQuery = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

const createActionItem = async (req, res, next) => {
  try {
    const { meetingId, task, assignee, dueDate, citations = [] } = req.body;
    const traceId = res.locals.traceId;

    const meeting = await Meeting.findOne({ _id: meetingId, createdBy: req.user._id });
    if (!meeting) {
      return errorResponse(res, 'NOT_FOUND', 'Meeting not found or access denied', 404);
    }

    const actionItem = await ActionItem.create({
      meetingId,
      task,
      assignee,
      dueDate: new Date(dueDate),
      citations,
      createdBy: req.user._id
    });

    // Invalidate list cache
    await cacheDelPattern(`actionItems:${req.user._id}:*`);

    logger.info('Action item created', { traceId, actionItemId: actionItem._id, meetingId });
    return successResponse(res, { actionItem }, 201);
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const traceId = res.locals.traceId;

    if (!Object.values(STATUS).includes(status)) {
      return errorResponse(res, 'INVALID_STATUS', `Status must be one of: ${Object.values(STATUS).join(', ')}`, 400);
    }

    const actionItem = await ActionItem.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { status },
      { new: true, runValidators: true }
    );

    if (!actionItem) {
      return errorResponse(res, 'NOT_FOUND', 'Action item not found', 404);
    }

    // Invalidate item and list caches
    await cacheDel(`actionItem:${req.params.id}`);
    await cacheDelPattern(`actionItems:${req.user._id}:*`);

    logger.info('Action item status updated', { traceId, actionItemId: actionItem._id, status });
    return successResponse(res, { actionItem });
  } catch (error) {
    next(error);
  }
};

const listActionItems = async (req, res, next) => {
  try {
    const { status, assignee, meetingId, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { createdBy: req.user._id };

    if (status) {
      if (!Object.values(STATUS).includes(status)) {
        return errorResponse(res, 'INVALID_STATUS', `Status must be one of: ${Object.values(STATUS).join(', ')}`, 400);
      }
      filter.status = status;
    }

    if (assignee) filter.assignee = { $regex: assignee, $options: 'i' };
    if (meetingId) filter.meetingId = meetingId;

    const cacheKey = `actionItems:${req.user._id}:${hashQuery({ status, assignee, meetingId, page: pageNum, limit: limitNum })}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.debug('Cache HIT action items list', { userId: req.user._id });
      return res.status(200).json(cached);
    }

    const [actionItems, total] = await Promise.all([
      ActionItem.find(filter)
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('meetingId', 'title meetingDate')
        .lean({ virtuals: true }),
      ActionItem.countDocuments(filter)
    ]);

    const payload = {
      traceId: res.locals.traceId,
      success: true,
      data: actionItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
    await cacheSet(cacheKey, payload, 120); // 2 min
    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const getActionItem = async (req, res, next) => {
  try {
    const cacheKey = `actionItem:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.debug('Cache HIT action item', { id: req.params.id });
      return successResponse(res, { actionItem: cached });
    }

    const actionItem = await ActionItem.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    }).populate('meetingId', 'title meetingDate participants').lean({ virtuals: true });

    if (!actionItem) {
      return errorResponse(res, 'NOT_FOUND', 'Action item not found', 404);
    }

    await cacheSet(cacheKey, actionItem, 300); // 5 min
    return successResponse(res, { actionItem });
  } catch (error) {
    next(error);
  }
};

const getOverdueActionItems = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      createdBy: req.user._id,
      status: { $ne: 'COMPLETED' },
      dueDate: { $lt: new Date() }
    };

    const [actionItems, total] = await Promise.all([
      ActionItem.find(filter)
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('meetingId', 'title meetingDate')
        .lean({ virtuals: true }),
      ActionItem.countDocuments(filter)
    ]);

    return paginatedResponse(res, actionItems, total, pageNum, limitNum);
  } catch (error) {
    next(error);
  }
};

const deleteActionItem = async (req, res, next) => {
  try {
    const actionItem = await ActionItem.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!actionItem) {
      return errorResponse(res, 'NOT_FOUND', 'Action item not found', 404);
    }

    // Invalidate item and list caches
    await cacheDel(`actionItem:${req.params.id}`);
    await cacheDelPattern(`actionItems:${req.user._id}:*`);

    logger.info('Action item deleted', { traceId: res.locals.traceId, actionItemId: req.params.id });
    return successResponse(res, { message: 'Action item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export {
  createActionItem,
  updateStatus,
  listActionItems,
  getActionItem,
  getOverdueActionItems,
  deleteActionItem
};
