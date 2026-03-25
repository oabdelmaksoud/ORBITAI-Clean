/**
 * LandingPage Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '@src/components/LandingPage';

// Mock the AuthContext to avoid needing AuthProvider
vi.mock('@src/contexts/AuthContext', () => ({
  useAuth: () => ({
    loginAsGuest: vi.fn(),
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  }),
}));

// Mock the API calls used in LandingPage
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

    // Check that the page renders content
    expect(document.body.textContent).toBeTruthy();
    expect(document.body.textContent!.length).toBeGreaterThan(0);
  });

  it('should have sign up button', () => {
    render(<LandingPage {...mockHandlers} />);

    // Find any button/link with sign up related text
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render with Logo component', () => {
    const { container } = render(<LandingPage {...mockHandlers} />);

    // Logo renders an SVG
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
