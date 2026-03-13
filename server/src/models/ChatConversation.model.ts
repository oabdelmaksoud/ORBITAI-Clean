import mongoose, { Schema, Document } from 'mongoose';

export interface IChatConversation extends Document {
  userId?: string;
  projectId?: string;
  folderId?: string;
  type: 'setup' | 'workspace' | 'agent' | 'neural-chat';
  messages: Array<{
    id: string;
    sender: 'user' | 'system' | 'agent';
    text: string;
    timestamp: number;
  }>;
  answers?: Record<string, any>; // For guided chat wizard answers
  summary?: string; // Generated summary from wizard
  metadata?: {
    flowId?: string;
    currentQuestionId?: string;
    completed?: boolean;
    // NeuralStreamChat specific fields
    topic?: string;
    ideas?: Array<{
      id: string;
      label: string;
      description?: string;
      parentId?: string | null;
      relevance?: string;
      priority?: number;
      category?: 'feature' | 'constraint' | 'opportunity' | 'risk' | 'requirement' | 'improvement' | 'idea' | 'other' | 'ux' | 'technology' | 'data' | 'architecture' | 'component' | 'business' | 'community' | 'platform';
      notes?: string;
      connections?: string[];
      state?: 'new' | 'developing' | 'refined' | 'merged';
      tags?: string[];
      createdAt?: number;
      updatedAt?: number;
    }>;
    keyInsights?: string[];
    nextSteps?: string[];
    // Prototyping and UI state
    prototypingStage?: 'ideation' | 'prototyping';
    currentStage?: 'ideation' | 'prototyping' | 'launched'; // Current user stage/phase
    projectPreview?: {
      summary?: string;
      techStack?: string[];
      wireframeCode?: string;
      architectureDiagram?: string;
      risks?: string[];
      recommendedMethodology?: 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD';
      recommendedStandards?: string[];
      estimatedSprints?: number;
      projectName?: string;
      mobileCode?: {
        reactNative?: string;
        flutter?: string;
        iosSwift?: string;
        androidKotlin?: string;
      };
    };
    activeIdeaId?: string | null;
    glassPanelActiveView?: 'context' | 'history';
    // Voice conversation fields
    voiceSessionId?: string;
    isVoiceConversation?: boolean;
    voiceTranscripts?: Array<{
      userText: string;
      aiText: string;
      timestamp: number;
    }>;
    // Feature coverage tracking
    featureCoverage?: {
      totalFeatures: number;
      coveredFeatures: number;
      coveragePercentage: number;
      features: Array<{
        featureId: string;
        featureLabel: string;
        covered: boolean;
        confidence: number;
        matchedKeywords: string[];
      }>;
      generatedAt: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const chatConversationSchema = new Schema<IChatConversation>(
  {
    userId: {
      type: String,
      index: true,
      sparse: true
    },
    projectId: {
      type: String,
      index: true,
      sparse: true
    },
    folderId: {
      type: String,
      index: true,
      sparse: true
    },
    type: {
      type: String,
      enum: ['setup', 'workspace', 'agent', 'neural-chat'],
      required: true,
      index: true
    },
    messages: [{
      id: { type: String, required: true },
      sender: { type: String, enum: ['user', 'system', 'agent'], required: true },
      text: { type: String, required: true },
      timestamp: { type: Number, required: true }
    }],
    answers: {
      type: Schema.Types.Mixed,
      default: {}
    },
    summary: {
      type: String
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
chatConversationSchema.index({ userId: 1, type: 1 });
chatConversationSchema.index({ projectId: 1, type: 1 });
chatConversationSchema.index({ userId: 1, folderId: 1 });
chatConversationSchema.index({ createdAt: -1 });

export const ChatConversation = mongoose.model<IChatConversation>('ChatConversation', chatConversationSchema);




