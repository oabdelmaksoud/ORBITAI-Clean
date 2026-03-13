import mongoose, { Schema, Document } from 'mongoose';

export interface IDatabaseBackup extends Document {
  filename: string;
  filePath: string;
  fileSize: number; // in bytes
  backupType: 'manual' | 'scheduled' | 'automated';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  collections: string[]; // Which collections were backed up
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  verified: boolean;
  verifiedAt?: Date;
  createdBy?: string;
  retentionDays: number;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

const databaseBackupSchema = new Schema<IDatabaseBackup>(
  {
    filename: {
      type: String,
      required: true,
      unique: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    backupType: {
      type: String,
      required: true,
      enum: ['manual', 'scheduled', 'automated'],
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    collections: {
      type: [String],
      default: []
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    completedAt: {
      type: Date
    },
    error: {
      type: String
    },
    verified: {
      type: Boolean,
      default: false,
      index: true
    },
    verifiedAt: {
      type: Date
    },
    createdBy: {
      type: String
    },
    retentionDays: {
      type: Number,
      default: 30
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes
databaseBackupSchema.index({ status: 1, createdAt: -1 });
databaseBackupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired backups

export const DatabaseBackup = mongoose.model<IDatabaseBackup>('DatabaseBackup', databaseBackupSchema);
















