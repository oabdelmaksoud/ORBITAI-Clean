/**
 * System Configuration Model
 * Stores system-wide configuration and state that needs to persist across restarts
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemConfig extends Document {
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
  createdAt: Date;
}

const systemConfigSchema = new Schema<ISystemConfig>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    value: {
      type: Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

export const SystemConfig = mongoose.model<ISystemConfig>('SystemConfig', systemConfigSchema);

// Helper functions for common config operations
export const systemConfigHelpers = {
  async get(key: string): Promise<any> {
    const config = await SystemConfig.findOne({ key }).lean();
    return config?.value ?? null;
  },

  async set(key: string, value: any, description?: string): Promise<void> {
    await SystemConfig.findOneAndUpdate(
      { key },
      { key, value, description },
      { upsert: true, new: true }
    );
  },

  async delete(key: string): Promise<boolean> {
    const result = await SystemConfig.deleteOne({ key });
    return result.deletedCount > 0;
  }
};

