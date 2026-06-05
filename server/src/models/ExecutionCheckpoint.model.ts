/**
 * Execution Checkpoint (state & resumability — dim 11 → 5).
 *
 * Stores the latest progress checkpoint for a run (keyed by taskId) so a resumed task can continue
 * from its last completed step rather than restarting. One upserted document per task.
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IExecutionCheckpoint extends Document {
  taskId: string;
  projectId?: string;
  step: number;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const executionCheckpointSchema = new Schema<IExecutionCheckpoint>(
  {
    taskId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, index: true },
    step: { type: Number, default: 0 },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'executioncheckpoints' }
);

export const ExecutionCheckpoint = mongoose.model<IExecutionCheckpoint>(
  'ExecutionCheckpoint',
  executionCheckpointSchema
);
