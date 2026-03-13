import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWorkspaceMember {
  user: Types.ObjectId;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
  invitedBy: Types.ObjectId;
  permissions: IPermission[];
}

export interface IPermission {
  resource: 'project' | 'artifact' | 'agent' | 'settings' | 'billing';
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface IWorkspaceSettings {
  allowMemberInvite: boolean;
  requireApproval: boolean;
  defaultRole: 'member' | 'viewer';
  maxMembers: number;
  features: {
    aiGeneration: boolean;
    codeExecution: boolean;
    integrations: boolean;
  };
}

export interface IWorkspaceBilling {
  plan: 'free' | 'team' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  seats: number;
  periodEnd?: Date;
  status: 'active' | 'past_due' | 'canceled';
}

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  description?: string;
  owner: Types.ObjectId;
  members: IWorkspaceMember[];
  projects: Types.ObjectId[];
  settings: IWorkspaceSettings;
  billing: IWorkspaceBilling;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    resource: {
      type: String,
      enum: ['project', 'artifact', 'agent', 'settings', 'billing'],
      required: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete']
    }]
  },
  { _id: false }
);

const workspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permissions: [permissionSchema]
  },
  { _id: false }
);

const workspaceSettingsSchema = new Schema<IWorkspaceSettings>(
  {
    allowMemberInvite: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    defaultRole: {
      type: String,
      enum: ['member', 'viewer'],
      default: 'member'
    },
    maxMembers: {
      type: Number,
      default: 10
    },
    features: {
      aiGeneration: { type: Boolean, default: true },
      codeExecution: { type: Boolean, default: true },
      integrations: { type: Boolean, default: false }
    }
  },
  { _id: false }
);

const workspaceBillingSchema = new Schema<IWorkspaceBilling>(
  {
    plan: {
      type: String,
      enum: ['free', 'team', 'enterprise'],
      default: 'free'
    },
    stripeCustomerId: {
      type: String
    },
    stripeSubscriptionId: {
      type: String
    },
    seats: {
      type: Number,
      default: 1
    },
    periodEnd: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled'],
      default: 'active'
    }
  },
  { _id: false }
);

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [workspaceMemberSchema],
    projects: [{
      type: Schema.Types.ObjectId,
      ref: 'Project'
    }],
    settings: {
      type: workspaceSettingsSchema,
      default: () => ({})
    },
    billing: {
      type: workspaceBillingSchema,
      default: () => ({})
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ 'members.user': 1 });
workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ createdAt: -1 });

// Generate slug from name before saving
workspaceSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Method to add member
workspaceSchema.methods.addMember = function(
  userId: Types.ObjectId,
  role: 'admin' | 'member' | 'viewer',
  invitedBy: Types.ObjectId
) {
  const existingMember = this.members.find((m: IWorkspaceMember) => m.user.equals(userId));
  if (existingMember) {
    throw new Error('User is already a member of this workspace');
  }
  
  this.members.push({
    user: userId,
    role,
    joinedAt: new Date(),
    invitedBy,
    permissions: []
  });
  
  return this.save();
};

// Method to remove member
workspaceSchema.methods.removeMember = function(userId: Types.ObjectId) {
  const memberIndex = this.members.findIndex((m: IWorkspaceMember) => m.user.equals(userId));
  if (memberIndex === -1) {
    throw new Error('User is not a member of this workspace');
  }
  
  this.members.splice(memberIndex, 1);
  return this.save();
};

// Method to update member role
workspaceSchema.methods.updateMemberRole = function(
  userId: Types.ObjectId,
  newRole: 'admin' | 'member' | 'viewer'
) {
  const member = this.members.find((m: IWorkspaceMember) => m.user.equals(userId));
  if (!member) {
    throw new Error('User is not a member of this workspace');
  }
  
  member.role = newRole;
  return this.save();
};

// Method to check if user has access
workspaceSchema.methods.hasMember = function(userId: Types.ObjectId): boolean {
  return this.members.some((m: IWorkspaceMember) => m.user.equals(userId)) || 
         this.owner.equals(userId);
};

// Method to get user role
workspaceSchema.methods.getMemberRole = function(userId: Types.ObjectId): string | null {
  if (this.owner.equals(userId)) return 'owner';
  const member = this.members.find((m: IWorkspaceMember) => m.user.equals(userId));
  return member ? member.role : null;
};

export const Workspace = mongoose.model<IWorkspace>('Workspace', workspaceSchema);
