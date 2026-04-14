import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceSession extends Document {
  sessionId: string;
  userId?: string;
  conversationId?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
  transcripts: Array<{
    userText: string;
    aiText: string;
    timestamp: number;
  }>;
  status: 'active' | 'ended';
  endedAt?: Date;
}

const voiceSessionSchema = new Schema<IVoiceSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    conversationId: {
      type: String,
      index: true,
      sparse: true
    },
    createdAt: {
      type: Date,
      required: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    transcripts: [
      {
        userText: { type: String, required: true },
        aiText: { type: String, required: true },
        timestamp: { type: Number, required: true }
      }
    ],
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
      index: true
    },
    endedAt: {
      type: Date
    }
  },
  {
    timestamps: false // createdAt is managed manually to match the VoiceSession interface
  }
);

voiceSessionSchema.index({ userId: 1, status: 1 });
voiceSessionSchema.index({ status: 1, endedAt: 1 });

export const VoiceSessionModel = mongoose.model<IVoiceSession>('VoiceSession', voiceSessionSchema);
