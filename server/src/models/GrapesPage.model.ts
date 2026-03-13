import mongoose, { Document, Schema } from 'mongoose';

export interface IGrapesPage extends Document {
  name: string;
  slug: string;
  html: string;
  css: string;
  components?: string; // GrapesJS components JSON
  styles?: string; // GrapesJS styles JSON
  assets?: string[]; // Asset URLs
  metadata: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
    customHead?: string;
  };
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GrapesPageSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  html: {
    type: String,
    default: '',
  },
  css: {
    type: String,
    default: '',
  },
  components: {
    type: String,
    default: '[]', // GrapesJS components JSON
  },
  styles: {
    type: String,
    default: '[]', // GrapesJS styles JSON
  },
  assets: [{
    type: String,
  }],
  metadata: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    keywords: [{ type: String }],
    ogImage: { type: String, default: '' },
    customHead: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  publishedAt: {
    type: Date,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Pre-save hook to generate slug from name if not provided
GrapesPageSchema.pre('save', function(next) {
  if (this.isNew && !this.slug) {
    this.slug = (this.name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Index for efficient queries
GrapesPageSchema.index({ status: 1, createdAt: -1 });
GrapesPageSchema.index({ createdBy: 1 });

export const GrapesPage = mongoose.model<IGrapesPage>('GrapesPage', GrapesPageSchema);




