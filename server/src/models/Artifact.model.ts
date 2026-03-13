/**
 * Artifact Model
 * Represents artifacts created during project development (code, requirements, designs, etc.)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IArtifact extends Document {
  title: string;
  content: string; // Markdown, code, or JSON stringified content
  type: 'requirement' | 'design' | 'code' | 'test-plan' | 'audit-report' | 'defect' | 'build' | 'mcp' | 'image' | 'audio' | 'video' | 'react-native' | 'flutter' | 'ios-swift' | 'android-kotlin' | 'notebook' | 'deployment';
  phase?: string;
  createdBy?: string; // Agent role or user ID
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tags?: string[];
  traceRefs?: mongoose.Types.ObjectId[]; // References to other artifacts
  embedding?: number[]; // Vector embedding for RAG
  metadata?: {
    filePath?: string;
    language?: string;
    framework?: string;
    deploymentUrl?: string;
    deploymentId?: string;
    platform?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ArtifactSchema = new Schema<IArtifact>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['requirement', 'design', 'code', 'test-plan', 'audit-report', 'defect', 'build', 'mcp', 'image', 'audio', 'video', 'react-native', 'flutter', 'ios-swift', 'android-kotlin', 'notebook', 'deployment'],
    },
    phase: {
      type: String,
    },
    createdBy: {
      type: String,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    traceRefs: {
      type: [Schema.Types.ObjectId],
      ref: 'Artifact',
      default: [],
    },
    embedding: {
      type: [Number],
      select: false, // Don't include in default queries (large arrays)
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ArtifactSchema.index({ projectId: 1, type: 1 });
ArtifactSchema.index({ userId: 1, createdAt: -1 });
ArtifactSchema.index({ tags: 1 });

// Pre-save hook: auto-generate embedding
ArtifactSchema.pre('save', async function(next) {
  // Skip if embedding already exists
  if (this.embedding && this.embedding.length > 0) {
    return next();
  }

  // Skip if no content
  if (!this.content || this.content.trim().length === 0) {
    return next();
  }

  try {
    // Dynamic import to avoid circular dependency
    const { embeddingService } = await import('../services/embedding.service.js');
    
    const textToEmbed = `${this.title}\n\n${this.content.substring(0, 8000)}`;
    const embedding = await embeddingService.generateEmbedding(textToEmbed);
    
    this.embedding = embedding;
    next();
  } catch (error: unknown) {
    // Log but don't fail - embedding is optional
    const { logger } = await import('../utils/logger.js');
    logger.warn(`Failed to generate embedding for artifact ${this._id}:`, error);
    next();
  }
});

export const Artifact = mongoose.model<IArtifact>('Artifact', ArtifactSchema);




