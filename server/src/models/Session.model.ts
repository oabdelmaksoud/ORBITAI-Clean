import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: string;
  email: string;
  token: string;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ipAddress: {
      type: String,
      required: true,
      index: true
    },
    userAgent: {
      type: String
    },
    location: {
      country: String,
      city: String
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired sessions

export const Session = mongoose.model<ISession>('Session', sessionSchema);
















