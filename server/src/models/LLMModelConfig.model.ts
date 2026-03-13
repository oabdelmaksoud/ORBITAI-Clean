import mongoose, { Schema, Document } from 'mongoose';

export interface ILLMModelConfig extends Document {
  modelId: string; // Unique identifier (e.g., 'gemini-2.5-flash', 'gpt-4o')
  isEnabled: boolean; // Whether this model is enabled for use
  status: 'active' | 'maintenance' | 'deprecated'; // Model status
  pricing?: {
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
  };
  performance?: {
    avgLatencyMs: number;
    reliability: number;
  };
  // Full model definition for synced models (stored when model is synced from provider)
  modelDefinition?: {
    name: string;
    provider: string;
    modelIdentifier: string;
    capabilities: {
      structuredOutput: boolean;
      codeGeneration: boolean;
      longContext: boolean;
      fastResponse: boolean;
      streaming: boolean;
      functionCalling: boolean;
    };
    limits: {
      maxTokens: number;
      maxContextLength: number;
      maxOutputTokens?: number;
    };
    recommendedFor: {
      agentRoles: string[];
      taskTypes: string[];
      complexity: string[];
    };
  };
  metadata?: {
    lastUpdatedBy?: string; // Admin who last updated
    updateReason?: string;
    syncedFromProvider?: boolean; // Whether this model was synced from a provider
  };
  createdAt: Date;
  updatedAt: Date;
}

const llmModelConfigSchema = new Schema<ILLMModelConfig>(
  {
    modelId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    isEnabled: {
      type: Boolean,
      required: true,
      default: false,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'deprecated'],
      required: true,
      default: 'active',
      index: true
    },
    pricing: {
      inputCostPer1MTokens: Number,
      outputCostPer1MTokens: Number
    },
    performance: {
      avgLatencyMs: Number,
      reliability: Number
    },
    modelDefinition: {
      name: String,
      provider: String,
      modelIdentifier: String,
      capabilities: {
        structuredOutput: Boolean,
        codeGeneration: Boolean,
        longContext: Boolean,
        fastResponse: Boolean,
        streaming: Boolean,
        functionCalling: Boolean
      },
      limits: {
        maxTokens: Number,
        maxContextLength: Number,
        maxOutputTokens: Number
      },
      recommendedFor: {
        agentRoles: [String],
        taskTypes: [String],
        complexity: [String]
      }
    },
    metadata: {
      lastUpdatedBy: String,
      updateReason: String,
      syncedFromProvider: Boolean
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast queries
llmModelConfigSchema.index({ modelId: 1, isEnabled: 1 });
llmModelConfigSchema.index({ status: 1, isEnabled: 1 });

export const LLMModelConfig = mongoose.model<ILLMModelConfig>('LLMModelConfig', llmModelConfigSchema);


