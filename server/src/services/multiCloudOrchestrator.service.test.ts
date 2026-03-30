// Tests for MultiCloudOrchestratorService
import { describe, it, expect, vi } from 'vitest';
import { MultiCloudOrchestratorService } from './multiCloudOrchestrator.service';

// Mock all external dependencies
vi.mock('./deploymentOrchestrator.service', () => ({
  deploymentOrchestratorService: {
    orchestrateDeployment: vi.fn().mockResolvedValue({
      platform: 'vercel',
      status: 'deployed',
      url: 'https://test.vercel.app',
    }),
  },
}));

vi.mock('./loadBalancer.service', () => {
  return {
    LoadBalancerService: class {
      configure = vi.fn().mockResolvedValue({ status: 'configured' });
    },
  };
});

vi.mock('./failover.service', () => {
  return {
    FailoverService: class {
      handleFailover = vi.fn().mockResolvedValue({ status: 'ok' });
    },
  };
});

describe('MultiCloudOrchestratorService', () => {
  const service = new MultiCloudOrchestratorService();

  it('should throw for empty platforms array', async () => {
    await expect(service.deployToMultiplePlatforms({
      projectId: 'p1',
      projectName: 'TestProject',
      codeArtifactId: 'c1',
      platforms: [],
    })).rejects.toThrow('No platforms specified');
  });

  it('should deploy to a single platform', async () => {
    const result = await service.deployToMultiplePlatforms({
      projectId: 'p1',
      projectName: 'TestProject',
      codeArtifactId: 'c1',
      platforms: [{ name: 'vercel' }],
    });
    expect(result).toBeDefined();
  });
});
