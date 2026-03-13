/**
 * LLM Routing Weights Model
 * Stores learnable routing weights
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ILLMRoutingWeights extends Document {
  userId?: string; // Optional user-specific weights
  weights: {
    capabilityMatch: number; // Default: 20
    agentRoleMatch: number; // Default: 15
    taskTypeMatch: number; // Default: 15
    complexityMatch: number; // Default: 10
    costEfficiency: number; // Default: variable
    latencyRequirement: number; // Default: 15
    reliability: number; // Default: 10
    userPreference: number; // Default: 20
  };
  version: number;
  performance: {
    successRate: number; // 0-100
    averageCost: number;
    averageLatency: number;
    lastUpdated: Date;
  };
  history: Array<{
    version: number;
    weights: ILLMRoutingWeights['weights'];
    performance: ILLMRoutingWeights['performance'];
    timestamp: Date;
  }>;
}

const LLMRoutingWeightsSchema = new Schema<ILLMRoutingWeights>(
  {
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    weights: {
      capabilityMatch: { type: Number, default: 20 },
      agentRoleMatch: { type: Number, default: 15 },
      taskTypeMatch: { type: Number, default: 15 },
      complexityMatch: { type: Number, default: 10 },
      costEfficiency: { type: Number, default: 10 },
      latencyRequirement: { type: Number, default: 15 },
      reliability: { type: Number, default: 10 },
      userPreference: { type: Number, default: 20 }
    },
    version: {
      type: Number,
      default: 1
    },
    performance: {
      successRate: { type: Number, default: 0, min: 0, max: 100 },
      averageCost: { type: Number, default: 0 },
      averageLatency: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    },
    history: [{
      version: Number,
      weights: {
        capabilityMatch: Number,
        agentRoleMatch: Number,
        taskTypeMatch: Number,
        complexityMatch: Number,
        costEfficiency: Number,
        latencyRequirement: Number,
        reliability: Number,
        userPreference: Number
      },
      performance: {
        successRate: Number,
        averageCost: Number,
        averageLatency: Number,
        lastUpdated: Date
      },
      timestamp: { type: Date, default: Date.now }
    }]
  },
  {
    timestamps: true
  }
);

// Indexes
LLMRoutingWeightsSchema.index({ userId: 1 }, { unique: true, sparse: true });

export const LLMRoutingWeights = mongoose.model<ILLMRoutingWeights>(
  'LLMRoutingWeights',
  LLMRoutingWeightsSchema
);



