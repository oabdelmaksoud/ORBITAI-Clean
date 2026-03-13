/**
 * Router AI Insights Model
 * Stores AI-generated insights, recommendations, and auto-tuning history
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IRouterAIInsights extends Document {
  type: 'recommendation' | 'anomaly' | 'prediction' | 'auto_tune' | 'ab_test';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  status: 'pending' | 'applied' | 'rejected' | 'expired';
  
  // Recommendation-specific fields
  recommendationType?: 'routing_rule' | 'cost_control' | 'model_priority' | 'performance_tuning' | 'budget_limit';
  suggestedChanges?: Record<string, any>;
  
  // Anomaly-specific fields
  anomalyType?: 'cost_spike' | 'performance_degradation' | 'unusual_pattern' | 'error_spike';
  severity?: 'critical' | 'warning' | 'info';
  metrics?: Record<string, any>;
  
  // Prediction-specific fields
  predictedModel?: string;
  predictedCost?: number;
  predictedLatency?: number;
  
  // Auto-tune specific fields
  tuningChanges?: Record<string, any>;
  previousMetrics?: Record<string, any>;
  newMetrics?: Record<string, any>;
  
  // A/B test specific fields
  abTestId?: string;
  abTestResults?: Record<string, any>;
  
  // Metadata
  detectedAt: Date;
  appliedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

const routerAIInsightsSchema = new Schema<IRouterAIInsights>(
  {
    type: {
      type: String,
      required: true,
      enum: ['recommendation', 'anomaly', 'prediction', 'auto_tune', 'ab_test'],
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    priority: {
      type: String,
      required: true,
      enum: ['high', 'medium', 'low'],
      index: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'applied', 'rejected', 'expired'],
      default: 'pending',
      index: true
    },
    recommendationType: {
      type: String,
      enum: ['routing_rule', 'cost_control', 'model_priority', 'performance_tuning', 'budget_limit']
    },
    suggestedChanges: {
      type: Schema.Types.Mixed,
      default: {}
    },
    anomalyType: {
      type: String,
      enum: ['cost_spike', 'performance_degradation', 'unusual_pattern', 'error_spike']
    },
    severity: {
      type: String,
      enum: ['critical', 'warning', 'info']
    },
    metrics: {
      type: Schema.Types.Mixed,
      default: {}
    },
    predictedModel: {
      type: String
    },
    predictedCost: {
      type: Number
    },
    predictedLatency: {
      type: Number
    },
    tuningChanges: {
      type: Schema.Types.Mixed,
      default: {}
    },
    previousMetrics: {
      type: Schema.Types.Mixed,
      default: {}
    },
    newMetrics: {
      type: Schema.Types.Mixed,
      default: {}
    },
    abTestId: {
      type: String
    },
    abTestResults: {
      type: Schema.Types.Mixed,
      default: {}
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    appliedAt: {
      type: Date
    },
    expiresAt: {
      type: Date,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
routerAIInsightsSchema.index({ type: 1, status: 1, detectedAt: -1 });
routerAIInsightsSchema.index({ priority: 1, status: 1 });
routerAIInsightsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

export const RouterAIInsights = mongoose.model<IRouterAIInsights>(
  'RouterAIInsights',
  routerAIInsightsSchema
);




