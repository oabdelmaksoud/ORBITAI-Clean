import React from 'react';
import LandingPage from '../components/LandingPage';
import { ElementorLandingShell } from '../components/ElementorLandingShell';
import { getLandingConfig } from '../config/landing';

interface LandingViewProps {
  onLaunch: () => void;
  onLaunchDemo: () => void;
  onSignup: () => void;
}

/**
 * LandingView - Wrapper for landing page
 * Handles Elementor vs React landing page selection
 */
export const LandingView: React.FC<LandingViewProps> = ({
  onLaunch,
  onLaunchDemo,
  onSignup
}) => {
  const landingConfig = getLandingConfig();
  
  // Use Elementor embed if enabled and configured, otherwise use React landing page
  if (landingConfig.elementorEnabled && landingConfig.elementorUrl) {
    return (
      <ElementorLandingShell 
        onLaunch={onLaunch} 
        onLaunchDemo={onLaunchDemo} 
        onSignup={onSignup} 
      />
    );
  }
  
  return (
    <LandingPage 
      onLaunch={onLaunch} 
      onLaunchDemo={onLaunchDemo} 
      onSignup={onSignup} 
    />
  );
};

export default LandingView;

