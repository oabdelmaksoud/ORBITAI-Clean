/**
 * Agent Message Model
 * Tracks agent-to-agent communication
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IAgentMessage extends Document {
  projectId: string;
  fromAgentId: string;
  fromAgentRole: string;
  toAgentId?: string; // undefined for broadcast
  toAgentRole?: string;
  messageType: 'status_update' | 'dependency_notification' | 'result_sharing' | 'error_propagation' | 'request' | 'response';
  content: string;
  metadata?: {
    taskId?: string;
    artifactId?: string;
    status?: string;
    error?: string;
  };
  timestamp: Date;
  read: boolean;
  readAt?: Date;
}

const AgentMessageSchema = new Schema<IAgentMessage>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    fromAgentId: {
      type: String,
      required: true,
      index: true
    },
    fromAgentRole: {
      type: String,
      required: true
    },
    toAgentId: {
      type: String,
      index: true
    },
    toAgentRole: String,
    messageType: {
      type: String,
      required: true,
      enum: ['status_update', 'dependency_notification', 'result_sharing', 'error_propagation', 'request', 'response'],
      index: true
    },
    content: {
      type: String,
      required: true
    },
    metadata: {
      taskId: String,
      artifactId: String,
      status: String,
      error: String
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: Date
  },
  {
    timestamps: true
  }
);

// Indexes
AgentMessageSchema.index({ projectId: 1, timestamp: -1 });
AgentMessageSchema.index({ toAgentId: 1, read: 1 });
AgentMessageSchema.index({ fromAgentId: 1, messageType: 1 });

export const AgentMessage = mongoose.model<IAgentMessage>('AgentMessage', AgentMessageSchema);



