import mongoose, { Schema, Document } from 'mongoose';

export interface IMarketplaceListing extends Document {
  id: string;
  improvementId: string; // Reference to ProcessImprovement
  title: string;
  description: string;
  category: string;
  
  // Publishing
  published: boolean;
  publishedAt?: Date;
  publishedBy: string;
  
  // Community metrics
  ratings: Array<{
    userId: string;
    rating: number; // 1-5
    comment?: string;
    timestamp: Date;
  }>;
  averageRating: number;
  totalRatings: number;
  
  // Usage statistics
  downloads: number;
  forks: number;
  views: number;
  
  // Sharing
  shareable: boolean;
  license: 'public' | 'private' | 'restricted';
  organizationId?: string; // For organization sharing
  
  // Tags and search
  tags: string[];
  keywords: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

const marketplaceListingSchema = new Schema<IMarketplaceListing>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    improvementId: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      index: true
    },
    published: {
      type: Boolean,
      default: false,
      index: true
    },
    publishedAt: Date,
    publishedBy: {
      type: String,
      required: true
    },
    ratings: [{
      userId: String,
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      timestamp: { type: Date, default: Date.now }
    }],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    forks: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    shareable: {
      type: Boolean,
      default: true
    },
    license: {
      type: String,
      enum: ['public', 'private', 'restricted'],
      default: 'public'
    },
    organizationId: String,
    tags: [String],
    keywords: [String]
  },
  {
    timestamps: true
  }
);

marketplaceListingSchema.index({ title: 'text', description: 'text', tags: 'text', keywords: 'text' });
marketplaceListingSchema.index({ published: 1, category: 1 });
marketplaceListingSchema.index({ averageRating: -1, downloads: -1 });

export const MarketplaceListing = mongoose.model<IMarketplaceListing>('MarketplaceListing', marketplaceListingSchema);
















