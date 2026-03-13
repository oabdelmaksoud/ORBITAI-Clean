import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityEvent extends Document {
  type: 'failed_login' | 'suspicious_activity' | 'brute_force' | 'unauthorized_access' | 'data_breach_attempt' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    coordinates?: [number, number];
  };
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
}

const securityEventSchema = new Schema<ISecurityEvent>(
  {
    type: {
      type: String,
      required: true,
      enum: ['failed_login', 'suspicious_activity', 'brute_force', 'unauthorized_access', 'data_breach_attempt', 'rate_limit_exceeded'],
      index: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true
    },
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    email: {
      type: String,
      index: true,
      sparse: true
    },
    ipAddress: {
      type: String,
      required: true,
      index: true
    },
    userAgent: {
      type: String
    },
    location: {
      country: String,
      city: String,
      coordinates: [Number]
    },
    details: {
      type: Schema.Types.Mixed,
      default: {}
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: String
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes for efficient queries
securityEventSchema.index({ createdAt: -1 });
securityEventSchema.index({ ipAddress: 1, createdAt: -1 });
securityEventSchema.index({ resolved: 1, severity: 1 });

export const SecurityEvent = mongoose.model<ISecurityEvent>('SecurityEvent', securityEventSchema);
















