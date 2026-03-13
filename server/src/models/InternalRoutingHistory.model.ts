/**
 * Internal Routing History Model
 * Tracks routing decisions for learning and analytics
 */

import mongoose, { Schema, Document } from 'mongoose';

export type ModelTier = 'economy' | 'standard' | 'premium';

export interface IRoutingOutcome {
  success: boolean;
  actualCost: number;
  actualLatencyMs: number;
  errorMessage?: string;
  recordedAt: Date;
}

export interface IInternalRoutingHistory extends Document {
  // Task information
  taskType: string;
  agentRole?: string;
  context: 'internal' | 'system' | 'user' | 'background';
  
  // Decision details
  selectedModelId: string;
  selectedTier: ModelTier;
  complexity: 'simple' | 'moderate' | 'complex';
  tokenEstimate: number;
  requiredCapabilities: string[];
  
  // Decision metrics
  confidence: number;
  estimatedCost: number;
  reasoning: string;
  budgetPressure: number;
  processingTimeMs: number;
  
  // Alternative models considered
  alternativeModels?: string[];
  
  // Outcome (recorded after task completion)
  outcome?: IRoutingOutcome;
  
  // Timestamps
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const routingOutcomeSchema = new Schema<IRoutingOutcome>({
  success: {
    type: Boolean,
    required: true
  },
  actualCost: {
    type: Number,
    required: true
  },
  actualLatencyMs: {
    type: Number,
    required: true
  },
  errorMessage: {
    type: String
  },
  recordedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const internalRoutingHistorySchema = new Schema<IInternalRoutingHistory>(
  {
    taskType: {
      type: String,
      required: true,
      index: true
    },
    agentRole: {
      type: String,
      index: true
    },
    context: {
      type: String,
      enum: ['internal', 'system', 'user', 'background'],
      required: true,
      default: 'internal',
      index: true
    },
    selectedModelId: {
      type: String,
      required: true,
      index: true
    },
    selectedTier: {
      type: String,
      enum: ['economy', 'standard', 'premium'],
      required: true,
      index: true
    },
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex'],
      required: true,
      index: true
    },
    tokenEstimate: {
      type: Number,
      required: true,
      default: 0
    },
    requiredCapabilities: [{
      type: String
    }],
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    estimatedCost: {
      type: Number,
      required: true,
      default: 0
    },
    reasoning: {
      type: String,
      required: true
    },
    budgetPressure: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    processingTimeMs: {
      type: Number,
      required: true
    },
    alternativeModels: [{
      type: String
    }],
    outcome: {
      type: routingOutcomeSchema
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
internalRoutingHistorySchema.index({ taskType: 1, timestamp: -1 });
internalRoutingHistorySchema.index({ selectedTier: 1, timestamp: -1 });
internalRoutingHistorySchema.index({ selectedModelId: 1, timestamp: -1 });
internalRoutingHistorySchema.index({ 'outcome.success': 1, timestamp: -1 });
internalRoutingHistorySchema.index({ context: 1, timestamp: -1 });

// TTL index to auto-delete old records after 90 days
internalRoutingHistorySchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static methods for analytics
internalRoutingHistorySchema.statics.getSuccessRateByTier = async function(
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate },
        'outcome.success': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$selectedTier',
        totalDecisions: { $sum: 1 },
        successfulDecisions: {
          $sum: { $cond: ['$outcome.success', 1, 0] }
        },
        avgCost: { $avg: '$outcome.actualCost' },
        avgLatency: { $avg: '$outcome.actualLatencyMs' }
      }
    },
    {
      $project: {
        tier: '$_id',
        totalDecisions: 1,
        successfulDecisions: 1,
        successRate: {
          $divide: ['$successfulDecisions', '$totalDecisions']
        },
        avgCost: 1,
        avgLatency: 1
      }
    }
  ]);
};

internalRoutingHistorySchema.statics.getCostSavings = async function(
  startDate: Date,
  endDate: Date,
  premiumCostPerToken: number = 0.00001
) {
  const result = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: '$tokenEstimate' },
        actualCost: {
          $sum: { $ifNull: ['$outcome.actualCost', '$estimatedCost'] }
        }
      }
    }
  ]);
  
  if (result.length === 0) {
    return { totalTokens: 0, actualCost: 0, premiumCost: 0, savings: 0 };
  }
  
  const premiumCost = result[0].totalTokens * premiumCostPerToken;
  const savings = premiumCost - result[0].actualCost;
  
  return {
    totalTokens: result[0].totalTokens,
    actualCost: result[0].actualCost,
    premiumCost,
    savings: Math.max(0, savings)
  };
};

export const InternalRoutingHistory = mongoose.model<IInternalRoutingHistory>(
  'InternalRoutingHistory',
  internalRoutingHistorySchema
);

export default InternalRoutingHistory;




