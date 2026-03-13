
import React, { useState, useEffect } from 'react';
import { PlanTier, UserProfile } from '@orbitai/shared';
import { Check, X, Shield, Zap, Layout, CreditCard, Loader2, Star, Lock } from 'lucide-react';
import { getPublicPackages, PublicPackage } from '../services/publicPackagesApi';
import { getAuthToken } from '@src/services/api';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface SubscriptionOverlayProps {
  onLogin: (user: UserProfile) => void;
  onClose: () => void;
  initialMode?: 'login' | 'pricing';
  currentPlan?: PlanTier;
}

// Icon mapping for packages
const iconMap: Record<string, any> = {
  'Layout': Layout,
  'Zap': Zap,
  'Shield': Shield,
  'starter': Layout,
  'pro': Zap,
  'enterprise': Shield
};

const SubscriptionOverlay: React.FC<SubscriptionOverlayProps> = ({ onLogin, onClose, initialMode = 'pricing', currentPlan }) => {
  const [mode, setMode] = useState<'login' | 'pricing' | 'payment'>(initialMode || 'pricing');
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  
  // Login State
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password');

  // Default packages fallback
  const defaultPackages: PublicPackage[] = [
    {
      id: 'starter',
      displayName: 'Starter',
      description: 'Perfect for getting started with AI-powered development',
      price: 0,
      billingCycle: 'monthly',
      features: [
        { key: 'maxProjects', label: 'Projects', value: 3, type: 'number' },
        { key: 'maxAgents', label: 'AI Agents', value: 5, type: 'number' },
        { key: 'maxTasks', label: 'Tasks per Project', value: 50, type: 'number' },
        { key: 'maxStorageGB', label: 'Storage', value: 5, type: 'number' },
        { key: 'internetAccessEnabled', label: 'Internet Access', value: true, type: 'boolean' }
      ],
      limits: {
        maxProjects: 3,
        maxAgents: 5,
        maxTasks: 50,
        maxStorageGB: 5,
        maxAPICalls: 1000,
        internetAccessEnabled: true,
        codeExecutionEnabled: false,
        cloudDeploymentEnabled: false
      },
      isDefault: true,
      metadata: { icon: 'Layout', highlight: false }
    },
    {
      id: 'pro',
      displayName: 'Pro',
      description: 'For professional developers and teams',
      price: 29,
      billingCycle: 'monthly',
      features: [
        { key: 'maxProjects', label: 'Projects', value: 20, type: 'number' },
        { key: 'maxAgents', label: 'AI Agents', value: 15, type: 'number' },
        { key: 'maxTasks', label: 'Tasks per Project', value: 200, type: 'number' },
        { key: 'maxStorageGB', label: 'Storage', value: 50, type: 'number' },
        { key: 'internetAccessEnabled', label: 'Internet Access', value: true, type: 'boolean' },
        { key: 'codeExecutionEnabled', label: 'Code Execution', value: true, type: 'boolean' }
      ],
      limits: {
        maxProjects: 20,
        maxAgents: 15,
        maxTasks: 200,
        maxStorageGB: 50,
        maxAPICalls: 10000,
        internetAccessEnabled: true,
        codeExecutionEnabled: true,
        cloudDeploymentEnabled: false
      },
      isDefault: false,
      metadata: { icon: 'Zap', highlight: true }
    },
    {
      id: 'enterprise',
      displayName: 'Enterprise',
      description: 'For large organizations with advanced needs',
      price: 99,
      billingCycle: 'monthly',
      features: [
        { key: 'maxProjects', label: 'Projects', value: -1, type: 'number' },
        { key: 'maxAgents', label: 'AI Agents', value: -1, type: 'number' },
        { key: 'maxTasks', label: 'Tasks per Project', value: -1, type: 'number' },
        { key: 'maxStorageGB', label: 'Storage', value: 500, type: 'number' },
        { key: 'internetAccessEnabled', label: 'Internet Access', value: true, type: 'boolean' },
        { key: 'codeExecutionEnabled', label: 'Code Execution', value: true, type: 'boolean' },
        { key: 'cloudDeploymentEnabled', label: 'Cloud Deployment', value: true, type: 'boolean' }
      ],
      limits: {
        maxProjects: -1,
        maxAgents: -1,
        maxTasks: -1,
        maxStorageGB: 500,
        maxAPICalls: -1,
        maxTeamMembers: 50,
        internetAccessEnabled: true,
        codeExecutionEnabled: true,
        cloudDeploymentEnabled: true
      },
      isDefault: false,
      metadata: { icon: 'Shield', highlight: false }
    }
  ];

  useEffect(() => {
    // Fetch packages from backend
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        const fetchedPackages = await getPublicPackages();
        // Use fetched packages if available, otherwise fall back to defaults
        if (fetchedPackages && fetchedPackages.length > 0) {
          setPackages(fetchedPackages);
        } else {
          console.warn('No packages fetched from API, using default packages');
          setPackages(defaultPackages);
        }
      } catch (error) {
        console.error('Failed to fetch packages from API, using defaults:', error);
        // Use default packages on error
        setPackages(defaultPackages);
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      setTimeout(() => {
          // Simulate successful login
          // If the user selected a plan in the flow, use it. Otherwise fall back to currentPlan or Starter.
          const effectivePlan = selectedPlan || currentPlan || 'Starter';
          
          const mockUser: UserProfile = {
              id: 'u_' + Math.random().toString(36).substring(7),
              name: email.split('@')[0],
              email: email,
              avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${email}`,
              plan: effectivePlan,
              subscriptionStatus: 'active',
              memberSince: Date.now(),
              role: 'user' // Default to 'user' role for new signups
          };
          onLogin(mockUser);
          setIsProcessing(false);
          // If launched as pricing or payment, close overlay upon success
          if (initialMode === 'login' || mode === 'payment' || mode === 'login') onClose();
      }, 1000);
  };

  const handleSelectPlan = (planId: string) => {
      // Map package name/displayName to PlanTier
      const planMap: Record<string, PlanTier> = {
          'starter': 'Starter',
          'Starter': 'Starter',
          'pro': 'Pro',
          'Pro': 'Pro',
          'enterprise': 'Enterprise',
          'Enterprise': 'Enterprise'
      };
      
      const planTier = planMap[planId] || planId as PlanTier;
      
      if (currentPlan && planTier === currentPlan) {
          showAlert("You are already on this plan.");
          return; 
      }
      
      setSelectedPlan(planTier);
      
      if (planTier === 'Starter') {
          // If user is not logged in (no currentPlan), treat this as "Sign Up for Free"
          if (!currentPlan) {
              setMode('login'); // Go to account creation
          } else {
              // Downgrading (Simulated)
              showAlert("Downgraded to Starter Plan.", 'success');
              onClose();
          }
      } else {
          // Paid plans go to payment
          setMode('payment');
      }
  };

  const handlePayment = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);

      try {
          // Get the selected package ID
          const selectedPackage = packages.find(
              p => p.displayName === selectedPlan || p.id.toLowerCase() === selectedPlan?.toLowerCase()
          );

          if (!selectedPackage || !selectedPackage.id) {
              showAlert('Please select a plan', 'error');
              setIsProcessing(false);
              return;
          }

          // Get auth token
          const token = getAuthToken();
          if (!token) {
              showAlert('Please log in first', 'error');
              setMode('login');
              setIsProcessing(false);
              return;
          }

          // Create Stripe checkout session
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
          const response = await fetch(`${API_BASE_URL}/api/payment/create-checkout-session`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  packageId: selectedPackage.id
              })
          });

          if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Failed to create checkout session');
          }

          const data = await response.json();
          
          if (data.success && data.url) {
              // Redirect to Stripe checkout
              window.location.href = data.url;
          } else {
              throw new Error('No checkout URL received');
          }
      } catch (error: any) {
          console.error('Payment error:', error);
          showAlert(error.message || 'Failed to process payment. Please try again.', 'error');
          setIsProcessing(false);
      }
  };

  // Ensure we have a valid mode - use mode state if set, otherwise use initialMode, default to pricing
  const displayMode = mode || initialMode || 'pricing';

  // Sync mode with initialMode when it changes (but don't override if user has selected payment mode)
  useEffect(() => {
    if (initialMode && initialMode !== mode && mode !== 'payment') {
      setMode(initialMode);
    }
  }, [initialMode, mode]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto p-4" onClick={(e) => {
      // Close on backdrop click
      if (e.target === e.currentTarget) {
        onClose();
      }
    }}>
        
        {/* LOGIN FORM */}
        {displayMode === 'login' && (
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-600"></div>
                <button onClick={() => {
                    if (initialMode === 'pricing') setMode('pricing');
                    else onClose();
                }} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500"><X size={20} /></button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                        <Lock className="text-primary w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">
                        {selectedPlan ? `Sign Up for ${selectedPlan}` : "Welcome Back"}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {selectedPlan ? "Create an account to continue" : "Sign in to access your workspace"}
                    </p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
                            required
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isProcessing}
                        className="w-full py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={18} /> : (selectedPlan ? "Create Account" : "Sign In", "warning")}
                    </button>
                </form>
                <div className="mt-6 text-center text-xs text-slate-400">
                    Don't have an account? <span className="text-primary font-bold cursor-pointer hover:underline">Sign up for free</span>
                </div>
            </div>
        )}

        {/* PRICING TABLE - Default view */}
        {(displayMode === 'pricing' || (!displayMode || displayMode === 'pricing')) && (
            <div className="w-full max-w-5xl px-4 animate-in zoom-in-95 duration-300 min-h-[400px]">
                <div className="relative">
                    <button onClick={onClose} className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors z-10"><X size={24} /></button>
                    
                    <div className="text-center mb-10 text-white">
                        <h2 className="text-3xl font-bold mb-2">Choose Your Trajectory</h2>
                        <p className="text-slate-300">Unlock advanced AI capabilities, automation, and enterprise security.</p>
                    </div>

                    {loadingPackages ? (
                      <div className="flex justify-center items-center py-20 bg-white rounded-2xl min-h-[300px]">
                        <div className="text-center">
                          <Loader2 size={32} className="animate-spin text-primary mx-auto mb-4" />
                          <p className="text-slate-600">Loading packages...</p>
                        </div>
                      </div>
                    ) : packages.length === 0 ? (
                      <div className="bg-white rounded-2xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                        <p className="text-slate-600 mb-4 text-lg">Unable to load packages. Please try again.</p>
                        <button onClick={onClose} className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 font-bold">
                          Close
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {packages.map((pkg) => {
                              const isCurrent = currentPlan === pkg.id || currentPlan === pkg.displayName;
                              const isHighlighted = pkg.metadata?.highlight || false;
                              const iconName = pkg.metadata?.icon || pkg.id.toLowerCase();
                              const Icon = iconMap[iconName] || Layout;
                              const colorClass = isHighlighted ? 'bg-primary' : pkg.id.toLowerCase() === 'enterprise' ? 'bg-slate-900' : 'bg-slate-100';
                              const textColorClass = isHighlighted || pkg.id.toLowerCase() === 'enterprise' ? 'text-white' : 'text-slate-600';
                              const features = pkg.features?.map(f => typeof f === 'object' ? f.label : f) || [];
                              const priceText = pkg.price === 0 ? 'Free' : `$${pkg.price}`;
                              const billingText = pkg.billingCycle === 'monthly' ? '/month' : pkg.billingCycle === 'yearly' ? '/year' : '';
                              
                              return (
                                  <div key={pkg.id} className={`bg-white rounded-2xl p-6 relative flex flex-col ${isHighlighted ? 'scale-105 shadow-2xl z-10 border-2 border-primary' : 'shadow-lg border border-slate-200 opacity-90 hover:opacity-100 transition-opacity'}`}>
                                      {isHighlighted && (
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-primary to-purple-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-md">
                                              Most Popular
                                          </div>
                                      )}
                                      <div className={`w-12 h-12 rounded-xl ${colorClass} ${textColorClass} flex items-center justify-center mb-4 shadow-sm`}>
                                          <Icon size={24} />
                                      </div>
                                      <h3 className="text-xl font-bold text-slate-800">{pkg.displayName}</h3>
                                      <div className="flex items-baseline gap-1 mt-2 mb-6">
                                          <span className="text-3xl font-bold text-slate-800">{priceText}</span>
                                          {pkg.price > 0 && <span className="text-slate-400 text-sm">{billingText}</span>}
                                      </div>
                                      
                                      <ul className="space-y-3 mb-8 flex-1">
                                          {features.slice(0, 5).map((feat, i) => (
                                              <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                                      <Check size={12} strokeWidth={3} />
                                                  </div>
                                                  {feat}
                                              </li>
                                          ))}
                                      </ul>

                                      <button 
                                          onClick={() => {
                                              // Try to use displayName first, then name, then id
                                              const planIdentifier = pkg.displayName || pkg.name || pkg.id;
                                              handleSelectPlan(planIdentifier);
                                          }}
                                          disabled={isCurrent}
                                          className={`w-full py-3 rounded-xl font-bold transition-all ${isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'}`}
                                      >
                                          {isCurrent ? 'Current Plan' : (pkg.price === 0 && !currentPlan ? 'Start Free' : `Upgrade to ${pkg.displayName}`)}
                                      </button>
                                  </div>
                              );
                          })}
                      </div>
                    )}
                </div>
            </div>
        )}

        {/* PAYMENT FORM */}
        {(displayMode === 'payment' || mode === 'payment') && selectedPlan && (
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md relative animate-in slide-in-from-right-10 duration-300 mx-auto">
                <button onClick={() => setMode('pricing')} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    ← Back
                </button>
                
                <div className="mt-6 mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subscribe to</div>
                        <h2 className="text-2xl font-bold text-primary">{selectedPlan} Plan</h2>
                    </div>
                    <div className="text-xl font-bold text-slate-800">
                      ${packages.find(p => p.displayName === selectedPlan || p.id.toLowerCase() === selectedPlan.toLowerCase())?.price || 0}
                      <span className="text-sm text-slate-400 font-normal">/mo</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                        <p className="text-sm text-slate-600 mb-4">
                            You'll be redirected to Stripe's secure checkout page to complete your subscription.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4">
                            <Shield size={14} />
                            <span>Secure payment powered by Stripe</span>
                        </div>
                    </div>

                    <button 
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                <span>Redirecting to checkout...</span>
                            </>
                        ) : (
                            <>
                                <CreditCard size={18} />
                                <span>Continue to Checkout - ${packages.find(p => p.displayName === selectedPlan || p.id.toLowerCase() === selectedPlan.toLowerCase())?.price || 0}/mo</span>
                            </>
                        )}
                    </button>
                    
                    <div className="mt-4 flex justify-center gap-2 opacity-50">
                        <div className="h-6 w-10 bg-slate-200 rounded"></div>
                        <div className="h-6 w-10 bg-slate-200 rounded"></div>
                        <div className="h-6 w-10 bg-slate-200 rounded"></div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default SubscriptionOverlay;
