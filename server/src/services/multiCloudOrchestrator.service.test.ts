// Tests for MultiCloudOrchestratorService (Week 3)
// ORBIT-AI Platform
// Created: December 5, 2025

import { MultiCloudOrchestratorService } from './multiCloudOrchestrator.service';
import {
  CloudPlatform,
  LoadBalancerConfig,
  FailoverPolicy,
  MultiCloudStatus,
} from '../types/multiCloud.types';

describe('MultiCloudOrchestratorService', () => {
  const service = new MultiCloudOrchestratorService();

  // deployToMultiplePlatforms is now implemented (it orchestrates real
  // deployments), so the old "stub" assertion is obsolete. We instead verify
  // its config-validation guard, which needs no deployment infra.
  it('should reject deployToMultiplePlatforms when no platforms are specified', async () => {
    await expect(
      service.deployToMultiplePlatforms({
        projectId: 'p1',
        projectName: 'TestProject',
        codeArtifactId: 'c1',
        platforms: [],
      })
    ).rejects.toThrow('No platforms specified');
  });

  it('should throw for monitorDeployments (stub)', async () => {
    await expect(service.monitorDeployments(['d1'])).rejects.toThrow(
      'Not yet implemented: monitorDeployments'
    );
  });

  it('should throw for configureLoadBalancer (stub)', async () => {
    await expect(service.configureLoadBalancer({ strategy: 'round-robin' })).rejects.toThrow(
      'Not yet implemented: configureLoadBalancer'
    );
  });

  it('should throw for handleFailover (stub)', async () => {
    await expect(
      service.handleFailover({ type: 'automatic', fallbackPlatforms: ['aws'] }, [])
    ).rejects.toThrow('Not yet implemented: handleFailover');
  });

  it('should throw for optimizeCosts (stub)', async () => {
    await expect(service.optimizeCosts([])).rejects.toThrow('Not yet implemented: optimizeCosts');
  });
});
