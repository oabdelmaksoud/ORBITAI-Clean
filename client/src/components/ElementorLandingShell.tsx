import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { getLandingConfig, isOriginAllowed } from '../config/landing';
import { isValidOrbitAIMessage, handleOrbitAIMessage } from '../utils/elementorBridge';
import { PricingSection } from './landing/PricingSection';

interface ElementorLandingShellProps {
  onLaunch: () => void;
  onLaunchDemo?: () => void;
  onSignup: (preSelectedPackage?: any) => void;
}

export const ElementorLandingShell: React.FC<ElementorLandingShellProps> = ({
  onLaunch,
  onLaunchDemo,
  onSignup,
}) => {
  const config = getLandingConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle messages from Elementor iframe
  useEffect(() => {
    if (!config.elementorEnabled || !config.elementorUrl) {
      setError('Elementor embed is not configured');
      setLoading(false);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Validate message origin (fast check first)
      if (!isOriginAllowed(event.origin, config)) {
        console.warn('[Elementor Shell] Message from disallowed origin:', event.origin);
        return;
      }

      // Validate message structure
      if (!isValidOrbitAIMessage(event, config.allowedOrigins)) {
        return;
      }

      // Defer heavy work to prevent blocking the message handler
      setTimeout(() => {
        // Handle the message
        handleOrbitAIMessage(event.data, {
          onSignup: (packageId) => {
            // Find package by ID if provided
            if (packageId) {
              // Package will be resolved in onSignup handler
              onSignup({ id: packageId });
            } else {
              onSignup();
            }
          },
          onLaunch,
          onLaunchDemo: onLaunchDemo || onLaunch,
          onScroll: (target) => {
            // Handle smooth scroll to target
            const element = document.getElementById(target.replace('#', ''));
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          },
          onNavigate: (path) => {
            // Handle navigation
            window.location.href = path;
          },
        });
      }, 0);
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [config, onLaunch, onLaunchDemo, onSignup]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load Elementor page');
  };

  if (!config.elementorEnabled || !config.elementorUrl) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Elementor Not Configured</h2>
          <p className="text-slate-600">
            Please set VITE_ELEMENTOR_ENABLE=true and VITE_ELEMENTOR_EMBED_URL in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  // Build iframe URL with embed token
  const iframeUrl = new URL(config.elementorUrl);
  iframeUrl.searchParams.set('orbitai_embed', 'true');
  iframeUrl.searchParams.set('timestamp', Date.now().toString());

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 text-blue-600 animate-spin" size={48} />
            <p className="text-slate-600 font-medium">Loading landing page...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to Load</h2>
            <p className="text-slate-600 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                if (iframeRef.current) {
                  iframeRef.current.src = iframeUrl.toString();
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Elementor iframe */}
      <iframe
        ref={iframeRef}
        src={iframeUrl.toString()}
        className="w-full border-0"
        style={{ minHeight: '100vh' }}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="OrbitAI Landing Page"
        allow="fullscreen"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
      />

      {/* Dynamic Pricing Section - Always rendered below iframe */}
      <PricingSection onSignup={onSignup} />
    </div>
  );
};




