import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhook extends Document {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  events: string[]; // Event types to listen for
  headers?: Record<string, string>;
  secret?: string; // Webhook secret for verification
  isActive: boolean;
  retryCount: number;
  timeout: number; // Timeout in milliseconds
  lastTriggered?: Date;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  createdBy: string; // Admin ID
  createdAt: Date;
  updatedAt: Date;
}

const webhookSchema = new Schema<IWebhook>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      validate: {
        validator: function(v: string) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'URL must be a valid HTTP/HTTPS URL'
      }
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE'],
      default: 'POST'
    },
    events: [{
      type: String,
      required: true
    }],
    headers: {
      type: Schema.Types.Mixed,
      default: {}
    },
    secret: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    retryCount: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },
    timeout: {
      type: Number,
      default: 5000, // 5 seconds
      min: 1000,
      max: 30000
    },
    lastTriggered: {
      type: Date
    },
    lastStatus: {
      type: String,
      enum: ['success', 'failed']
    },
    lastError: {
      type: String
    },
    createdBy: {
      type: String,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
webhookSchema.index({ isActive: 1, events: 1 });
webhookSchema.index({ createdBy: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', webhookSchema);
