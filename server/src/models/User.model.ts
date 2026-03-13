import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  role: 'user' | 'admin' | 'superadmin' | 'editor';
  isActive: boolean;
  lastLogin?: Date;
  oauthProvider?: 'google' | 'github' | 'discord' | 'local';
  oauthId?: string;
  privacyMode?: boolean; // Privacy mode setting (default: false)
  stripeCustomerId?: string; // Stripe customer ID
  stripeSubscriptionId?: string; // Stripe subscription ID
  subscriptionStatus?: 'active' | 'past_due' | 'canceled'; // Subscription status
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: function(this: any) {
        // Password is required only if the user is logging in locally
        return !this.oauthProvider || this.oauthProvider === 'local';
      },
      minlength: 6,
      select: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    avatar: {
      type: String,
      default: 'https://api.dicebear.com/9.x/avataaars/svg?seed=default'
    },
    plan: {
      type: String,
      enum: ['Free', 'Pro', 'Enterprise'],
      default: 'Free'
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin', 'editor'],
      default: 'user'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    oauthProvider: {
      type: String,
      enum: ['google', 'github', 'discord', 'local'],
      default: 'local'
    },
    oauthId: {
      type: String,
      sparse: true // Allows multiple null values but enforces uniqueness for non-nulls
    },
    privacyMode: {
      type: Boolean,
      default: false // Default: privacy mode OFF (training and sharing enabled)
    },
    stripeCustomerId: {
      type: String
    },
    stripeSubscriptionId: {
      type: String
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'past_due', 'canceled'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  
  const bcrypt = await import('bcryptjs');
  const bcryptDefault = bcrypt.default || bcrypt;
  this.password = await bcryptDefault.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  const bcrypt = await import('bcryptjs');
  const bcryptDefault = bcrypt.default || bcrypt;
  return await bcryptDefault.compare(candidatePassword, this.password);
};

// Performance indexes for common queries
// Note: email index is automatically created by unique: true in schema definition
userSchema.index({ role: 1 }); // Users by role
userSchema.index({ plan: 1 }); // Users by plan
userSchema.index({ lastLogin: -1 }); // Recent logins
userSchema.index({ oauthProvider: 1, oauthId: 1 }); // Faster OAuth lookups

export const User = mongoose.model<IUser>('User', userSchema);

