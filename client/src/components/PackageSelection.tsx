import React, { useState, useEffect } from 'react';
import { PublicPackage, getPublicPackages } from '../services/publicPackagesApi';
import { Check, Zap, Shield, Crown, Loader2, ArrowRight, X } from 'lucide-react';

interface PackageSelectionProps {
  onSelectPackage: (pkg: PublicPackage) => void;
  onClose?: () => void;
  userEmail?: string;
  preselectedPackage?: any;
}

const PackageSelection: React.FC<PackageSelectionProps> = ({ onSelectPackage, onClose, userEmail }) => {
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<PublicPackage | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        const fetchedPackages = await getPublicPackages();
        setPackages(fetchedPackages);
        // Auto-select free/default package
        const defaultPkg = fetchedPackages.find(pkg => pkg.isDefault || pkg.price === 0);
        if (defaultPkg) {
          setSelectedPackage(defaultPkg);
        }
      } catch (error) {
        console.error('Failed to fetch packages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const getPackageIcon = (pkg: PublicPackage) => {
    const iconName = pkg.metadata?.icon?.toLowerCase() || pkg.displayName.toLowerCase();
    if (iconName.includes('starter') || iconName.includes('free')) return Zap;
    if (iconName.includes('pro')) return Shield;
    if (iconName.includes('enterprise')) return Crown;
    return Zap;
  };

  const getPackageColor = (pkg: PublicPackage) => {
    if (pkg.metadata?.color) return pkg.metadata.color;
    const name = pkg.displayName.toLowerCase();
    if (name.includes('starter') || name.includes('free')) return 'blue';
    if (name.includes('pro')) return 'indigo';
    if (name.includes('enterprise')) return 'purple';
    return 'blue';
  };

  const formatPrice = (price: number, billingCycle: string) => {
    if (price === 0) return 'Free';
    const cycle = billingCycle === 'monthly' ? '/mo' : billingCycle === 'yearly' ? '/yr' : '';
    return `$${price.toFixed(2)}${cycle}`;
  };

  const handleContinue = () => {
    if (selectedPackage) {
      onSelectPackage(selectedPackage);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center gap-3">
            <Loader2 size={24} className="text-blue-600 animate-spin" />
            <span className="text-slate-700 font-medium">Loading packages...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
      <div className="w-full max-w-5xl relative my-8" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors z-10 p-2 hover:bg-white/10 rounded-lg backdrop-blur-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Package Selection Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-slate-100">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Choose Your Plan</h1>
            <p className="text-slate-600">Select the perfect package for your needs</p>
            {userEmail && (
              <p className="text-sm text-slate-500 mt-2">Welcome, {userEmail}</p>
            )}
          </div>

          {/* Packages Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => {
                const Icon = getPackageIcon(pkg);
                const color = getPackageColor(pkg);
                const isSelected = selectedPackage?.id === pkg.id;
                const isHighlighted = pkg.metadata?.highlight || false;

                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 ${isSelected
                      ? (color === 'blue' ? 'border-blue-500 bg-blue-50/30' :
                        color === 'indigo' ? 'border-indigo-500 bg-indigo-50/30' :
                          color === 'purple' ? 'border-purple-500 bg-purple-50/30' :
                            'border-blue-500 bg-blue-50/30') + ' shadow-lg scale-105'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                      } ${isHighlighted ? 'ring-2 ring-blue-500/20' : ''}`}
                  >
                    {isHighlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Popular
                      </div>
                    )}

                    <div className="p-6">
                      {/* Package Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${color === 'blue' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          color === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                            color === 'purple' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                              'bg-gradient-to-br from-blue-500 to-blue-600'
                          }`}>
                          <Icon className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-900">{pkg.displayName || pkg.name}</h3>
                          <p className="text-2xl font-black text-slate-900 mt-1">
                            {formatPrice(pkg.price, pkg.billingCycle)}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-600 mb-6 min-h-[40px]">{pkg.description}</p>

                      {/* Features */}
                      <div className="space-y-3 mb-6">
                        {pkg.features.slice(0, 6).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Check size={18} className={`mt-0.5 flex-shrink-0 ${color === 'blue' ? 'text-blue-500' :
                              color === 'indigo' ? 'text-indigo-500' :
                                color === 'purple' ? 'text-purple-500' :
                                  'text-blue-500'
                              }`} />
                            <span className="text-sm text-slate-700">
                              {feature.label}: {typeof feature.value === 'boolean'
                                ? (feature.value ? 'Yes' : 'No')
                                : feature.value}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Limits Summary */}
                      <div className="pt-4 border-t border-slate-200 space-y-2">
                        <div className="text-xs text-slate-500">
                          <div>Projects: {pkg.limits.maxProjects === -1 ? 'Unlimited' : pkg.limits.maxProjects}</div>
                          <div>Agents: {pkg.limits.maxAgents === -1 ? 'Unlimited' : pkg.limits.maxAgents}</div>
                          <div>Storage: {pkg.limits.maxStorageGB === -1 ? 'Unlimited' : `${pkg.limits.maxStorageGB}GB`}</div>
                        </div>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center ${color === 'blue' ? 'bg-blue-500' :
                        color === 'indigo' ? 'bg-indigo-500' :
                          color === 'purple' ? 'bg-purple-500' :
                            'bg-blue-500'
                        }`}>
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Continue Button */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={handleContinue}
                disabled={!selectedPackage}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {selectedPackage?.price === 0 ? (
                  <>
                    <span>Continue with Free Plan</span>
                    <ArrowRight size={18} />
                  </>
                ) : (
                  <>
                    <span>Continue to Payment</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageSelection;

