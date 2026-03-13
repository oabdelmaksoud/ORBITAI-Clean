/**
 * Agent Execution Model
 * Tracks agent execution state for rollback
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IAgentExecution extends Document {
  projectId: string;
  taskId: string;
  agentId: string;
  agentRole: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  artifactsCreated: Array<{
    artifactId: string;
    snapshot: string; // Content snapshot before rollback
  }>;
  stateSnapshot: {
    artifacts: Array<{
      id: string;
      content: string;
      version: number;
    }>;
    timestamp: Date;
  };
  startedAt: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
  rollbackReason?: string;
}

const AgentExecutionSchema = new Schema<IAgentExecution>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    taskId: {
      type: String,
      required: true,
      index: true
    },
    agentId: {
      type: String,
      required: true,
      index: true
    },
    agentRole: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'rolled_back'],
      default: 'pending',
      index: true
    },
    artifactsCreated: [{
      artifactId: String,
      snapshot: String
    }],
    stateSnapshot: {
      artifacts: [{
        id: String,
        content: String,
        version: Number
      }],
      timestamp: Date
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    rolledBackAt: Date,
    rollbackReason: String
  },
  {
    timestamps: true
  }
);

// Indexes
AgentExecutionSchema.index({ projectId: 1, taskId: 1 });
AgentExecutionSchema.index({ projectId: 1, status: 1 });
AgentExecutionSchema.index({ agentId: 1, startedAt: -1 });

export const AgentExecution = mongoose.model<IAgentExecution>('AgentExecution', AgentExecutionSchema);



