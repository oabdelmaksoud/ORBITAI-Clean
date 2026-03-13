// Types for Multi-Cloud Orchestration (Week 3)
// ORBIT-AI Platform
// Created: December 5, 2025

export type CloudPlatform = {
  name: string; // 'vercel' | 'railway' | 'aws' | 'gcp' | 'render'
  region?: string;
  weight?: number; // For load balancing
  apiToken?: string;
  customConfig?: Record<string, any>;
};

export type LoadBalancerConfig = {
  strategy: 'round-robin' | 'weighted-round-robin' | 'latency' | 'failover';
  healthCheckInterval?: number;
  failoverThreshold?: number;
  provider?: 'cloudflare' | 'route53' | 'gclb' | 'custom';
  domains?: string[];
};

export type FailoverPolicy = {
  type: 'automatic' | 'manual';
  fallbackPlatforms: string[];
  maxDowntimeSeconds?: number;
};

export type MultiCloudStatus = {
  deploymentId: string;
  platform: string;
  region?: string;
  status: 'pending' | 'in-progress' | 'success' | 'failed';
  liveUrl?: string;
  repositoryUrl?: string;
  health?: 'healthy' | 'unhealthy';
  logs?: string[];
  cost?: number;
  deployedAt?: string;
  metadata?: Record<string, any>;
};
