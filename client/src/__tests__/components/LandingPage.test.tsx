/**
 * LandingPage Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '@src/components/LandingPage';

// Mock useAuth to avoid needing AuthProvider
vi.mock('@src/contexts/AuthContext', () => ({
  useAuth: () => ({
    loginAsGuest: vi.fn(),
    user: null,
    loading: false,
    isAuthenticated: false,
  }),
}));

// Mock API calls used in LandingPage
vi.mock('@src/services/publicPackagesApi', () => ({
  getPublicPackages: vi.fn().mockResolvedValue([]),
}));

vi.mock('@src/services/pageContentApi', () => ({
  getPublicPageContent: vi.fn().mockResolvedValue(null),
}));

// Mock the handlers
const mockHandlers = {
  onLaunch: vi.fn(),
  onLaunchDemo: vi.fn(),
  onSignup: vi.fn(),
};

describe('LandingPage', () => {
  it('should render landing page', () => {
    render(<LandingPage {...mockHandlers} />);

    // Check for main heading or key elements - use getAllByText since multiple matches exist
    const elements = screen.getAllByText(/ORBITAI|Start Building|Launch/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('should have sign up button', () => {
    render(<LandingPage {...mockHandlers} />);

    const signUpButtons = screen.getAllByText(/Sign Up/i);
    expect(signUpButtons.length).toBeGreaterThan(0);
  });

  it('should call onSignup when sign up button is clicked', () => {
    render(<LandingPage {...mockHandlers} />);

    // Get the first visible Sign Up button
    const signUpButtons = screen.getAllByText(/Sign Up/i);
    signUpButtons[0].click();

    expect(mockHandlers.onSignup).toHaveBeenCalled();
  });
});

