import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICommentReaction {
  user: Types.ObjectId;
  type: 'thumbs_up' | 'thumbs_down' | 'heart' | 'fire' | 'rocket' | 'eyes';
  createdAt: Date;
}

export interface IComment extends Document {
  workspace: Types.ObjectId;
  project: Types.ObjectId;
  resourceType: 'idea' | 'task' | 'artifact' | 'message' | 'document';
  resourceId: Types.ObjectId;
  parentComment?: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  mentions: Types.ObjectId[];
  reactions: ICommentReaction[];
  isResolved: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const commentReactionSchema = new Schema<ICommentReaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['thumbs_up', 'thumbs_down', 'heart', 'fire', 'rocket', 'eyes'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const commentSchema = new Schema<IComment>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    resourceType: {
      type: String,
      enum: ['idea', 'task', 'artifact', 'message', 'document'],
      required: true
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment'
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000
    },
    mentions: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    reactions: [commentReactionSchema],
    isResolved: {
      type: Boolean,
      default: false
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
commentSchema.index({ workspace: 1, project: 1 });
commentSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ mentions: 1 });

// Method to add reaction
commentSchema.methods.addReaction = function(
  userId: Types.ObjectId,
  type: ICommentReaction['type']
) {
  // Check if user already reacted with this type
  const existingReaction = this.reactions.find(
    (r: ICommentReaction) => r.user.equals(userId) && r.type === type
  );
  
  if (existingReaction) {
    throw new Error('User has already reacted with this type');
  }
  
  // Remove any existing reaction from this user
  this.reactions = this.reactions.filter(
    (r: ICommentReaction) => !r.user.equals(userId)
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    type,
    createdAt: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
commentSchema.methods.removeReaction = function(userId: Types.ObjectId) {
  this.reactions = this.reactions.filter(
    (r: ICommentReaction) => !r.user.equals(userId)
  );
  return this.save();
};

// Method to resolve comment
commentSchema.methods.resolve = function(userId: Types.ObjectId) {
  this.isResolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  return this.save();
};

// Method to unresolve comment
commentSchema.methods.unresolve = function() {
  this.isResolved = false;
  this.resolvedBy = undefined;
  this.resolvedAt = undefined;
  return this.save();
};

// Method to soft delete comment
commentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.content = '[deleted]';
  return this.save();
};

// Static method to get thread replies
commentSchema.statics.getThreadReplies = function(commentId: Types.ObjectId) {
  return this.find({ parentComment: commentId })
    .sort({ createdAt: 1 })
    .populate('author', 'name avatar');
};

// Static method to get resource comments with threads
commentSchema.statics.getResourceComments = function(
  resourceType: string,
  resourceId: Types.ObjectId
) {
  return this.find({
    resourceType,
    resourceId,
    parentComment: { $exists: false },
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .populate('author', 'name avatar')
    .populate('reactions.user', 'name avatar');
};

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
