import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  userId: string;
  name: string;
  description: string;
  currentPhase: string;
  currentSprint: number;
  methodology: string;
  estimatedSprints?: number; // Estimated total sprints based on project analysis
  agents: any[];
  tasks: any[];
  artifacts: any[];
  logs: any[];
  selectedStandards: string[];
  useInternet: boolean;
  // Project scope to prevent overengineering
  projectScope: 'mvp' | 'simple' | 'standard' | 'full';
  scopeAutoDetected: boolean; // True if AI detected scope, false if user overrode
  scopeDetectionReasoning?: string; // Why AI chose this scope
  budget: {
    cap: number;
    spent: number;
  };
  mcpServers: any[];
  wizardMetadata?: any; // Frontend wizard state and data
  brainstormingContext?: any; // AI brainstorming context (ideas, style, audience)
  lastModified: Date;
  createdAt: Date;
  status?: 'draft' | 'in-progress' | 'completed' | 'deployed'; // Project completion status
  completedAt?: Date; // When project was completed
  isSample?: boolean; // Mark project as sample for non-logged-in users
  shareTokens?: Array<{
    token: string;
    createdAt: Date;
    expiresAt?: Date;
    accessCount: number;
  }>;
  architecture?: {
    needsBackend: boolean;
    needsAdminPanel: boolean;
    needsMobileApp: boolean; // New: Mobile app needed
    backendType?: 'REST' | 'GraphQL' | 'gRPC' | 'Microservices' | 'Serverless';
    adminPanelType?: 'Web Dashboard' | 'Mobile App' | 'Desktop App' | 'CLI Tool';
    mobileAppType?: 'react-native' | 'flutter' | 'native-ios' | 'native-android'; // New: Recommended mobile framework
    reasoning?: string;
    confidence?: number;
    detectedFeatures?: {
      dataStorage: boolean;
      userManagement: boolean;
      authentication: boolean;
      apiEndpoints: boolean;
      realTimeFeatures: boolean;
      fileUploads: boolean;
      reporting: boolean;
      analytics: boolean;
      contentManagement: boolean;
      ecommerce: boolean;
      multiTenancy: boolean;
      mobileAccess: boolean; // New
      offlineSupport: boolean; // New
      pushNotifications: boolean; // New
    };
    recommendations?: {
      backend?: {
        framework?: string;
        database?: string;
        authentication?: string;
        deployment?: string;
      };
      adminPanel?: {
        framework?: string;
        features?: string[];
      };
      mobileApp?: { // New
        framework?: 'react-native' | 'flutter' | 'native-ios' | 'native-android';
        platform?: 'ios' | 'android' | 'both';
        reasoning?: string;
      };
    };
  };
}

const projectSchema = new Schema<IProject>(
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
    currentPhase: {
      type: String,
      default: 'Initiation'
    },
    currentSprint: {
      type: Number,
      default: 1
    },
    methodology: {
      type: String,
      enum: ['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Iterative', 'Prototyping', 'RAD', 'Scrum', 'Lean', 'ASD'],
      default: 'V-Model'
    },
    estimatedSprints: {
      type: Number,
      default: null
    },
    agents: {
      type: Array,
      default: []
    } as any,
    tasks: {
      type: Array,
      default: []
    } as any,
    artifacts: {
      type: Array,
      default: []
    } as any,
    logs: {
      type: Array,
      default: []
    } as any,
    selectedStandards: {
      type: [String],
      default: []
    },
    useInternet: {
      type: Boolean,
      default: false
    },
    // Project scope to prevent overengineering
    projectScope: {
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
    budget: {
      cap: { type: Number, default: 1000 },
      spent: { type: Number, default: 0 }
    },
    mcpServers: {
      type: Array,
      default: []
    } as any,
    wizardMetadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    brainstormingContext: {
      type: Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['draft', 'in-progress', 'completed', 'deployed'],
      default: 'draft'
    },
    completedAt: {
      type: Date
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    isSample: {
      type: Boolean,
      default: false
      // Index created explicitly below to avoid duplicate
    },
    shareTokens: [{
      token: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date },
      accessCount: { type: Number, default: 0 }
    }],
    architecture: {
      needsBackend: { type: Boolean, default: false },
      needsAdminPanel: { type: Boolean, default: false },
      needsMobileApp: { type: Boolean, default: false }, // New
      backendType: {
        type: String,
        enum: ['REST', 'GraphQL', 'gRPC', 'Microservices', 'Serverless'],
        default: 'REST'
      },
      adminPanelType: {
        type: String,
        enum: ['Web Dashboard', 'Mobile App', 'Desktop App', 'CLI Tool'],
        default: 'Web Dashboard'
      },
      mobileAppType: { // New
        type: String,
        enum: ['react-native', 'flutter', 'native-ios', 'native-android'],
        default: 'react-native'
      },
      reasoning: { type: String },
      confidence: { type: Number, min: 0, max: 1 },
      detectedFeatures: {
        dataStorage: { type: Boolean, default: false },
        userManagement: { type: Boolean, default: false },
        authentication: { type: Boolean, default: false },
        apiEndpoints: { type: Boolean, default: false },
        realTimeFeatures: { type: Boolean, default: false },
        fileUploads: { type: Boolean, default: false },
        reporting: { type: Boolean, default: false },
        analytics: { type: Boolean, default: false },
        contentManagement: { type: Boolean, default: false },
        ecommerce: { type: Boolean, default: false },
        multiTenancy: { type: Boolean, default: false },
        mobileAccess: { type: Boolean, default: false }, // New
        offlineSupport: { type: Boolean, default: false }, // New
        pushNotifications: { type: Boolean, default: false } // New
      },
      recommendations: {
        backend: {
          framework: { type: String },
          database: { type: String },
          authentication: { type: String },
          deployment: { type: String }
        },
        adminPanel: {
          framework: { type: String },
          features: [{ type: String }]
        },
        mobileApp: { // New
          framework: {
            type: String,
            enum: ['react-native', 'flutter', 'native-ios', 'native-android']
          },
          platform: {
            type: String,
            enum: ['ios', 'android', 'both']
          },
          reasoning: { type: String }
        }
      }
    }
  },
  {
    timestamps: true,
    autoIndex: false // Prevent automatic index creation to correct persistent E11000 errors
  }
);

// Performance indexes for common queries
projectSchema.index({ userId: 1, createdAt: -1 }); // User projects sorted by last modified
projectSchema.index({ userId: 1, lastModified: -1 }); // User projects sorted by last modified
projectSchema.index({ userId: 1, name: 1 }); // User projects by name
projectSchema.index({ currentPhase: 1 }); // Projects by phase
projectSchema.index({ isSample: 1 }); // Sample projects lookup
projectSchema.index({ createdAt: -1 }); // Recent projects

export const Project = mongoose.model<IProject>('Project', projectSchema);

