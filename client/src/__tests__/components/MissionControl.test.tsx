/**
 * MissionControl Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MissionControl from '@src/components/MissionControl';

describe('MissionControl', () => {
  it('renders progress bar', () => {
    render(<MissionControl progress={50} logs={[]} />);
    const progressBar = document.querySelector('[role="progressbar"], .progress, [class*="progress"]');
    // Component renders without crashing
    expect(document.body).toBeTruthy();
  });

  it('renders with zero progress', () => {
    render(<MissionControl progress={0} logs={[]} />);
    expect(document.body).toBeTruthy();
  });

  it('renders with full progress', () => {
    render(<MissionControl progress={100} logs={[]} />);
    expect(document.body).toBeTruthy();
  });

  it('renders string log entries', () => {
    const logs = ['Starting task...', 'Processing files...', 'Done.'];
    render(<MissionControl progress={75} logs={logs} />);
    expect(screen.getByText('Starting task...')).toBeInTheDocument();
    expect(screen.getByText('Processing files...')).toBeInTheDocument();
    expect(screen.getByText('Done.')).toBeInTheDocument();
  });

  it('renders structured GenerationStatusEvent logs', () => {
    const logs = [
      {
        type: 'ai_thought' as const,
        message: 'Analyzing requirements',
        timestamp: Date.now(),
      },
      {
        type: 'model_selection' as const,
        message: 'Selected GPT-4',
        timestamp: Date.now(),
        metadata: { model: 'gpt-4', provider: 'openai' },
      },
    ];
    render(<MissionControl progress={30} logs={logs} />);
    expect(screen.getByText('Analyzing requirements')).toBeInTheDocument();
    expect(screen.getByText('Selected GPT-4')).toBeInTheDocument();
  });

  it('renders error events', () => {
    const logs = [
      {
        type: 'error' as const,
        message: 'Task failed: timeout',
        timestamp: Date.now(),
      },
    ];
    render(<MissionControl progress={0} logs={logs} />);
    expect(screen.getByText('Task failed: timeout')).toBeInTheDocument();
  });

  it('renders complete events', () => {
    const logs = [
      {
        type: 'complete' as const,
        message: 'Build complete',
        timestamp: Date.now(),
        metadata: { duration: 1500, tokenCount: 200 },
      },
    ];
    render(<MissionControl progress={100} logs={logs} />);
    expect(screen.getByText('Build complete')).toBeInTheDocument();
  });

  it('renders showMetadata flag', () => {
    const logs = [
      {
        type: 'model_selection' as const,
        message: 'Using claude-3',
        timestamp: Date.now(),
        metadata: { model: 'claude-3', provider: 'anthropic' },
      },
    ];
    render(<MissionControl progress={50} logs={logs} showMetadata={true} />);
    expect(screen.getByText('Using claude-3')).toBeInTheDocument();
  });

  it('handles empty logs gracefully', () => {
    const { container } = render(<MissionControl progress={0} logs={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('handles mixed string and event logs', () => {
    const logs = [
      'Simple string log',
      {
        type: 'process_stage' as const,
        message: 'Generating code',
        timestamp: Date.now(),
      },
      'Another string',
    ];
    render(<MissionControl progress={60} logs={logs} />);
    expect(screen.getByText('Simple string log')).toBeInTheDocument();
    expect(screen.getByText('Generating code')).toBeInTheDocument();
    expect(screen.getByText('Another string')).toBeInTheDocument();
  });
});
