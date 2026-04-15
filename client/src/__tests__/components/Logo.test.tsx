import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Logo from '@src/components/Logo';

describe('Logo Component', () => {
  it('should render logo component', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('should render with text when showText is true', () => {
    const { container } = render(<Logo showText={true} />);
    const text = container.textContent;
    expect(text).toContain('Orbit');
  });

  it('should not render text when showText is false', () => {
    const { container } = render(<Logo showText={false} />);
    const text = container.textContent;
    expect(text).not.toContain('Orbit');
  });

  it('should apply size classes correctly', () => {
    const { container } = render(<Logo size="lg" />);
    const sizeDiv = container.querySelector('.w-12');
    expect(sizeDiv).not.toBeNull();
  });
});

