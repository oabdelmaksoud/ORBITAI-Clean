import mongoose, { Schema, Document } from 'mongoose';

export interface ILLMUsage extends Document {
  userId?: string; // Optional - can track per user or globally
  projectId?: string; // Optional - can track per project
  modelId: string; // e.g., 'gemini-2.5-flash', 'gpt-4o'
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'ollama' | 'vllm' | 'openai_compatible' | 'custom';
  modelIdentifier: string; // Actual model identifier used in API call

  // Token usage
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  // Cost calculation
  inputCost: number; // Cost for input tokens in USD
  outputCost: number; // Cost for output tokens in USD
  totalCost: number; // Total cost in USD

  // Request metadata
  requestType: string; // e.g., 'chat', 'code-generation', 'documentation'
  agentRole?: string; // Agent that made the request
  taskType?: string; // Type of task

  // Timestamps
  timestamp: Date;

  // Response metadata
  success: boolean;
  errorMessage?: string;
  latencyMs?: number; // Response latency in milliseconds

  // Context information
  context?: 'wizard' | 'workspace' | 'other'; // Where the LLM call was made

  // Router type - distinguishes between end-user router and internal router
  routerType?: 'end-user' | 'internal' | 'specific' | string; // Which router handled this request

  // Additional metadata
  metadata?: {
    promptLength?: number;
    responseLength?: number;
    [key: string]: any;
  };

  createdAt: Date;
  updatedAt: Date;
}

const llmUsageSchema = new Schema<ILLMUsage>(
  {
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
    modelId: {
      type: String,
      required: true,
      index: true
    },
    provider: {
      type: String,
      required: true,
      enum: ['gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral', 'qwen', 'openrouter', 'groq', 'vertex', 'azure', 'ollama', 'vllm', 'openai_compatible', 'custom'],
      index: true
    },
    modelIdentifier: {
      type: String,
      required: true
    },
    inputTokens: {
      type: Number,
      required: true,
      default: 0
    },
    outputTokens: {
      type: Number,
      required: true,
      default: 0
    },
    totalTokens: {
      type: Number,
      required: true,
      default: 0
    },
    inputCost: {
      type: Number,
      required: true,
      default: 0
    },
    outputCost: {
      type: Number,
      required: true,
      default: 0
    },
    totalCost: {
      type: Number,
      required: true,
      default: 0,
      index: true
    },
    requestType: {
      type: String,
      required: true,
      index: true
    },
    agentRole: {
      type: String,
      index: true
    },
    taskType: {
      type: String,
      index: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    success: {
      type: Boolean,
      required: true,
      default: true
    },
    errorMessage: {
      type: String
    },
    latencyMs: {
      type: Number
    },
    context: {
      type: String,
      enum: ['wizard', 'workspace', 'other'],
      index: true
    },
    routerType: {
      type: String,
      enum: ['end-user', 'internal', 'specific'],
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
llmUsageSchema.index({ timestamp: -1 }); // Recent first
llmUsageSchema.index({ provider: 1, timestamp: -1 });
llmUsageSchema.index({ modelId: 1, timestamp: -1 });
llmUsageSchema.index({ userId: 1, timestamp: -1 });
llmUsageSchema.index({ projectId: 1, timestamp: -1 });
llmUsageSchema.index({ timestamp: 1, totalCost: 1 }); // For cost aggregation
llmUsageSchema.index({ context: 1, timestamp: -1 }); // For context-based queries
llmUsageSchema.index({ routerType: 1, timestamp: -1 }); // For router type filtering
llmUsageSchema.index({ routerType: 1, timestamp: 1, totalCost: 1 }); // For router-specific cost aggregation

export const LLMUsage = mongoose.model<ILLMUsage>('LLMUsage', llmUsageSchema);

