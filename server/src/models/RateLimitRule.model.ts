import mongoose, { Schema, Document } from 'mongoose';

export interface IRateLimitRule extends Document {
  name: string;
  description?: string;
  scope: 'global' | 'user' | 'plan' | 'ip' | 'endpoint';
  scopeValue?: string; // userId, plan name, IP address, or endpoint path
  limit: number; // Max requests
  windowMs: number; // Time window in milliseconds
  isActive: boolean;
  priority: number; // Higher priority rules are checked first
  createdBy: string; // Admin ID
  createdAt: Date;
  updatedAt: Date;
}

const rateLimitRuleSchema = new Schema<IRateLimitRule>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    scope: {
      type: String,
      enum: ['global', 'user', 'plan', 'ip', 'endpoint'],
      required: true,
      index: true
    },
    scopeValue: {
      type: String,
      index: true
    },
    limit: {
      type: Number,
      required: true,
      min: 1
    },
    windowMs: {
      type: Number,
      required: true,
      min: 1000 // Minimum 1 second
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    priority: {
      type: Number,
      default: 0,
      index: true
    },
    createdBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes
rateLimitRuleSchema.index({ scope: 1, scopeValue: 1, isActive: 1 });
rateLimitRuleSchema.index({ priority: -1, isActive: 1 });

export const RateLimitRule = mongoose.model<IRateLimitRule>('RateLimitRule', rateLimitRuleSchema);




