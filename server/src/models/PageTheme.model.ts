import mongoose, { Schema, Document } from 'mongoose';

export interface IPageTheme extends Document {
  name: string;
  slug: string;
  description?: string;
  isDefault: boolean;
  isSystem: boolean; // System themes cannot be deleted
  designTokens: {
    colors: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      surface?: string;
      text?: string;
      textSecondary?: string;
      border?: string;
      error?: string;
      warning?: string;
      success?: string;
      info?: string;
      [key: string]: string | undefined;
    };
    typography: {
      fontFamily?: string;
      fontFamilyHeading?: string;
      fontSizeBase?: string;
      fontSizeScale?: number;
      lineHeight?: number;
      fontWeightNormal?: number;
      fontWeightBold?: number;
      [key: string]: any;
    };
    spacing: {
      unit?: number;
      scale?: number[];
      [key: string]: any;
    };
    borderRadius?: {
      small?: string;
      medium?: string;
      large?: string;
      [key: string]: string | undefined;
    };
    shadows?: {
      small?: string;
      medium?: string;
      large?: string;
      [key: string]: string | undefined;
    };
    [key: string]: any;
  };
  customCss?: string;
  metadata?: {
    createdBy?: string;
    lastEditedBy?: string;
    lastEditedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const pageThemeSchema = new Schema<IPageTheme>(
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
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    designTokens: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    customCss: {
      type: String,
      trim: true
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

// Ensure only one default theme
pageThemeSchema.index({ isDefault: 1 }, { unique: true, sparse: true });

export const PageTheme = mongoose.model<IPageTheme>('PageTheme', pageThemeSchema);




