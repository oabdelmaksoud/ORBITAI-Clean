import mongoose, { Schema, Document } from 'mongoose';

export interface IBenchmarkResult extends Document {
  modelId: string;
  provider: string;
  taskType: string;
  
  // Performance metrics
  latency: number; // milliseconds
  timeToFirstToken?: number; // milliseconds
  tokensPerSecond?: number;
  
  // Cost metrics
  cost: number; // USD
  inputTokens: number;
  outputTokens: number;
  
  // Quality metrics
  qualityScore: number; // 0-100
  coherenceScore?: number; // 0-100
  accuracyScore?: number; // 0-100
  formatComplianceScore?: number; // 0-100
  
  // Benchmark metadata
  benchmarkPrompt: string;
  expectedOutput?: string;
  actualOutput?: string;
  
  // Status
  status: 'success' | 'failure' | 'timeout';
  errorMessage?: string;
  
  // Timestamps
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BenchmarkResultSchema = new Schema<IBenchmarkResult>(
  {
    modelId: {
      type: String,
      required: true,
      index: true
    },
    provider: {
      type: String,
      required: true,
      index: true
    },
    taskType: {
      type: String,
      required: true,
      index: true
    },
    latency: {
      type: Number,
      required: true
    },
    timeToFirstToken: {
      type: Number
    },
    tokensPerSecond: {
      type: Number
    },
    cost: {
      type: Number,
      required: true
    },
    inputTokens: {
      type: Number,
      required: true
    },
    outputTokens: {
      type: Number,
      required: true
    },
    qualityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    coherenceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    accuracyScore: {
      type: Number,
      min: 0,
      max: 100
    },
    formatComplianceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    benchmarkPrompt: {
      type: String,
      required: true
    },
    expectedOutput: {
      type: String
    },
    actualOutput: {
      type: String
    },
    status: {
      type: String,
      enum: ['success', 'failure', 'timeout'],
      required: true,
      index: true
    },
    errorMessage: {
      type: String
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

// Indexes for efficient queries
BenchmarkResultSchema.index({ modelId: 1, taskType: 1, timestamp: -1 });
BenchmarkResultSchema.index({ provider: 1, timestamp: -1 });
BenchmarkResultSchema.index({ taskType: 1, timestamp: -1 });

export const BenchmarkResult = mongoose.model<IBenchmarkResult>('BenchmarkResult', BenchmarkResultSchema);

