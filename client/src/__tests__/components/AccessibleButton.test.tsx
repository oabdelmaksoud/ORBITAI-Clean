/**
 * AccessibleButton Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibleButton } from '@src/components/AccessibleButton';

describe('AccessibleButton', () => {
  it('renders children', () => {
    render(<AccessibleButton aria-label="Save">Save</AccessibleButton>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('passes aria-label to the button element', () => {
    render(<AccessibleButton aria-label="Delete item">Delete</AccessibleButton>);
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const onClick = vi.fn();
    render(<AccessibleButton aria-label="Click me" onClick={onClick}>Click</AccessibleButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders with primary variant by default', () => {
    render(<AccessibleButton aria-label="Primary">Primary</AccessibleButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary');
  });

  it('renders with danger variant', () => {
    render(<AccessibleButton aria-label="Delete" variant="danger">Delete</AccessibleButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red');
  });

  it('renders with secondary variant', () => {
    render(<AccessibleButton aria-label="Cancel" variant="secondary">Cancel</AccessibleButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-slate');
  });

  it('renders with sm size', () => {
    render(<AccessibleButton aria-label="Small" size="sm">Small</AccessibleButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-xs');
  });

  it('renders with lg size', () => {
    render(<AccessibleButton aria-label="Large" size="lg">Large</AccessibleButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-base');
  });

  it('is disabled when disabled prop is set', () => {
    render(<AccessibleButton aria-label="Disabled" disabled>Disabled</AccessibleButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders an icon alongside children', () => {
    render(
      <AccessibleButton aria-label="With icon" icon={<span data-testid="icon">★</span>}>
        Label
      </AccessibleButton>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
  });
});
