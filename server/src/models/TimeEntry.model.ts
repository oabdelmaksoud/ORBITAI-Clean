import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITimeEntry extends Document {
  user: Types.ObjectId;
  workspace: Types.ObjectId;
  project: Types.ObjectId;
  task?: Types.ObjectId;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // Duration in seconds
  isBillable: boolean;
  isRunning: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<ITimeEntry>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task'
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    },
    isBillable: {
      type: Boolean,
      default: true
    },
    isRunning: {
      type: Boolean,
      default: false
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for performance
timeEntrySchema.index({ user: 1, startTime: -1 });
timeEntrySchema.index({ workspace: 1, startTime: -1 });
timeEntrySchema.index({ project: 1, startTime: -1 });
timeEntrySchema.index({ user: 1, isRunning: 1 });
timeEntrySchema.index({ startTime: 1, endTime: 1 });

// Calculate duration before saving
timeEntrySchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor(
      (this.endTime.getTime() - this.startTime.getTime()) / 1000
    );
    this.isRunning = false;
  } else if (this.isRunning) {
    // If timer is running, calculate current duration
    this.duration = Math.floor(
      (new Date().getTime() - this.startTime.getTime()) / 1000
    );
  }
  next();
});

// Method to stop timer
timeEntrySchema.methods.stopTimer = function() {
  if (!this.isRunning) {
    throw new Error('Timer is not running');
  }
  
  this.endTime = new Date();
  this.isRunning = false;
  return this.save();
};

// Method to update duration
timeEntrySchema.methods.updateDuration = function() {
  if (this.isRunning) {
    this.duration = Math.floor(
      (new Date().getTime() - this.startTime.getTime()) / 1000
    );
  }
  return this;
};

// Static method to get active timer
timeEntrySchema.statics.getActiveTimer = function(userId: Types.ObjectId) {
  return this.findOne({
    user: userId,
    isRunning: true
  })
    .populate('project', 'name')
    .populate('task', 'title');
};

// Static method to get time entries by date range
timeEntrySchema.statics.getByDateRange = function(
  userId: Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    user: userId,
    startTime: { $gte: startDate, $lte: endDate }
  })
    .sort({ startTime: -1 })
    .populate('project', 'name')
    .populate('task', 'title');
};

// Static method to get total hours by project
timeEntrySchema.statics.getTotalByProject = function(
  projectId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date
) {
  const match: any = { project: projectId };
  
  if (startDate || endDate) {
    match.startTime = {};
    if (startDate) match.startTime.$gte = startDate;
    if (endDate) match.startTime.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$project',
        totalDuration: { $sum: '$duration' },
        totalEntries: { $sum: 1 },
        billableDuration: {
          $sum: {
            $cond: ['$isBillable', '$duration', 0]
          }
        }
      }
    }
  ]);
};

// Static method to get time distribution by user
timeEntrySchema.statics.getTimeDistribution = function(
  workspaceId: Types.ObjectId,
  groupBy: 'user' | 'project' | 'day',
  startDate: Date,
  endDate: Date
) {
  const groupId = groupBy === 'user' ? '$user' : 
                  groupBy === 'project' ? '$project' : 
                  { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } };
  
  return this.aggregate([
    {
      $match: {
        workspace: workspaceId,
        startTime: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: groupId,
        totalDuration: { $sum: '$duration' },
        totalEntries: { $sum: 1 }
      }
    },
    { $sort: { totalDuration: -1 } }
  ]);
};

export const TimeEntry = mongoose.model<ITimeEntry>('TimeEntry', timeEntrySchema);
