import mongoose, { Schema, Document } from 'mongoose';

export interface IPageTemplate extends Document {
  name: string;
  slug: string;
  description?: string;
  category: 'landing' | 'blog' | 'product' | 'portfolio' | 'ecommerce' | 'custom';
  thumbnail?: string; // URL to preview image
  isPublic: boolean; // Can be used by all users
  isSystem: boolean; // System templates cannot be deleted
  blocks: any; // Serialized block tree
  themeId?: mongoose.Types.ObjectId;
  tags?: string[];
  metadata?: {
    createdBy?: string;
    lastEditedBy?: string;
    lastEditedAt?: Date;
    usageCount?: number; // Track how many times template was used
  };
  createdAt: Date;
  updatedAt: Date;
}

const pageTemplateSchema = new Schema<IPageTemplate>(
  {
    name: {
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
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      enum: ['landing', 'blog', 'product', 'portfolio', 'ecommerce', 'custom'],
      default: 'custom',
      index: true
    },
    thumbnail: {
      type: String,
      trim: true
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    blocks: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    themeId: {
      type: Schema.Types.ObjectId,
      ref: 'PageTheme',
      index: true
    },
    tags: {
      type: [String],
      default: [],
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

// Indexes for template discovery
pageTemplateSchema.index({ category: 1, isPublic: 1 });
pageTemplateSchema.index({ tags: 1 });

export const PageTemplate = mongoose.model<IPageTemplate>('PageTemplate', pageTemplateSchema);




