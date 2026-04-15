/**
 * API Key Model - Secure storage of API keys with encryption
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'mistral' | 'qwen' | 'huggingface' | 'e2b' | 'google_search' | 'openrouter' | 'groq' | 'vertex' | 'azure' | 'custom';
  keyName: string; // User-friendly name (e.g., "Production OpenAI Key")
  encryptedValue: string; // Encrypted API key
  iv: string; // Initialization vector for decryption
  tag: string; // Auth tag for GCM decryption
  lastUsed?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isActive: boolean;
  metadata?: {
    environment?: 'development' | 'staging' | 'production'; // Deprecated - use enabledEnvironments
    enabledEnvironments?: string[]; // Array of environments where this key is active (empty = all environments)
    description?: string;
    tags?: string[];
    // Additional configuration for specific providers
    additionalConfig?: {
      // Google Search: Engine ID is required alongside API key
      engineId?: string; // GOOGLE_SEARCH_ENGINE_ID
      // Add other provider-specific config here as needed
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>({
  provider: {
    type: String,
    required: true,
    enum: ['gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'mistral', 'qwen', 'huggingface', 'e2b', 'google_search', 'openrouter', 'groq', 'vertex', 'azure', 'custom'],
    index: true
  },
  keyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  encryptedValue: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  tag: {
    type: String,
    required: false // Optional: legacy records store tag in encryptedValue as 'encrypted:tag'
  },
  lastUsed: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    environment: {
      type: String,
      enum: ['development', 'staging', 'production']
    },
    enabledEnvironments: {
      type: [String],
      default: []
    },
    description: String,
    tags: [String],
    additionalConfig: {
      engineId: String // For Google Search Engine ID
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
ApiKeySchema.index({ provider: 1, isActive: 1 });
ApiKeySchema.index({ createdBy: 1 });

// Prevent duplicate active keys for same provider (optional - can have multiple keys)
// ApiKeySchema.index({ provider: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

