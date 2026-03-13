import mongoose, { Schema, Document } from 'mongoose';

export interface IProjectFolder extends Document {
  userId: string;
  name: string;
  description?: string;
  platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
  metadata?: Record<string, any>;
  conversationIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const projectFolderSchema = new Schema<IProjectFolder>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    platforms: {
      type: [String],
      enum: ['web', 'android', 'ios', 'desktop', 'api', 'other'],
      default: ['other']
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    conversationIds: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
projectFolderSchema.index({ userId: 1, createdAt: -1 });
projectFolderSchema.index({ userId: 1, name: 1 });

export const ProjectFolder = mongoose.model<IProjectFolder>('ProjectFolder', projectFolderSchema);

