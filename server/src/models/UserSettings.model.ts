import mongoose, { Schema, Document } from 'mongoose';

export interface UserApiKey {
  provider: string;
  apiKey: string; // Encrypted
  createdAt: Date;
  lastUsed?: Date;
}

export interface LocalLLMConfig {
  type: 'ollama' | 'vllm' | 'openai_compatible';
  baseUrl: string;
  models: string[];
  enabled: boolean;
  createdAt: Date;
  lastTested?: Date;
}

export interface LLMConfig {
  apiKeys: UserApiKey[];
  localLLMs: LocalLLMConfig[];
  apiKeyPreference: 'user' | 'platform' | 'user_then_platform';
  providerOverrides?: {
    [provider: string]: 'user' | 'platform' | 'user_then_platform'; // Per-provider preference override
  };
  defaultModels?: {
    [provider: string]: string; // provider -> modelId
  };
}

export interface IUserSettings extends Document {
  userId: string;
  currentProjectId?: string;
  preferences: {
    theme?: string;
    selectedTheme?: string;
    viewMode?: string;
    leftTab?: string;
    activeTab?: string;
    dismissedGuestBanner?: boolean;
    [key: string]: any; // Allow flexible preferences
  };
  shareLinks?: {
    [projectId: string]: any[];
  };
  shareTokens?: {
    [token: string]: {
      projectId: string;
      createdAt: number;
      expiresAt?: number;
    };
  };
  llmConfig?: LLMConfig;
  createdAt: Date;
  updatedAt: Date;
}

const userSettingsSchema = new Schema<IUserSettings>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    currentProjectId: {
      type: String,
      default: null
    },
    preferences: {
      type: Schema.Types.Mixed,
      default: {}
    },
    shareLinks: {
      type: Schema.Types.Mixed,
      default: {}
    },
    shareTokens: {
      type: Schema.Types.Mixed,
      default: {}
    },
    llmConfig: {
      type: {
        apiKeys: [{
          provider: { type: String, required: true },
          apiKey: { type: String, required: true }, // Encrypted
          createdAt: { type: Date, default: Date.now },
          lastUsed: { type: Date }
        }],
        localLLMs: [{
          type: { type: String, enum: ['ollama', 'vllm', 'openai_compatible'], required: true },
          baseUrl: { type: String, required: true },
          models: [{ type: String }],
          enabled: { type: Boolean, default: true },
          createdAt: { type: Date, default: Date.now },
          lastTested: { type: Date }
        }],
        apiKeyPreference: {
          type: String,
          enum: ['user', 'platform', 'user_then_platform'],
          default: 'user_then_platform'
        },
        providerOverrides: {
          type: Schema.Types.Mixed,
          default: {}
        },
        defaultModels: {
          type: Schema.Types.Mixed,
          default: {}
        }
      },
      default: {
        apiKeys: [],
        localLLMs: [],
        apiKeyPreference: 'user_then_platform',
        defaultModels: {}
      }
    }
  },
  {
    timestamps: true
  }
);

// Note: userId already has an index from unique: true and index: true in the schema definition above
// No need for explicit index() call here to avoid duplicate index warning

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', userSettingsSchema);










