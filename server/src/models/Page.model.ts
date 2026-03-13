import mongoose, { Schema, Document } from 'mongoose';

export interface IPage extends Document {
  pageKey: string; // Unique identifier: 'home', 'about', 'pricing', etc.
  title: string;
  slug: string; // URL-friendly version
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  scheduledPublishAt?: Date;
  themeId?: mongoose.Types.ObjectId;
  templateId?: mongoose.Types.ObjectId;
  blocks: any; // Serialized block tree (Craft.js format)
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
    ogImage?: string;
  };
  settings?: {
    showHeader?: boolean;
    showFooter?: boolean;
    customCss?: string;
    customJs?: string;
  };
  metadata?: {
    createdBy?: string;
    lastEditedBy?: string;
    lastEditedAt?: Date;
    version?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<IPage>(
  {
    pageKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    publishedAt: {
      type: Date,
      index: true
    },
    scheduledPublishAt: {
      type: Date,
      index: true
    },
    themeId: {
      type: Schema.Types.ObjectId,
      ref: 'PageTheme',
      index: true
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'PageTemplate',
      index: true
    },
    blocks: {
      type: Schema.Types.Mixed,
      default: {}
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
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common queries
pageSchema.index({ status: 1, publishedAt: -1 });
pageSchema.index({ slug: 1 });
pageSchema.index({ scheduledPublishAt: 1 }, { sparse: true });

export const Page = mongoose.model<IPage>('Page', pageSchema);




