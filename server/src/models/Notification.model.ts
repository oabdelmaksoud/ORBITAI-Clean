import mongoose, { Schema, Document, Types } from 'mongoose';

export type NotificationType = 
  | 'mention'
  | 'comment'
  | 'reply'
  | 'assignment'
  | 'project_share'
  | 'workspace_invite'
  | 'task_complete'
  | 'artifact_ready'
  | 'integration_alert';

export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    workspace?: Types.ObjectId;
    project?: Types.ObjectId;
    resourceType?: string;
    resourceId?: Types.ObjectId;
    actor?: Types.ObjectId;
    [key: string]: any;
  };
  read: boolean;
  readAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: [
        'mention',
        'comment',
        'reply',
        'assignment',
        'project_share',
        'workspace_invite',
        'task_complete',
        'artifact_ready',
        'integration_alert'
      ],
      required: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    data: {
      workspace: {
        type: Schema.Types.ObjectId,
        ref: 'Workspace'
      },
      project: {
        type: Schema.Types.ObjectId,
        ref: 'Project'
      },
      resourceType: {
        type: String
      },
      resourceId: {
        type: Schema.Types.ObjectId
      },
      actor: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    emailSent: {
      type: Boolean,
      default: false
    },
    emailSentAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId: Types.ObjectId) {
  return this.countDocuments({
    user: userId,
    read: false
  });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function(userId: Types.ObjectId) {
  return this.updateMany(
    {
      user: userId,
      read: false
    },
    {
      read: true,
      readAt: new Date()
    }
  );
};

// Static method to get notifications with pagination
notificationSchema.statics.getNotifications = function(
  userId: Types.ObjectId,
  options: {
    read?: boolean;
    type?: NotificationType;
    limit?: number;
    skip?: number;
  } = {}
) {
  const query: any = { user: userId };
  
  if (options.read !== undefined) {
    query.read = options.read;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .populate('data.actor', 'name avatar')
    .populate('data.workspace', 'name slug')
    .populate('data.project', 'name');
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(
  userId: Types.ObjectId,
  type: NotificationType,
  title: string,
  message: string,
  data?: any
) {
  const notification = new this({
    user: userId,
    type,
    title,
    message,
    data
  });
  
  return notification.save();
};

// Static method to cleanup old notifications (older than 30 days)
notificationSchema.statics.cleanupOld = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.deleteMany({
    createdAt: { $lt: thirtyDaysAgo },
    read: true
  });
};

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
