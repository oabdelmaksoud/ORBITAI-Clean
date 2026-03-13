import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflow extends Document {
  id: string;
  name: string;
  description: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  
  // BPMN Definition (simplified JSON representation)
  bpmnDefinition: {
    processId: string;
    processName: string;
    nodes: Array<{
      id: string;
      type: 'start' | 'task' | 'gateway' | 'end';
      name: string;
      position: { x: number; y: number };
      properties?: Record<string, any>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      condition?: string;
    }>;
  };
  
  // Execution configuration
  execution: {
    enabled: boolean;
    autoStart: boolean;
    maxConcurrent: number;
    timeout?: number;
  };
  
  // Agent assignments
  agentAssignments: Array<{
    nodeId: string;
    agentRole: string;
    conditions?: Record<string, any>;
  }>;
  
  // Variables and context
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    defaultValue?: any;
    required: boolean;
  }>;
  
  // Statistics
  statistics: {
    timesExecuted: number;
    averageDuration: number;
    successRate: number;
    lastExecuted?: Date;
  };
  
  // Metadata
  tags: string[];
  category: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const workflowSchema = new Schema<IWorkflow>(
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
      required: true
    },
    version: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true
    },
    bpmnDefinition: {
      processId: { type: String, required: true },
      processName: { type: String, required: true },
      nodes: [{
        id: String,
        type: { type: String, enum: ['start', 'task', 'gateway', 'end'], required: true },
        name: String,
        position: {
          x: Number,
          y: Number
        },
        properties: Schema.Types.Mixed
      }],
      edges: [{
        id: String,
        source: String,
        target: String,
        condition: String
      }]
    },
    execution: {
      enabled: { type: Boolean, default: false },
      autoStart: { type: Boolean, default: false },
      maxConcurrent: { type: Number, default: 1 },
      timeout: Number
    },
    agentAssignments: [{
      nodeId: String,
      agentRole: String,
      conditions: Schema.Types.Mixed
    }],
    variables: [{
      name: String,
      type: { type: String, enum: ['string', 'number', 'boolean', 'object'] },
      defaultValue: Schema.Types.Mixed,
      required: { type: Boolean, default: false }
    }],
    statistics: {
      timesExecuted: { type: Number, default: 0 },
      averageDuration: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 },
      lastExecuted: Date
    },
    tags: [String],
    category: {
      type: String,
      default: 'general'
    },
    createdBy: {
      type: String,
      required: true
    },
    updatedBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

workflowSchema.index({ name: 'text', description: 'text', tags: 'text' });
workflowSchema.index({ status: 1, category: 1 });
workflowSchema.index({ 'statistics.timesExecuted': -1 });

export const Workflow = mongoose.model<IWorkflow>('Workflow', workflowSchema);
















