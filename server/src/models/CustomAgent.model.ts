import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomAgent extends Document {
  userId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId; // Optional: agent can be project-specific or global
  name: string;
  title?: string; // Job title/position (e.g., "Senior Developer", "Team Lead")
  role: string;
  reportsTo?: mongoose.Types.ObjectId | ICustomAgent; // ID of agent this agent reports to (for hierarchy)
  mode: 'Reasoning' | 'Deterministic';
  avatar: string;
  description: string;
  goal: string;
  backstory: string;
  systemPrompt?: string; // Custom system prompt for the agent
  capabilities: string[]; // List of capabilities (e.g., 'code_generation', 'testing', 'documentation')
  preferredLLM?: string; // Preferred LLM model for this agent
  temperature?: number; // Temperature setting for LLM calls
  maxTokens?: number; // Max tokens for responses
  tools: string[]; // MCP tools this agent can use
  isActive: boolean;
  isPublic: boolean; // Whether this agent can be shared/discovered by others
  usageCount: number; // How many times this agent has been used
  rating?: number; // Average rating (1-5)
  ratingCount?: number; // Number of ratings
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const customAgentSchema = new Schema<ICustomAgent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100,
      description: 'Job title or position (e.g., "Senior Developer", "Team Lead")'
    },
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    reportsTo: {
      type: Schema.Types.ObjectId,
      ref: 'CustomAgent',
      description: 'ID of agent this agent reports to (for organizational hierarchy)'
    },
    mode: {
      type: String,
      enum: ['Reasoning', 'Deterministic'],
      default: 'Reasoning'
    },
    avatar: {
      type: String,
      default: function() {
        return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${this.name}&backgroundColor=transparent`;
      }
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    goal: {
      type: String,
      required: true,
      maxlength: 1000
    },
    backstory: {
      type: String,
      required: true,
      maxlength: 2000
    },
    systemPrompt: {
      type: String,
      maxlength: 10000
    },
    capabilities: {
      type: [String],
      default: []
    },
    preferredLLM: {
      type: String
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.7
    },
    maxTokens: {
      type: Number,
      min: 100,
      max: 128000,
      default: 4096
    },
    tools: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    usageCount: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    tags: {
      type: [String],
      default: []
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

// Indexes for efficient queries
customAgentSchema.index({ userId: 1, isActive: 1 });
customAgentSchema.index({ projectId: 1, isActive: 1 });
customAgentSchema.index({ isPublic: 1, isActive: 1 });
customAgentSchema.index({ tags: 1 });
customAgentSchema.index({ reportsTo: 1 }); // Index for hierarchy queries
customAgentSchema.index({ name: 'text', description: 'text', role: 'text' });

// Virtual for full avatar URL
customAgentSchema.virtual('avatarUrl').get(function() {
  if (this.avatar.startsWith('http')) {
    return this.avatar;
  }
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${this.name}&backgroundColor=transparent`;
});

export const CustomAgent = mongoose.model<ICustomAgent>('CustomAgent', customAgentSchema);




