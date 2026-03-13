import React, { useEffect, useState } from 'react';
import { CheckCircle2, Layout, Loader2, Zap, Shield } from 'lucide-react';
import { getPublicPackages, PublicPackage } from '@src/services/publicPackagesApi';

interface PricingSectionProps {
  onSignup: (preSelectedPackage?: PublicPackage) => void;
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

export const PricingSection: React.FC<PricingSectionProps> = ({ onSignup }) => {
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        const fetchedPackages = await getPublicPackages();
        setPackages(fetchedPackages);
      } catch (error) {
        // Silently handle API errors - backend may not be running
        // Use fallback packages if API fails
        const fallbackPackages: PublicPackage[] = [
          {
            id: 'starter',
            name: 'Starter',
            displayName: 'Starter',
            price: 0,
            billingCycle: 'monthly',
            features: [
              'Up to 3 projects',
              'Basic AI agents',
              'Community support',
              'Local storage only'
            ],
            metadata: { highlight: false, icon: 'starter' }
          },
          {
            id: 'pro',
            name: 'Pro',
            displayName: 'Pro',
            price: 29,
            billingCycle: 'monthly',
            features: [
              'Unlimited projects',
              'Advanced AI agents',
              'Priority support',
              'Cloud sync',
              'Advanced analytics'
            ],
            metadata: { highlight: true, icon: 'pro' }
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            displayName: 'Enterprise',
            price: 99,
            billingCycle: 'monthly',
            features: [
              'Everything in Pro',
              'Custom agent configurations',
              'Dedicated support',
              'SLA guarantee',
              'Custom integrations'
            ],
            metadata: { highlight: false, icon: 'enterprise' }
          }
        ];
        setPackages(fallbackPackages);
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  return (
    <section id="pricing" className="py-32 px-6 bg-white relative overflow-hidden scroll-mt-24">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      <div className="max-w-6xl mx-auto relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-4 text-slate-900">Pricing that scales.</h2>
        <p className="text-center text-slate-500 mb-16 text-lg">Start for free, upgrade when you need autonomous powers.</p>
        
        {loadingPackages ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 items-center`}>
            {packages.map((pkg, index) => {
              const isHighlighted = pkg.metadata?.highlight || index === 1;
              const bgClass = isHighlighted ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-slate-50 border border-slate-200';
              const textClass = isHighlighted ? 'text-white' : 'text-slate-900';
              const iconName = pkg.metadata?.icon || pkg.name.toLowerCase();
              const Icon = iconMap[iconName] || Layout;
              const priceText = pkg.price === 0 ? 'Free' : `$${pkg.price}`;
              const billingText = pkg.billingCycle === 'monthly' ? '/mo' : pkg.billingCycle === 'yearly' ? '/yr' : '';
              const features = pkg.features?.map(f => typeof f === 'object' ? f.label : f) || [];

              return (
                <div 
                  key={pkg.id} 
                  className={`${bgClass} rounded-3xl p-8 relative ${isHighlighted ? 'shadow-2xl scale-105 z-10 ring-2 ring-blue-500/20' : 'hover:border-slate-300 transition-all hover:-translate-y-2 hover:shadow-xl'} hover-lift overflow-hidden`}
                >
                  {isHighlighted && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg animate-pulse-glow">
                      Most Popular
                    </div>
                  )}
                  {isHighlighted && (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  )}
                  <div className={`${isHighlighted ? 'text-blue-400' : 'text-slate-500'} font-bold uppercase tracking-wider text-xs mb-4 flex items-center gap-2`}>
                    <Icon size={14} className={isHighlighted ? 'fill-current' : ''} /> {pkg.displayName}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-4xl font-bold ${textClass}`}>{priceText}</span>
                    {pkg.price > 0 && <span className={`${isHighlighted ? 'text-slate-400' : 'text-slate-500'} text-sm font-medium`}>{billingText}</span>}
                  </div>
                  <div className={`text-sm ${isHighlighted ? 'text-slate-400' : 'text-slate-500'} mb-6`}>
                    {pkg.price === 0 ? 'Forever free' : 'Per user'}
                  </div>
                  <ul className={`space-y-4 mb-8 text-sm ${isHighlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                    {features.slice(0, 5).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <CheckCircle2 
                          size={16} 
                          className={isHighlighted ? 'text-blue-500' : index === 2 ? 'text-purple-500' : 'text-slate-400'} 
                        /> 
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Get Pro button clicked', pkg);
                      if (pkg.price > 0 && pkg.name !== 'Enterprise') {
                        onSignup(pkg);
                      } else {
                        onSignup();
                      }
                    }} 
                    className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative z-10 ${
                      isHighlighted 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40'
                        : 'border border-slate-200 hover:bg-white hover:border-slate-300 text-slate-700 bg-white shadow-sm'
                    }`}
                  >
                    {pkg.price === 0 ? 'Start Free' : pkg.name === 'Enterprise' ? 'Contact Sales' : `Get ${pkg.displayName}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

