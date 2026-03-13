import mongoose, { Schema, Document } from 'mongoose';

export interface IAlertRule extends Document {
  name: string;
  description?: string;
  condition: {
    metric: string; // 'error_rate', 'cpu_usage', 'memory_usage', 'disk_usage', 'api_response_time', 'failed_logins', 'revenue_drop', etc.
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'; // greater than, less than, equal, etc.
    threshold: number;
    timeWindow?: number; // in minutes
  };
  channels: {
    email?: string[];
    slack?: string[];
    sms?: string[];
    webhook?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalation?: {
    enabled: boolean;
    delayMinutes: number;
    escalateTo?: string[];
  };
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const alertRuleSchema = new Schema<IAlertRule>(
  {
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    condition: {
      metric: {
        type: String,
        required: true
      },
      operator: {
        type: String,
        required: true,
        enum: ['gt', 'lt', 'eq', 'gte', 'lte']
      },
      threshold: {
        type: Number,
        required: true
      },
      timeWindow: {
        type: Number // minutes
      }
    },
    channels: {
      email: [String],
      slack: [String],
      sms: [String],
      webhook: String
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    escalation: {
      enabled: {
        type: Boolean,
        default: false
      },
      delayMinutes: {
        type: Number,
        default: 60
      },
      escalateTo: [String]
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastTriggered: {
      type: Date
    },
    triggerCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

alertRuleSchema.index({ isActive: 1, 'condition.metric': 1 });

export const AlertRule = mongoose.model<IAlertRule>('AlertRule', alertRuleSchema);
















