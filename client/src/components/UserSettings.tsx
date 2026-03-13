import React, { useState, useEffect } from 'react';
import { X, Shield, Lock, Info } from 'lucide-react';
import { UserProfile } from '@orbitai/shared';

interface UserSettingsProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSettings?: (settings: UserPrivacySettings) => void;
}

export interface UserPrivacySettings {
  privacyMode: boolean; // When true, no training data is used and no data sharing
}

const UserSettings: React.FC<UserSettingsProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateSettings
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load privacy settings from database
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>(() => {
    return {
      privacyMode: false // Default: privacy mode disabled (training and sharing enabled)
    };
  });

  // Load settings from database on mount
  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/privacy-settings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-id': user.id
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const settings = {
              privacyMode: data.data.privacyMode ?? false
            };
            setPrivacySettings(settings);
            // Cache in localStorage for quick access
            localStorage.setItem(`user_privacy_settings_cache_${user.id}`, JSON.stringify(settings));
          }
        }
      } catch (error) {
        console.error('Failed to load privacy settings:', error);
        // Keep default value on error
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen && user?.id) {
      loadPrivacySettings();
    }
  }, [isOpen, user?.id]);

  // Save settings to database whenever they change
  useEffect(() => {
    const savePrivacySettings = async () => {
      if (!user?.id || isLoading || !isOpen) return;
      
      setIsSaving(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/privacy-settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-user-id': user.id
          },
          body: JSON.stringify({
            privacyMode: privacySettings.privacyMode
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          // Cache in localStorage for quick access
          localStorage.setItem(`user_privacy_settings_cache_${user.id}`, JSON.stringify(privacySettings));
          if (data.success && onUpdateSettings) {
            onUpdateSettings(privacySettings);
          }
        } else {
          console.error('Failed to save privacy settings');
        }
      } catch (error) {
        console.error('Failed to save privacy settings:', error);
      } finally {
        setIsSaving(false);
      }
    };
    
    // Only save if not initial load
    if (!isLoading) {
      savePrivacySettings();
    }
  }, [privacySettings, user?.id, onUpdateSettings, isLoading, isOpen]);

  if (!isOpen) return null;

  const handlePrivacyModeToggle = () => {
    if (isLoading || isSaving) return;
    setPrivacySettings(prev => ({
      ...prev,
      privacyMode: !prev.privacyMode
    }));
  };


  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Privacy Settings</h2>
              <p className="text-white/80 text-sm">Control how your data is stored and utilized</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              You can adjust these preferences at any time. Changes take effect immediately and apply to all your projects.
            </p>
          </div>

          {/* Privacy Mode Section */}
          <div className="space-y-4">
            <div className="flex items-start justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-300 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Lock size={18} className="text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Privacy Mode</h3>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        privacySettings.privacyMode 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {privacySettings.privacyMode ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {privacySettings.privacyMode 
                        ? "Privacy mode is enabled. Your code will not be used for AI training or shared for platform improvements. Your code may still be stored for essential features like Cloud Agent, Team Rules, and collaboration tools."
                        : "Privacy mode is disabled. Your code may be used to improve AI models and platform features through training and anonymized data sharing."
                      }
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handlePrivacyModeToggle}
                disabled={isLoading || isSaving}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ml-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                  privacySettings.privacyMode ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                aria-label="Toggle privacy mode"
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                    privacySettings.privacyMode ? 'translate-x-6' : 'translate-x-1'
                  }`} 
                />
              </button>
            </div>
          </div>

          {/* Additional Info */}
          <div className="pt-4 border-t border-slate-200">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">How It Works</h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Privacy Mode Enabled:</strong> Your code is excluded from AI training datasets and anonymized data sharing. Code may still be stored for operational features like Cloud Agent, Team Rules, and collaboration tools.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span><strong>Privacy Mode Disabled (Default):</strong> Your code may be used for AI training to improve code generation and suggestions. Anonymized code patterns may be shared to help improve platform capabilities and user experience.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span>All data is handled in accordance with our privacy policy and security standards.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {isSaving && (
            <div className="mb-2 text-xs text-slate-500 text-center">
              Saving settings...
            </div>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;

