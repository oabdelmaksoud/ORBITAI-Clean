import mongoose, { Schema, Document } from 'mongoose';

export interface IPageContent extends Document {
  pageKey: string; // e.g., 'home', 'about', 'pricing'
  sectionKey: string; // e.g., 'hero', 'features', 'pricing', 'testimonials'
  content: {
    // Hero section
    title?: string;
    subtitle?: string;
    description?: string;
    ctaText?: string;
    ctaLink?: string;
    backgroundImage?: string;
    videoUrl?: string;
    
    // Features section
    features?: Array<{
      title: string;
      description: string;
      icon?: string;
      color?: string;
    }>;
    
    // Pricing/Plans section
    plansHeading?: string;
    plansSubheading?: string;
    
    // Testimonials section
    testimonials?: Array<{
      name: string;
      role: string;
      company: string;
      avatar: string;
      content: string;
      rating?: number;
    }>;
    
    // FAQ section
    faqs?: Array<{
      question: string;
      answer: string;
    }>;
    
    // Stats section
    stats?: Array<{
      label: string;
      value: string;
      description?: string;
    }>;
    
    // General content
    text?: string;
    html?: string;
    images?: string[];
    videos?: string[];
    buttons?: Array<{
      text: string;
      link: string;
      variant?: 'primary' | 'secondary' | 'outline';
    }>;
    
    // Styling
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
    
    // Flexible JSON for custom content
    customData?: Record<string, any>;
  };
  isActive: boolean;
  sortOrder: number;
  metadata?: {
    lastEditedBy?: string;
    lastEditedAt?: Date;
    version?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const pageContentSchema = new Schema<IPageContent>(
  {
    pageKey: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    sectionKey: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    sortOrder: {
      type: Number,
      default: 0
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

// Compound index for page + section uniqueness
pageContentSchema.index({ pageKey: 1, sectionKey: 1 }, { unique: true });
pageContentSchema.index({ pageKey: 1, sortOrder: 1 });

export const PageContent = mongoose.model<IPageContent>('PageContent', pageContentSchema);

