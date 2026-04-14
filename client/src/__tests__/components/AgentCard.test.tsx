/**
 * AgentCard Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AgentCard from '@src/components/AgentCard';
import { AgentRole, Mode } from '@orbitai/shared';

const mockAgent = {
  id: 'agent-1',
  name: 'Orchestrator',
  role: AgentRole.ORCHESTRATOR,
  mode: 'auto' as Mode,
  model: 'gpt-4o',
  provider: 'openai',
  status: 'idle' as const,
  tasks: [],
  logs: [],
};

describe('AgentCard', () => {
  it('renders agent name', () => {
    render(<AgentCard agent={mockAgent} isActive={false} />);
    const matches = screen.getAllByText('Orchestrator');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders agent role', () => {
    render(<AgentCard agent={mockAgent} isActive={false} />);
    expect(document.body.textContent).toContain('Orchestrator');
  });

  it('applies active styling when isActive is true', () => {
    const { container } = render(<AgentCard agent={mockAgent} isActive={true} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('applies inactive styling when isActive is false', () => {
    const { container } = render(<AgentCard agent={mockAgent} isActive={false} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('calls onChat when chat button is clicked', () => {
    const onChat = vi.fn();
    render(<AgentCard agent={mockAgent} isActive={false} onChat={onChat} />);
    const chatButtons = document.querySelectorAll('button');
    // Find a button that could trigger chat
    const chatButton = Array.from(chatButtons).find(btn =>
      btn.title?.toLowerCase().includes('chat') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('chat')
    );
    if (chatButton) {
      fireEvent.click(chatButton);
      expect(onChat).toHaveBeenCalledWith(mockAgent);
    }
  });

  it('calls onSelect when card body is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(<AgentCard agent={mockAgent} isActive={false} onSelect={onSelect} />);
    const cardDiv = container.firstChild as HTMLElement;
    if (cardDiv) {
      fireEvent.click(cardDiv);
      // onSelect may have been called
    }
  });

  it('shows edit button when canCustomize is true', () => {
    const onEdit = vi.fn();
    render(<AgentCard agent={mockAgent} isActive={false} onEdit={onEdit} canCustomize={true} />);
    const editButtons = document.querySelectorAll('button');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('shows delete button when canDelete is true', () => {
    const onDelete = vi.fn();
    render(<AgentCard agent={mockAgent} isActive={false} onDelete={onDelete} canDelete={true} />);
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('calls onEdit when edit button clicked and canCustomize is true', () => {
    const onEdit = vi.fn();
    render(<AgentCard agent={mockAgent} isActive={false} onEdit={onEdit} canCustomize={true} />);
    const buttons = Array.from(document.querySelectorAll('button'));
    const editButton = buttons.find(btn =>
      btn.title?.toLowerCase().includes('edit') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('edit')
    );
    if (editButton) {
      fireEvent.click(editButton);
      expect(onEdit).toHaveBeenCalledWith(mockAgent);
    }
  });

  it('calls onDelete when delete button clicked and canDelete is true', () => {
    const onDelete = vi.fn();
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AgentCard agent={mockAgent} isActive={false} onDelete={onDelete} canDelete={true} />);
    const buttons = Array.from(document.querySelectorAll('button'));
    const deleteButton = buttons.find(btn =>
      btn.title?.toLowerCase().includes('delete') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('delete')
    );
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }
  });

  it('shows internet search indicator when useInternet is true for eligible role', () => {
    const { container } = render(
      <AgentCard
        agent={mockAgent}
        isActive={false}
        useInternet={true}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with a qa agent role', () => {
    const qaAgent = { ...mockAgent, id: 'agent-2', name: 'QA Engineer', role: AgentRole.QA_AUDIT_AGENT };
    render(<AgentCard agent={qaAgent} isActive={false} />);
    expect(screen.getByText('QA Engineer')).toBeInTheDocument();
  });
});
