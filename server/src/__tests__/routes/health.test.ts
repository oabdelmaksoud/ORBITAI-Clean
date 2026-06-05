import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../routes/health.routes.js';
import mongoose from 'mongoose';
import { hasMongo } from '../helpers/testEnv.js';

const app = express();
app.use(express.json());
app.use('/api/health', healthRoutes);

describe('Health Routes', () => {
  // Basic liveness endpoint does not depend on the database.
  it('should return basic health status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  // The detailed check pings MongoDB; without a reachable DB it reports
  // "unhealthy" and returns 503, so the healthy-path assertions need a DB.
  describe.skipIf(!hasMongo)('detailed (requires MongoDB)', () => {
    it('should return detailed health check', async () => {
      const response = await request(app).get('/api/health/detailed').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('database');
      expect(response.body).toHaveProperty('system');
      expect(response.body.system).toHaveProperty('memory');
    });

    it('should report database as connected', async () => {
      const response = await request(app).get('/api/health/detailed').expect(200);

      expect(mongoose.connection.readyState).toBe(1);
      expect(response.body.dependencies.database.status).toBe('connected');
    });
  });
});
