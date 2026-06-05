import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt, isEncrypted, REDACTED } from '../utils/secretCrypto.js';

export interface IMCPServer extends Document {
  /** Returns the decrypted plaintext apiKey for outbound use (never exposed via toJSON). */
  getDecryptedApiKey(): string | undefined;
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  source: 'system' | 'user' | 'agent'; // system = default, user = created by user, agent = created by agent
  tools: string[]; // List of tool names provided by this server
  config: {
    type: 'e2b' | 'http' | 'stdio' | 'websocket' | 'custom';
    endpoint?: string; // For HTTP/WebSocket
    command?: string; // For stdio
    args?: string[]; // For stdio
    headers?: Record<string, string>; // For HTTP
    apiKey?: string; // Encrypted API key if needed
  };
  metadata?: {
    createdBy?: string; // User ID or agent role
    createdFor?: string; // Project ID or task ID
    tags?: string[];
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

const mcpServerSchema = new Schema<IMCPServer>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    source: {
      type: String,
      enum: ['system', 'user', 'agent'],
      default: 'user',
      index: true,
    },
    tools: {
      type: [String],
      default: [],
    },
    config: {
      type: {
        type: String,
        enum: ['e2b', 'http', 'stdio', 'websocket', 'custom'],
        required: true,
      },
      endpoint: String,
      command: String,
      args: [String],
      headers: Schema.Types.Mixed,
      apiKey: String, // Should be encrypted in production
    },
    metadata: {
      createdBy: String,
      createdFor: String,
      tags: [String],
      notes: String,
    },
    lastUsed: Date,
  },
  {
    timestamps: true,
    collection: 'mcpservers',
  }
);

// Indexes for efficient queries
mcpServerSchema.index({ source: 1, status: 1 });
mcpServerSchema.index({ 'metadata.createdBy': 1 });
mcpServerSchema.index({ 'metadata.createdFor': 1 });
mcpServerSchema.index({ createdAt: -1 });

// Encrypt config.apiKey at rest before persisting.
// Guarded so we never double-encrypt an already-enveloped value.
mcpServerSchema.pre('save', function (next) {
  const apiKey = this.config?.apiKey;
  if (this.isModified('config.apiKey') && apiKey && !isEncrypted(apiKey)) {
    this.config.apiKey = encrypt(apiKey);
  }
  next();
});

// Decrypt the stored apiKey for outbound use (e.g. setting an HTTP Authorization
// header when connecting to the MCP server). Never call this on a response path.
mcpServerSchema.methods.getDecryptedApiKey = function (): string | undefined {
  const apiKey = this.config?.apiKey;
  if (!apiKey) return undefined;
  return decrypt(apiKey);
};

// Redact the secret when serializing to JSON (API responses, logs).
mcpServerSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    if (ret?.config && typeof ret.config.apiKey === 'string' && ret.config.apiKey) {
      ret.config.apiKey = REDACTED;
    }
    return ret;
  },
});

export const MCPServer = mongoose.model<IMCPServer>('MCPServer', mcpServerSchema);
