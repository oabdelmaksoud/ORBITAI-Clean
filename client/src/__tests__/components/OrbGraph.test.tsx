/**
 * OrbGraph Component Tests
 * Tests the D3 mind-map visualization component
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrbGraph from '@src/components/OrbGraph';
import { Idea } from '@orbitai/shared';

// Mock D3 - jsdom doesn't support SVG layout
vi.mock('d3', () => {
  const mockSelection = {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    enter: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    style: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    merge: vi.fn().mockReturnThis(),
    exit: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    each: vi.fn().mockReturnThis(),
    raise: vi.fn().mockReturnThis(),
    classed: vi.fn().mockReturnThis(),
    node: vi.fn().mockReturnValue(null),
    transition: vi.fn().mockReturnThis(),
    duration: vi.fn().mockReturnThis(),
    ease: vi.fn().mockReturnThis(),
    nodes: vi.fn().mockReturnValue([]),
    property: vi.fn().mockReturnThis(),
    html: vi.fn().mockReturnThis(),
    lower: vi.fn().mockReturnThis(),
  };
  const mockSimulation = {
    nodes: vi.fn().mockReturnThis(),
    force: vi.fn().mockReturnThis(),
    alphaDecay: vi.fn().mockReturnThis(),
    velocityDecay: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    alpha: vi.fn().mockReturnThis(),
    restart: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  };
  return {
    select: vi.fn(() => ({ ...mockSelection })),
    selectAll: vi.fn(() => ({ ...mockSelection })),
    forceSimulation: vi.fn(() => mockSimulation),
    forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis(), strength: vi.fn().mockReturnThis() })),
    forceManyBody: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
    forceCenter: vi.fn(() => ({})),
    forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis(), strength: vi.fn().mockReturnThis() })),
    forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
    forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
    drag: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
    })),
    zoom: vi.fn(() => ({
      scaleExtent: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      transform: vi.fn().mockReturnThis(),
    })),
    zoomIdentity: { translate: vi.fn(() => ({ scale: vi.fn(() => ({})) })) },
    zoomTransform: vi.fn(() => ({ k: 1, x: 0, y: 0 })),
    rgb: vi.fn(() => ({ darker: vi.fn(() => ({ toString: () => '#000' })) })),
    interpolateRgb: vi.fn(),
    schemeTableau10: ['#4e79a7', '#f28e2b'],
    transition: vi.fn(() => ({ ...mockSelection })),
  };
});

// Mock IdeaImageGenerator
vi.mock('@src/components/IdeaImageGenerator', () => ({
  default: () => null,
}));

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: 'idea-1',
  text: 'Test Idea',
  category: 'idea',
  priority: 3,
  ...overrides,
});

describe('OrbGraph', () => {
  it('renders without crashing with empty ideas', () => {
    const { container } = render(
      <OrbGraph topic="Test Topic" ideas={[]} activeIdeaId={null} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with a topic', () => {
    render(<OrbGraph topic="My Project" ideas={[]} activeIdeaId={null} />);
    // Should render an SVG element
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders with multiple ideas', () => {
    const ideas = [
      makeIdea({ id: 'idea-1', text: 'Feature A' }),
      makeIdea({ id: 'idea-2', text: 'Feature B' }),
      makeIdea({ id: 'idea-3', text: 'Feature C' }),
    ];
    const { container } = render(
      <OrbGraph topic="Test" ideas={ideas} activeIdeaId={null} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts activeIdeaId prop', () => {
    const ideas = [makeIdea({ id: 'idea-1', text: 'Active Idea' })];
    const { container } = render(
      <OrbGraph topic="Test" ideas={ideas} activeIdeaId="idea-1" />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts selectedIdeaIds prop', () => {
    const ideas = [
      makeIdea({ id: 'idea-1', text: 'Selected' }),
      makeIdea({ id: 'idea-2', text: 'Not Selected' }),
    ];
    const { container } = render(
      <OrbGraph
        topic="Test"
        ideas={ideas}
        activeIdeaId={null}
        selectedIdeaIds={new Set(['idea-1'])}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts callback props without crashing', () => {
    const onIdeaClick = vi.fn();
    const onIdeaDoubleClick = vi.fn();
    const onIdeaDelete = vi.fn();

    const { container } = render(
      <OrbGraph
        topic="Test"
        ideas={[makeIdea()]}
        activeIdeaId={null}
        onIdeaClick={onIdeaClick}
        onIdeaDoubleClick={onIdeaDoubleClick}
        onIdeaDelete={onIdeaDelete}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts a theme prop', () => {
    const { container } = render(
      <OrbGraph topic="Test" ideas={[]} activeIdeaId={null} theme="dark" />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('updates when ideas prop changes', () => {
    const { rerender, container } = render(
      <OrbGraph topic="Test" ideas={[]} activeIdeaId={null} />
    );
    rerender(
      <OrbGraph topic="Test" ideas={[makeIdea()]} activeIdeaId={null} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('handles ideas with all categories', () => {
    const categories = ['feature', 'technology', 'ux', 'data', 'business', 'risk', 'opportunity'];
    const ideas = categories.map((cat, i) =>
      makeIdea({ id: `idea-${i}`, text: `${cat} idea`, category: cat as any })
    );
    const { container } = render(
      <OrbGraph topic="Test" ideas={ideas} activeIdeaId={null} />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
