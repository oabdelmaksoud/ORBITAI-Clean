/**
 * LandingPage Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '@src/components/LandingPage';

// Mock the handlers
const mockHandlers = {
  onLaunch: vi.fn(),
  onLaunchDemo: vi.fn(),
  onSignup: vi.fn(),
};

describe('LandingPage', () => {
  it('should render landing page', () => {
    render(<LandingPage {...mockHandlers} />);
    
    // Check for main heading or key elements
    expect(screen.getByText(/ORBITAI|Start Building|Launch/i)).toBeInTheDocument();
  });

  it('should have sign up button', () => {
    render(<LandingPage {...mockHandlers} />);
    
    const signUpButton = screen.getByText(/Sign Up|Start Building/i);
    expect(signUpButton).toBeInTheDocument();
  });

  it('should call onSignup when sign up button is clicked', () => {
    render(<LandingPage {...mockHandlers} />);
    
    const signUpButton = screen.getByText(/Sign Up|Start Building/i);
    signUpButton.click();
    
    expect(mockHandlers.onSignup).toHaveBeenCalled();
  });
});

