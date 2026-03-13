import mongoose, { Schema, Document } from 'mongoose';

export interface IPageRevision extends Document {
  pageId: mongoose.Types.ObjectId;
  pageKey: string; // Denormalized for easier queries
  revisionNumber: number;
  blocks: any; // Serialized block tree snapshot
  status: 'draft' | 'published' | 'archived';
  title: string;
  slug: string;
  themeId?: mongoose.Types.ObjectId;
  templateId?: mongoose.Types.ObjectId;
  seo?: any;
  settings?: any;
  metadata: {
    createdBy: string;
    createdAt: Date;
    note?: string; // Optional revision note
    isAutoSave?: boolean;
  };
  createdAt: Date;
}

const pageRevisionSchema = new Schema<IPageRevision>(
  {
    pageId: {
      type: Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true
    },
    pageKey: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    revisionNumber: {
      type: Number,
      required: true
    },
    blocks: {
      type: Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    },
    themeId: {
      type: Schema.Types.ObjectId,
      ref: 'PageTheme'
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'PageTemplate'
    },
    seo: {
      type: Schema.Types.Mixed,
      default: {}
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {}
    },
    metadata: {
      createdBy: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      note: {
        type: String,
        trim: true
      },
      isAutoSave: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound index for page revisions ordered by revision number
pageRevisionSchema.index({ pageId: 1, revisionNumber: -1 });
pageRevisionSchema.index({ pageKey: 1, createdAt: -1 });

export const PageRevision = mongoose.model<IPageRevision>('PageRevision', pageRevisionSchema);




