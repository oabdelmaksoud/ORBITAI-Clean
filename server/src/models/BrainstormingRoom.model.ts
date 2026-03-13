import mongoose, { Schema, Document } from 'mongoose';

export interface IBrainstormingRoom extends Document {
  id: string;
  name: string;
  description?: string;
  topic?: string; // Main brainstorming topic/question

  // Project scope to prevent overengineering
  scope: 'mvp' | 'simple' | 'standard' | 'full';
  scopeAutoDetected: boolean;
  scopeDetectionReasoning?: string;

  // Room ownership and access
  createdBy: string; // userId
  ownerName?: string;

  // Participants
  participants: Array<{
    userId: string;
    userName: string;
    role: 'facilitator' | 'contributor' | 'observer';
    joinedAt: Date;
    lastSeen?: Date;
  }>;

  // Active attendees (real-time)
  activeAttendees: Array<{
    userId: string;
    userName: string;
    socketId?: string;
    cursorPosition?: { ideaId?: string; x?: number; y?: number };
    lastSeen: Date;
  }>;

  // Attendee limits (from subscription plan)
  maxAttendees?: number; // null = unlimited

  // Linked conversation/session
  conversationId?: string; // Links to ChatConversation for neural-chat

  // Ideas and brainstorming data
  ideas?: Array<{
    id: string;
    label: string;
    description?: string;
    parentId?: string | null;
    priority?: number;
    category?: 'feature' | 'constraint' | 'opportunity' | 'risk' | 'requirement' | 'improvement' | 'idea' | 'other' | 'ux' | 'technology' | 'data' | 'architecture' | 'component' | 'business' | 'community' | 'platform';
    notes?: string;
    connections?: string[];
    state?: 'new' | 'developing' | 'refined' | 'merged';
    tags?: string[];
    createdAt?: number;
    updatedAt?: number;
    createdBy?: string; // userId who created this idea
    votes?: Array<{ userId: string; value: number }>; // Voting/prioritization
  }>;

  // How Might We questions
  hmwQuestions?: Array<{
    id: string;
    question: string;
    description?: string;
    createdBy: string;
    createdAt: Date;
    linkedIdeas?: string[]; // Idea IDs linked to this question
  }>;

  // Session metadata
  sessionTemplate?: 'brainstorm' | 'design-sprint' | 'mindmap' | 'custom';
  facilitatorTools?: {
    timerActive?: boolean;
    timerDuration?: number; // seconds
    timerStartedAt?: Date;
    votingEnabled?: boolean;
    maxVotesPerUser?: number;
  };

  // Version history
  versions: Array<{
    version: number;
    snapshot: {
      topic?: string;
      ideas?: any[];
      hmwQuestions?: any[];
    };
    changedBy: string;
    changeDate: Date;
    changeSummary?: string;
  }>;
  currentVersion: number;

  // Converted to project
  convertedToProject?: string; // Project ID if converted
  convertedAt?: Date;

  // Sub-projects within room
  subProjects?: Array<{
    id: string;
    name: string; // e.g., "Mobile App", "Web App", "Website"
    type: 'webapp' | 'mobile-app' | 'website' | 'api' | 'desktop-app' | 'other';
    status: 'ideation' | 'brainstorming' | 'prototyping' | 'production';
    currentPhase: 0 | 1 | 2 | 3 | 4;
    projectId?: string; // If converted to workspace project
    ideas?: string[]; // Idea IDs linked to this sub-project
    createdAt: Date;
    updatedAt: Date;
  }>;

  // Track active sub-project
  activeSubProjectId?: string;

  // Current phase of the room (0-4)
  currentPhase?: 0 | 1 | 2 | 3 | 4;

  // Status
  status: 'active' | 'archived' | 'converted';

  // Statistics
  statistics: {
    totalIdeas: number;
    totalParticipants: number;
    totalDuration?: number; // minutes
    lastActivity?: Date;
  };

  // Agent activity tracking
  agentActivity?: {
    lastGeneration?: Date;
    frameworksUsed?: string[];
    ideasGenerated?: number;
    lastEvaluation?: Date;
    lastClustering?: Date;
    lastHMWGeneration?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

const brainstormingRoomSchema = new Schema<IBrainstormingRoom>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    topic: {
      type: String,
      trim: true,
      index: 'text'
    },
    // Project scope to prevent overengineering
    scope: {
      type: String,
      enum: ['mvp', 'simple', 'standard', 'full'],
      default: 'standard'
    },
    scopeAutoDetected: {
      type: Boolean,
      default: true
    },
    scopeDetectionReasoning: {
      type: String
    },
    createdBy: {
      type: String,
      required: true,
      index: true
    },
    ownerName: {
      type: String
    },
    participants: [{
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      role: {
        type: String,
        enum: ['facilitator', 'contributor', 'observer'],
        default: 'contributor'
      },
      joinedAt: { type: Date, default: Date.now },
      lastSeen: Date
    }],
    activeAttendees: [{
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      socketId: String,
      cursorPosition: {
        ideaId: String,
        x: Number,
        y: Number
      },
      lastSeen: { type: Date, default: Date.now }
    }],
    maxAttendees: {
      type: Number,
      default: null // null = unlimited
    },
    conversationId: {
      type: String,
      index: true,
      sparse: true
    },
    ideas: [{
      id: { type: String, required: true },
      label: { type: String, required: true },
      description: String,
      parentId: { type: String, default: null },
      priority: { type: Number, min: 1, max: 5 },
      category: {
        type: String,
        enum: ['feature', 'constraint', 'opportunity', 'risk', 'requirement', 'improvement', 'idea', 'other', 'ux', 'technology', 'data', 'architecture', 'component', 'business', 'community', 'platform'],
        default: 'idea'
      },
      notes: String,
      connections: [String],
      state: {
        type: String,
        enum: ['new', 'developing', 'refined', 'merged'],
        default: 'new'
      },
      tags: [String],
      createdAt: Number,
      updatedAt: Number,
      createdBy: String,
      votes: [{
        userId: String,
        value: { type: Number, min: 1, max: 5 }
      }]
    }],
    hmwQuestions: [{
      id: { type: String, required: true },
      question: { type: String, required: true },
      description: String,
      createdBy: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      linkedIdeas: [String]
    }],
    sessionTemplate: {
      type: String,
      enum: ['brainstorm', 'design-sprint', 'mindmap', 'custom'],
      default: 'brainstorm'
    },
    facilitatorTools: {
      timerActive: { type: Boolean, default: false },
      timerDuration: Number,
      timerStartedAt: Date,
      votingEnabled: { type: Boolean, default: false },
      maxVotesPerUser: { type: Number, default: 5 }
    },
    versions: [{
      version: { type: Number, required: true },
      snapshot: {
        topic: String,
        ideas: [Schema.Types.Mixed],
        hmwQuestions: [Schema.Types.Mixed]
      },
      changedBy: { type: String, required: true },
      changeDate: { type: Date, default: Date.now },
      changeSummary: String
    }],
    currentVersion: {
      type: Number,
      default: 1
    },
    convertedToProject: {
      type: String,
      index: true,
      sparse: true
    },
    convertedAt: Date,
    subProjects: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ['webapp', 'mobile-app', 'website', 'api', 'desktop-app', 'other'],
        default: 'other'
      },
      status: {
        type: String,
        enum: ['ideation', 'brainstorming', 'prototyping', 'production'],
        default: 'ideation'
      },
      currentPhase: { type: Number, min: 0, max: 4, default: 0 },
      projectId: { type: String },
      ideas: [{ type: String }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    activeSubProjectId: { type: String },
    currentPhase: { type: Number, min: 0, max: 4, default: 0 },
    status: {
      type: String,
      enum: ['active', 'archived', 'converted'],
      default: 'active',
      index: true
    },
    statistics: {
      totalIdeas: { type: Number, default: 0 },
      totalParticipants: { type: Number, default: 0 },
      totalDuration: Number,
      lastActivity: Date
    },
    agentActivity: {
      lastGeneration: Date,
      frameworksUsed: [String],
      ideasGenerated: { type: Number, default: 0 },
      lastEvaluation: Date,
      lastClustering: Date,
      lastHMWGeneration: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
brainstormingRoomSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
brainstormingRoomSchema.index({ 'participants.userId': 1, status: 1 });
brainstormingRoomSchema.index({ topic: 'text', name: 'text', description: 'text' });
brainstormingRoomSchema.index({ conversationId: 1 });
brainstormingRoomSchema.index({ status: 1, createdAt: -1 });

export const BrainstormingRoom = mongoose.model<IBrainstormingRoom>('BrainstormingRoom', brainstormingRoomSchema);
