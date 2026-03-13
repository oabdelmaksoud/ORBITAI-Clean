import React, { useState } from 'react';
import { X, User, Mail, Calendar, Crown, Shield, LogOut, ArrowUpRight, Check, Settings, Layout } from 'lucide-react';
import { UserProfile, PlanTier } from '@orbitai/shared';
import UserSettings from './UserSettings';

interface UserProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onUpgrade: () => void;
  onLogout: () => void;
  isModernView: boolean;
  onToggleModernView: () => void;
  isAdminUser?: boolean;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  onClose,
  onUpgrade,
  onLogout,
  isModernView,
  onToggleModernView,
  isAdminUser = false
}) => {
  const [showUserSettings, setShowUserSettings] = useState(false);

  // Guard against undefined user
  if (!user) {
    return null;
  }

  const planColors: Record<PlanTier, { bg: string; text: string; border: string }> = {
    Starter: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
    Pro: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
    Enterprise: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' }
  };

  const planIcon: Record<PlanTier, React.ReactNode> = {
    Starter: <User size={16} />,
    Pro: <Crown size={16} />,
    Enterprise: <Shield size={16} />
  };

  const planFeatures: Record<PlanTier, string[]> = {
    Starter: ['Local storage only', 'Basic features', 'Community support'],
    Pro: ['Cloud sync', 'Advanced features', 'Priority support', 'Unlimited projects'],
    Enterprise: ['Everything in Pro', 'Custom integrations', 'Dedicated support', 'Team collaboration']
  };

  const memberSince = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : 'Unknown';

  const isActive = user.subscriptionStatus === 'active';
  const planColor = planColors[user.plan] || planColors.Starter;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-secondary p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full border-2 border-white/30 bg-white/20"
            />
            <div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-white/80 text-sm">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Plan Badge */}
          <div className={`${planColor.bg} ${planColor.border} border-2 rounded-xl p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <div className={`${planColor.text} p-2 rounded-lg bg-white`}>
                {planIcon[user.plan] || planIcon.Starter || <User size={16} />}
              </div>
              <div>
                <div className="font-bold text-slate-800">{user.plan} Plan</div>
                <div className="text-xs text-slate-600">
                  {isActive ? 'Active subscription' : 'Subscription ' + user.subscriptionStatus}
                </div>
              </div>
            </div>
            {user.plan !== 'Enterprise' && (
              <button
                onClick={onUpgrade}
                className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
              >
                Upgrade <ArrowUpRight size={12} />
              </button>
            )}
          </div>

          {/* Plan Features */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Plan Features</h3>
            <ul className="space-y-2">
              {(planFeatures[user.plan] || planFeatures.Starter || []).map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Info */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-slate-400" />
              <span className="text-slate-600">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-slate-600">Member since {memberSince}</span>
            </div>
            {user.role && (
              <div className="flex items-center gap-3 text-sm">
                <Shield size={16} className="text-slate-400" />
                <span className="text-slate-600 capitalize">{user.role}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            {/* Admin Console Button - Only for admin/superadmin users */}
            {(user.role === 'admin' || user.role === 'superadmin') && (
              <button
                onClick={() => {
                  window.location.hash = '#admin';
                  onClose();
                }}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Shield size={16} />
                Admin Console
              </button>
            )}
            <button
              onClick={() => setShowUserSettings(true)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Settings size={16} />
              Privacy Settings
            </button>
            <div className="flex gap-3">
              {user.plan !== 'Enterprise' && (
                <button
                  onClick={onUpgrade}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Crown size={16} />
                  Upgrade Plan
                </button>
              )}
              <button
                onClick={onLogout}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>

            {/* Modern View Toggle */}
            <button
              onClick={() => {
                onToggleModernView();
                onClose();
              }}
              className={`w-full px-4 py-2.5 border font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${isModernView
                ? 'bg-slate-800 text-white border-slate-900 hover:bg-slate-900 shadow-md shadow-purple-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
            >
              <Layout size={16} className={isModernView ? "text-purple-400" : "text-slate-400"} />
              {isModernView ? 'Disable Modern View' : 'Enable Modern View'}
            </button>
          </div>
        </div>
      </div>

      {/* User Settings Modal */}
      {showUserSettings && (
        <UserSettings
          user={user}
          isOpen={showUserSettings}
          onClose={() => setShowUserSettings(false)}
        />
      )}
    </div>
  );
};

export default UserProfileModal;

