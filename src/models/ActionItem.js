import mongoose from 'mongoose';

const STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

const citationSchema = new mongoose.Schema({
  timestamp: { type: String },
  speaker: { type: String },
  text: { type: String }
}, { _id: false });

const actionItemSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: [true, 'Meeting ID is required']
  },
  task: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    minlength: 1,
    maxlength: 1000
  },
  assignee: {
    type: String,
    required: [true, 'Assignee is required'],
    trim: true
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  status: {
    type: String,
    enum: {
      values: Object.values(STATUS),
      message: 'Status must be PENDING, IN_PROGRESS, or COMPLETED'
    },
    default: STATUS.PENDING
  },
  citations: {
    type: [citationSchema],
    default: []
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  lastReminderAt: {
    type: Date,
    default: null
  },
  reminderHistory: [{
    sentAt: { type: Date, default: Date.now },
    channel: { type: String, default: 'telegram' },
    success: { type: Boolean },
    message: { type: String }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

actionItemSchema.index({ meetingId: 1 });
actionItemSchema.index({ status: 1 });
actionItemSchema.index({ assignee: 1 });
actionItemSchema.index({ dueDate: 1, status: 1 });

// Virtual: isOverdue
actionItemSchema.virtual('isOverdue').get(function () {
  return this.status !== STATUS.COMPLETED && this.dueDate < new Date();
});

actionItemSchema.set('toJSON', { virtuals: true });
actionItemSchema.set('toObject', { virtuals: true });

const ActionItem = mongoose.model('ActionItem', actionItemSchema);

export { ActionItem, STATUS };
