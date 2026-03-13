import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string; // e.g., 'user.created', 'user.updated', 'project.deleted'
  entityType: string; // 'user', 'project', 'package', 'system'
  entityId?: string;
  userId?: string; // Admin/user who performed the action
  userEmail?: string;
  details: Record<string, any>; // Additional context including before/after states
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  context?: {
    requestId?: string;
    sessionId?: string;
    traceId?: string;
  };
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  complianceTags?: string[]; // 'gdpr', 'hipaa', 'soc2', etc.
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      index: true
    },
    entityId: {
      type: String,
      index: true
    },
    userId: {
      type: String,
      index: true
    },
    userEmail: {
      type: String,
      index: true
    },
    details: {
      type: Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    location: {
      country: String,
      city: String
    },
    context: {
      requestId: String,
      sessionId: String,
      traceId: String
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success',
      index: true
    },
    errorMessage: {
      type: String
    },
    complianceTags: {
      type: [String],
      default: []
    }
  },
  {
    // Store only createdAt, updatedAt is not needed for audit logs
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes for efficient queries
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// TTL index to auto-delete old logs after 1 year (optional)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

