import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentKnowledge extends Document {
  agentRole: string; // e.g., 'Orchestrator', 'Requirements Agent'
  agentId?: string; // Optional specific agent instance ID
  
  // Knowledge Domains
  knowledgeDomains: {
    domain: string; // e.g., 'Software Architecture', 'Frontend Development', 'Security'
    level: number; // 0-100 skill level
    confidence: number; // 0-100, confidence in this knowledge
    lastUpdated: Date;
    examples?: string[]; // Examples of knowledge in this domain
  }[];
  
  // Skills Matrix
  skills: {
    skill: string; // e.g., 'React Development', 'API Design', 'Testing'
    category: string; // e.g., 'Technical', 'Process', 'Communication'
    proficiency: number; // 0-100
    confidence: number; // 0-100, confidence in this skill
    experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    lastUsed?: Date;
    successRate?: number; // 0-100
    tasksCompleted?: number;
  }[];
  
  // Specializations
  specializations: string[]; // e.g., ['V-Model SDLC', 'Microservices', 'Cloud Architecture']
  
  // Performance Metrics
  metrics: {
    totalTasksCompleted: number;
    averageTaskQuality: number; // 0-100
    averageResponseTime: number; // milliseconds
    userSatisfactionRating?: number; // 0-5
    lastActiveDate?: Date;
  };
  
  // Model Preferences (which LLM models work best for this agent)
  preferredModels: Array<{
    modelId: string;
    provider: string;
    usageCount: number;
    successRate: number;
    averageLatency: number;
    lastUsed?: Date;
  }>;
  
  // Knowledge Base Connections
  knowledgeBaseRefs: Array<{
    kbId: string;
    kbName: string;
    relevance: number; // 0-100
    lastAccessed?: Date;
  }>;
  
  metadata: {
    version: number;
    lastTrained?: Date;
    trainingData?: string; // Reference to training data
    notes?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const agentKnowledgeSchema = new Schema<IAgentKnowledge>(
  {
    agentRole: {
      type: String,
      required: true,
      trim: true
    },
    agentId: {
      type: String,
      index: true,
      sparse: true
    },
    knowledgeDomains: [{
      domain: { type: String, required: true },
      level: { type: Number, required: true, min: 0, max: 100 },
      confidence: { type: Number, default: 50, min: 0, max: 100 },
      lastUpdated: { type: Date, default: Date.now },
      examples: [String]
    }],
    skills: [{
      skill: { type: String, required: true },
      category: { type: String, required: true },
      proficiency: { type: Number, required: true, min: 0, max: 100 },
      confidence: { type: Number, default: 50, min: 0, max: 100 },
      experienceLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        required: true
      },
      lastUsed: Date,
      successRate: { type: Number, min: 0, max: 100 },
      tasksCompleted: { type: Number, default: 0 }
    }],
    specializations: [String],
    metrics: {
      totalTasksCompleted: { type: Number, default: 0 },
      averageTaskQuality: { type: Number, default: 0, min: 0, max: 100 },
      averageResponseTime: { type: Number, default: 0 },
      userSatisfactionRating: { type: Number, min: 0, max: 5 },
      lastActiveDate: Date
    },
    preferredModels: [{
      modelId: String,
      provider: String,
      usageCount: { type: Number, default: 0 },
      successRate: { type: Number, min: 0, max: 100 },
      averageLatency: Number,
      lastUsed: Date
    }],
    knowledgeBaseRefs: [{
      kbId: String,
      kbName: String,
      relevance: { type: Number, min: 0, max: 100 },
      lastAccessed: Date
    }],
    metadata: {
      version: { type: Number, default: 1 },
      lastTrained: Date,
      trainingData: String,
      notes: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes
// Note: agentRole is indexed via compound index below, agentId has index: true in schema
agentKnowledgeSchema.index({ 'metrics.lastActiveDate': -1 });
agentKnowledgeSchema.index({ agentRole: 1, 'metrics.totalTasksCompleted': -1 });

export const AgentKnowledge = mongoose.model<IAgentKnowledge>('AgentKnowledge', agentKnowledgeSchema);

