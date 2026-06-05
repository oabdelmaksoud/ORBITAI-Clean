// API Route Tests for Multi-Cloud Orchestration (Week 3)
// ORBIT-AI Platform
// Created: December 5, 2025

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { multiCloudRoutes } from './multiCloud.routes';
import { generateToken } from '../middleware/auth';
import { hasMongo } from '../__tests__/helpers/testEnv.js';

// These routes apply authenticateToken + checkFeatureAccess('multi-cloud'),
// and the feature-access middleware reads FeatureFlag.findOne(...).lean() from
// MongoDB — so the suite requires a reachable MongoDB server. A token carrying
// a role lets authenticateToken skip its own DB lookup; the feature check still
// needs the DB.
describe.skipIf(!hasMongo)('Multi-Cloud API Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/multi-cloud', multiCloudRoutes);

  const token = generateToken(
    '507f1f77bcf86cd799439011',
    'test@example.com',
    'Enterprise',
    'admin'
  );
  const auth = { Authorization: `Bearer ${token}` };

  it('POST /api/multi-cloud/deploy returns 500 (stub)', async () => {
    const res = await request(app)
      .post('/api/multi-cloud/deploy')
      .set(auth)
      .send({
        projectId: 'p1',
        projectName: 'TestProject',
        codeArtifactId: 'c1',
        platforms: [{ name: 'vercel' }],
      });
    expect([500, 501]).toContain(res.statusCode);
  });

  it('POST /api/multi-cloud/load-balancer returns 500 (stub)', async () => {
    const res = await request(app)
      .post('/api/multi-cloud/load-balancer')
      .set(auth)
      .send({ strategy: 'round-robin' });
    expect([500, 501]).toContain(res.statusCode);
  });

  it('GET /api/multi-cloud/status/:deploymentId returns 501 (stub)', async () => {
    const res = await request(app).get('/api/multi-cloud/status/d1').set(auth);
    expect(res.statusCode).toBe(501);
  });

  it('POST /api/multi-cloud/failover/:deploymentId returns 501 (stub)', async () => {
    const res = await request(app).post('/api/multi-cloud/failover/d1').set(auth);
    expect(res.statusCode).toBe(501);
  });

  it('GET /api/multi-cloud/costs/:deploymentId returns 501 (stub)', async () => {
    const res = await request(app).get('/api/multi-cloud/costs/d1').set(auth);
    expect(res.statusCode).toBe(501);
  });

  it('GET /api/multi-cloud/health returns 501 (stub)', async () => {
    const res = await request(app).get('/api/multi-cloud/health').set(auth);
    expect(res.statusCode).toBe(501);
  });
});
