import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface IWorkspaceInvite extends Document {
  workspace: Types.ObjectId;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  inviter: Types.ObjectId;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceInviteSchema = new Schema<IWorkspaceInvite>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'],
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    inviter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'revoked'],
      default: 'pending'
    },
    expiresAt: {
      type: Date,
      required: true
    },
    acceptedAt: {
      type: Date
    },
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
workspaceInviteSchema.index({ workspace: 1, email: 1 });
workspaceInviteSchema.index({ token: 1 }, { unique: true });
workspaceInviteSchema.index({ status: 1, expiresAt: 1 });

// Generate token before saving
workspaceInviteSchema.pre('save', function(next) {
  if (this.isNew && !this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Method to check if invite is valid
workspaceInviteSchema.methods.isValid = function(): boolean {
  return this.status === 'pending' && new Date() < this.expiresAt;
};

// Method to accept invite
workspaceInviteSchema.methods.accept = function(userId: Types.ObjectId) {
  if (!this.isValid()) {
    throw new Error('This invitation is no longer valid');
  }
  
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  
  return this.save();
};

// Method to decline invite
workspaceInviteSchema.methods.decline = function() {
  if (this.status !== 'pending') {
    throw new Error('This invitation has already been processed');
  }
  
  this.status = 'declined';
  return this.save();
};

// Method to revoke invite
workspaceInviteSchema.methods.revoke = function() {
  if (this.status !== 'pending') {
    throw new Error('This invitation has already been processed');
  }
  
  this.status = 'revoked';
  return this.save();
};

// Static method to generate expiration date (7 days from now)
workspaceInviteSchema.statics.generateExpirationDate = function(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
};

// Static method to cleanup expired invites
workspaceInviteSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
};

export const WorkspaceInvite = mongoose.model<IWorkspaceInvite>('WorkspaceInvite', workspaceInviteSchema);
