/**
 * Health Check Tests
 * Tests for health check endpoints
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../routes/health.routes.js';

const app = express();
app.use(express.json());
app.use('/health', healthRoutes);

describe('Health Check Routes', () => {
  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await request(app).get('/health/detailed');
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('database');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready');
      
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});

