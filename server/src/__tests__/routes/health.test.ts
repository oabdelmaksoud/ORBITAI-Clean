import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../routes/health.routes.js';
import mongoose from 'mongoose';

const app = express();
app.use(express.json());
app.use('/api/health', healthRoutes);

describe('Health Routes', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('database');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('environment');
  });

  it('should return detailed health check', async () => {
    const response = await request(app)
      .get('/api/health/detailed')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('services');
    expect(response.body.services).toHaveProperty('database');
    expect(response.body.services).toHaveProperty('api');
    expect(response.body).toHaveProperty('system');
    expect(response.body.system).toHaveProperty('memory');
    expect(response.body.system).toHaveProperty('uptime');
  });

  it('should show database connection status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    expect(response.body.database).toBe(dbStatus);
  });
});
