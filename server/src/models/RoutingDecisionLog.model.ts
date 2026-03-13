import mongoose, { Schema, Document } from 'mongoose';

export interface IDecisionStep {
  step: number;
  type: 'filter' | 'score' | 'rule' | 'fallback' | 'ai_prediction' | 'quota_check';
  description: string;
  result: string;
  candidatesRemaining?: number;
  duration?: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface IRoutingDecisionLog extends Document {
  // Request context
  requestId: string;
  userId?: string;
  projectId?: string;
  
  // Task information
  task: {
    type: string;
    complexity: 'simple' | 'moderate' | 'complex';
    agentRole?: string;
    estimatedTokens: number;
    requiredCapabilities: string[];
  };
  
  // Decision outcome
  selectedModel: string;
  selectedProvider: string;
  fallbackModel?: string;
  confidence: number;
  
  // Decision path
  decisionPath: IDecisionStep[];
  
  // Alternatives considered
  alternatives: Array<{
    modelId: string;
    provider: string;
    score: number;
    reason: string;
  }>;
  
  // Performance
  decisionTimeMs: number;
  
  // Estimates
  estimatedCost: number;
  estimatedLatency: number;
  
  // Actual results (filled in after execution)
  actualCost?: number;
  actualLatency?: number;
  success?: boolean;
  
  // Timestamp
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DecisionStepSchema = new Schema<IDecisionStep>(
  {
    step: { type: Number, required: true },
    type: {
      type: String,
      enum: ['filter', 'score', 'rule', 'fallback', 'ai_prediction', 'quota_check'],
      required: true
    },
    description: { type: String, required: true },
    result: { type: String, required: true },
    candidatesRemaining: { type: Number },
    duration: { type: Number },
    metadata: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const RoutingDecisionLogSchema = new Schema<IRoutingDecisionLog>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    projectId: {
      type: String,
      index: true,
      sparse: true
    },
    task: {
      type: {
        type: String,
        required: true
      },
      complexity: {
        type: String,
        enum: ['simple', 'moderate', 'complex'],
        required: true
      },
      agentRole: String,
      estimatedTokens: { type: Number, required: true },
      requiredCapabilities: [String]
    },
    selectedModel: {
      type: String,
      required: true,
      index: true
    },
    selectedProvider: {
      type: String,
      required: true,
      index: true
    },
    fallbackModel: String,
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    decisionPath: [DecisionStepSchema],
    alternatives: [{
      modelId: { type: String, required: true },
      provider: { type: String, required: true },
      score: { type: Number, required: true },
      reason: { type: String, required: true }
    }],
    decisionTimeMs: {
      type: Number,
      required: true
    },
    estimatedCost: {
      type: Number,
      required: true
    },
    estimatedLatency: {
      type: Number,
      required: true
    },
    actualCost: Number,
    actualLatency: Number,
    success: Boolean,
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

// Indexes for efficient queries
RoutingDecisionLogSchema.index({ timestamp: -1 });
RoutingDecisionLogSchema.index({ selectedModel: 1, timestamp: -1 });
RoutingDecisionLogSchema.index({ userId: 1, timestamp: -1 });
RoutingDecisionLogSchema.index({ 'task.type': 1, timestamp: -1 });

export const RoutingDecisionLog = mongoose.model<IRoutingDecisionLog>('RoutingDecisionLog', RoutingDecisionLogSchema);

