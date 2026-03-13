import mongoose, { Schema, Document } from 'mongoose';

export interface IIPWhitelist extends Document {
  ipAddress: string;
  type: 'whitelist' | 'blacklist';
  reason?: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

const ipWhitelistSchema = new Schema<IIPWhitelist>(
  {
    ipAddress: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['whitelist', 'blacklist'],
      index: true
    },
    reason: {
      type: String
    },
    createdBy: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound index
ipWhitelistSchema.index({ ipAddress: 1, type: 1, isActive: 1 });

export const IPWhitelist = mongoose.model<IIPWhitelist>('IPWhitelist', ipWhitelistSchema);
















