import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplate extends Document {
  userId: string;
  name: string;
  description: string;
  category?: string;
  methodology?: string;
  estimatedSprints?: number;
  agents: any[];
  selectedStandards?: string[];
  mcpServers: any[];
  budget: {
    total: number;
    used: number;
    currency: string;
    totalTokens: number;
    lastUpdated: number;
  };
  tags: string[];
  isPublic?: boolean; // Allow sharing templates
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    category: {
      type: String
    },
    methodology: {
      type: String,
      enum: ['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Iterative', 'Prototyping', 'RAD', 'Scrum', 'Lean', 'ASD'],
      default: null
    },
    estimatedSprints: {
      type: Number,
      default: null
    },
    agents: {
      type: Array,
      default: []
    } as any,
    selectedStandards: {
      type: [String],
      default: []
    },
    mcpServers: {
      type: Array,
      default: []
    } as any,
    budget: {
      total: { type: Number, default: 50.00 },
      used: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' },
      totalTokens: { type: Number, default: 0 },
      lastUpdated: { type: Number, default: Date.now }
    },
    tags: {
      type: [String],
      default: []
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
templateSchema.index({ userId: 1, createdAt: -1 });
templateSchema.index({ isPublic: 1, createdAt: -1 });
templateSchema.index({ userId: 1, name: 1 });

export const Template = mongoose.model<ITemplate>('Template', templateSchema);












