import mongoose, { Schema, Document } from 'mongoose';

export interface ICollaborativeDocument extends Document {
  id: string;
  title: string;
  content: string; // Rich text content (HTML/Markdown)
  contentType: 'markdown' | 'html' | 'plain';
  
  // Version control
  version: number;
  versions: Array<{
    version: number;
    content: string;
    changedBy: string;
    changeDate: Date;
    changeSummary: string;
  }>;
  
  // Collaboration
  collaborators: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: Date;
  }>;
  
  // Real-time editing
  activeEditors: Array<{
    userId: string;
    userName: string;
    cursorPosition?: number;
    lastSeen: Date;
  }>;
  
  // Comments and discussions
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    position?: number; // Character position in document
    replies: Array<{
      id: string;
      userId: string;
      userName: string;
      content: string;
      timestamp: Date;
    }>;
    timestamp: Date;
    resolved: boolean;
  }>;
  
  // Change tracking
  changes: Array<{
    id: string;
    userId: string;
    userName: string;
    type: 'insert' | 'delete' | 'format';
    position: number;
    length: number;
    content?: string;
    timestamp: Date;
  }>;
  
  // Metadata
  tags: string[];
  category: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  locked: boolean;
  lockedBy?: string;
  
  // Statistics
  statistics: {
    views: number;
    edits: number;
    comments: number;
    lastViewed?: Date;
    lastEdited?: Date;
  };
  
  // Related documents
  relatedDocuments: string[]; // IDs of related documents
  
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const collaborativeDocumentSchema = new Schema<ICollaborativeDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      enum: ['markdown', 'html', 'plain'],
      default: 'markdown'
    },
    version: {
      type: Number,
      default: 1
    },
    versions: [{
      version: Number,
      content: String,
      changedBy: String,
      changeDate: { type: Date, default: Date.now },
      changeSummary: String
    }],
    collaborators: [{
      userId: String,
      role: { type: String, enum: ['owner', 'editor', 'viewer'] },
      joinedAt: { type: Date, default: Date.now }
    }],
    activeEditors: [{
      userId: String,
      userName: String,
      cursorPosition: Number,
      lastSeen: { type: Date, default: Date.now }
    }],
    comments: [{
      id: String,
      userId: String,
      userName: String,
      content: String,
      position: Number,
      replies: [{
        id: String,
        userId: String,
        userName: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
      }],
      timestamp: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false }
    }],
    changes: [{
      id: String,
      userId: String,
      userName: String,
      type: { type: String, enum: ['insert', 'delete', 'format'] },
      position: Number,
      length: Number,
      content: String,
      timestamp: { type: Date, default: Date.now }
    }],
    tags: [String],
    category: {
      type: String,
      default: 'general'
    },
    status: {
      type: String,
      enum: ['draft', 'review', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    locked: {
      type: Boolean,
      default: false
    },
    lockedBy: String,
    statistics: {
      views: { type: Number, default: 0 },
      edits: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      lastViewed: Date,
      lastEdited: Date
    },
    relatedDocuments: [String],
    createdBy: {
      type: String,
      required: true
    },
    updatedBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

collaborativeDocumentSchema.index({ title: 'text', content: 'text', tags: 'text' });
collaborativeDocumentSchema.index({ status: 1, category: 1 });
collaborativeDocumentSchema.index({ 'statistics.views': -1 });

export const CollaborativeDocument = mongoose.model<ICollaborativeDocument>('CollaborativeDocument', collaborativeDocumentSchema);
















