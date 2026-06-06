import mongoose from 'mongoose';

const transcriptEntrySchema = new mongoose.Schema({
  timestamp: {
    type: String,
    required: [true, 'Timestamp is required']
  },
  speaker: {
    type: String,
    required: [true, 'Speaker is required'],
    trim: true
  },
  text: {
    type: String,
    required: [true, 'Text is required'],
    trim: true
  }
}, { _id: false });

const citationSchema = new mongoose.Schema({
  timestamp: { type: String },
  speaker: { type: String },
  text: { type: String }
}, { _id: false });

const summaryItemSchema = new mongoose.Schema({
  text: { type: String, required: true },
  citations: [citationSchema]
}, { _id: false });

const actionItemRefSchema = new mongoose.Schema({
  task: { type: String },
  assignee: { type: String },
  dueDate: { type: Date },
  citations: [citationSchema]
}, { _id: false });

const decisionSchema = new mongoose.Schema({
  text: { type: String },
  citations: [citationSchema]
}, { _id: false });

const followUpSchema = new mongoose.Schema({
  text: { type: String },
  citations: [citationSchema]
}, { _id: false });

const analysisSchema = new mongoose.Schema({
  summary: [summaryItemSchema],
  actionItems: [actionItemRefSchema],
  decisions: [decisionSchema],
  followUpSuggestions: [followUpSchema],
  analyzedAt: { type: Date, default: Date.now }
}, { _id: false });

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    minlength: 1,
    maxlength: 500
  },
  participants: {
    type: [String],
    validate: {
      validator: (arr) => arr.length > 0,
      message: 'At least one participant is required'
    }
  },
  meetingDate: {
    type: Date,
    required: [true, 'Meeting date is required']
  },
  transcript: {
    type: [transcriptEntrySchema],
    default: []
  },
  analysis: {
    type: analysisSchema,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

meetingSchema.index({ createdBy: 1, meetingDate: -1 });
meetingSchema.index({ title: 'text' });

const Meeting = mongoose.model('Meeting', meetingSchema);

export{
  Meeting
};