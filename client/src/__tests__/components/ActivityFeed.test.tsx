/**
 * ActivityFeed Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as activityApi from '@src/services/activityApi';
import ActivityFeed from '@src/components/ActivityFeed';

vi.mock('@src/services/activityApi', () => ({
  getActivityEvents: vi.fn().mockResolvedValue([]),
  getActivityStats: vi.fn().mockResolvedValue({
    totalEvents: 0,
    eventsByType: {},
    activeUsers: 0,
    recentActivity: []
  }),
}));

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with a token', async () => {
    render(<ActivityFeed token="test-token" />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });
  });

  it('does not call API when token is empty', () => {
    render(<ActivityFeed token="" />);
    expect(vi.mocked(activityApi.getActivityEvents)).not.toHaveBeenCalled();
  });

  it('calls API when token is provided', async () => {
    render(<ActivityFeed token="test-token" />);
    await waitFor(() => {
      expect(vi.mocked(activityApi.getActivityEvents)).toHaveBeenCalled();
    });
  });
});
