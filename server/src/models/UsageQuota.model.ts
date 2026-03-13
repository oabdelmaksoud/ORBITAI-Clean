import mongoose, { Schema, Document } from 'mongoose';

export interface IUsageQuota extends Document {
  targetType: 'user' | 'project' | 'global';
  targetId?: string; // userId or projectId (null for global)
  targetName?: string; // Display name
  
  // Limits
  dailyLimit?: number; // Cost in USD
  weeklyLimit?: number;
  monthlyLimit?: number;
  
  // Token limits
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  
  // Request limits
  dailyRequestLimit?: number;
  monthlyRequestLimit?: number;
  
  // Current usage (reset periodically)
  currentUsage: {
    daily: {
      cost: number;
      tokens: number;
      requests: number;
      lastReset: Date;
    };
    weekly: {
      cost: number;
      tokens: number;
      requests: number;
      lastReset: Date;
    };
    monthly: {
      cost: number;
      tokens: number;
      requests: number;
      lastReset: Date;
    };
  };
  
  // Alert configuration
  alerts: {
    threshold50: boolean; // Alert at 50%
    threshold75: boolean; // Alert at 75%
    threshold90: boolean; // Alert at 90%
    emailNotifications: boolean;
    webhookUrl?: string;
  };
  
  // Status
  enabled: boolean;
  hardLimit: boolean; // If true, block requests when limit reached
  
  createdAt: Date;
  updatedAt: Date;
}

const UsageQuotaSchema = new Schema<IUsageQuota>(
  {
    targetType: {
      type: String,
      enum: ['user', 'project', 'global'],
      required: true,
      index: true
    },
    targetId: {
      type: String,
      sparse: true,
      index: true
    },
    targetName: {
      type: String
    },
    dailyLimit: {
      type: Number,
      min: 0
    },
    weeklyLimit: {
      type: Number,
      min: 0
    },
    monthlyLimit: {
      type: Number,
      min: 0
    },
    dailyTokenLimit: {
      type: Number,
      min: 0
    },
    monthlyTokenLimit: {
      type: Number,
      min: 0
    },
    dailyRequestLimit: {
      type: Number,
      min: 0
    },
    monthlyRequestLimit: {
      type: Number,
      min: 0
    },
    currentUsage: {
      daily: {
        cost: { type: Number, default: 0 },
        tokens: { type: Number, default: 0 },
        requests: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
      },
      weekly: {
        cost: { type: Number, default: 0 },
        tokens: { type: Number, default: 0 },
        requests: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
      },
      monthly: {
        cost: { type: Number, default: 0 },
        tokens: { type: Number, default: 0 },
        requests: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
      }
    },
    alerts: {
      threshold50: { type: Boolean, default: true },
      threshold75: { type: Boolean, default: true },
      threshold90: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: false },
      webhookUrl: { type: String }
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    },
    hardLimit: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient lookups
UsageQuotaSchema.index({ targetType: 1, targetId: 1 }, { unique: true, sparse: true });

export const UsageQuota = mongoose.model<IUsageQuota>('UsageQuota', UsageQuotaSchema);

