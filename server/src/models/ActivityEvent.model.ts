import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityEvent extends Document {
  type: 'user_login' | 'user_logout' | 'project_created' | 'project_updated' | 'project_deleted' | 'payment_success' | 'payment_failed' | 'api_call' | 'error' | 'admin_action' | 'agent_assessment_started' | 'agent_assessment_completed' | 'agent_refinement_started' | 'agent_refinement_completed' | 'agent_assessment_failed';
  userId?: string;
  userEmail?: string;
  entityType?: string; // 'user', 'project', 'payment', etc.
  entityId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  timestamp: Date;
}

const activityEventSchema = new Schema<IActivityEvent>(
  {
    type: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    userEmail: {
      type: String,
      index: true,
      sparse: true
    },
    entityType: {
      type: String,
      index: true,
      sparse: true
    },
    entityId: {
      type: String,
      index: true,
      sparse: true
    },
    details: {
      type: Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      index: true
    },
    userAgent: {
      type: String
    },
    location: {
      country: String,
      city: String
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    timestamps: false // We use timestamp field instead
  }
);

// Indexes for efficient queries
activityEventSchema.index({ timestamp: -1 });
activityEventSchema.index({ type: 1, timestamp: -1 });
activityEventSchema.index({ userId: 1, timestamp: -1 });
activityEventSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

// TTL index to auto-delete old events after 90 days
activityEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const ActivityEvent = mongoose.model<IActivityEvent>('ActivityEvent', activityEventSchema);














