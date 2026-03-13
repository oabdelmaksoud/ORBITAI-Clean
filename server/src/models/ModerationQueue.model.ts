import mongoose, { Schema, Document } from 'mongoose';

export interface IModerationQueue extends Document {
  entityType: 'project' | 'artifact' | 'user' | 'comment' | 'template';
  entityId: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  flaggedBy?: string; // User ID who flagged it
  flaggedReason?: string;
  reviewedBy?: string; // Admin ID who reviewed it
  reviewedAt?: Date;
  rejectionReason?: string;
  autoFlagged: boolean;
  flags: Array<{
    type: string;
    reason: string;
    flaggedAt: Date;
    flaggedBy?: string;
  }>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const moderationQueueSchema = new Schema<IModerationQueue>(
  {
    entityType: {
      type: String,
      enum: ['project', 'artifact', 'user', 'comment', 'template'],
      required: true,
      index: true
    },
    entityId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending',
      index: true
    },
    flaggedBy: {
      type: String,
      index: true
    },
    flaggedReason: {
      type: String
    },
    reviewedBy: {
      type: String,
      index: true
    },
    reviewedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    autoFlagged: {
      type: Boolean,
      default: false
    },
    flags: [{
      type: {
        type: String,
        required: true
      },
      reason: {
        type: String,
        required: true
      },
      flaggedAt: {
        type: Date,
        default: Date.now
      },
      flaggedBy: {
        type: String
      }
    }],
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes
moderationQueueSchema.index({ entityType: 1, entityId: 1 }, { unique: true });
moderationQueueSchema.index({ status: 1, createdAt: -1 });
moderationQueueSchema.index({ flaggedBy: 1, status: 1 });

export const ModerationQueue = mongoose.model<IModerationQueue>('ModerationQueue', moderationQueueSchema);




