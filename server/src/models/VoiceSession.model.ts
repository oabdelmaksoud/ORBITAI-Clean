/**
 * VoiceSession Model
 * Persists Pipecat voice sessions to MongoDB.
 * Replaces the previous in-memory Map storage (fixes: sessions lost on restart).
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IVoiceTranscript {
  userText: string;
  aiText: string;
  timestamp: number;
}

export interface IVoiceSession extends Document {
  sessionId: string;
  userId?: string;
  conversationId?: string;
  status: 'active' | 'ended' | 'expired';
  metadata: Record<string, any>;
  transcripts: IVoiceTranscript[];
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

const VoiceTranscriptSchema = new Schema<IVoiceTranscript>(
  {
    userText: { type: String, required: true },
    aiText: { type: String, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false }
);

const VoiceSessionSchema = new Schema<IVoiceSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    conversationId: { type: String },
    status: {
      type: String,
      enum: ['active', 'ended', 'expired'],
      default: 'active',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    transcripts: { type: [VoiceTranscriptSchema], default: [] },
    endedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'voicesessions',
  }
);

// TTL index: automatically remove ended sessions after 7 days
VoiceSessionSchema.index(
  { endedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: 'ended' } }
);

export const VoiceSession = mongoose.model<IVoiceSession>('VoiceSession', VoiceSessionSchema);
