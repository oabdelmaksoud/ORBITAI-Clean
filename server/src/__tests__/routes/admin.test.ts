import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { User } from '../../models/User.model.js';
import { Project } from '../../models/Project.model.js';

// Set JWT_SECRET before importing anything that uses config
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// Mock feature flags to always allow access in tests
vi.mock('../../services/featureFlags.service.js', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

// Mock heavy services that admin.routes imports
vi.mock('../../services/e2b.service.js', () => ({
  e2bService: {
    isConfigured: vi.fn().mockResolvedValue(false),
    getSandbox: vi.fn(),
  },
}));

vi.mock('../../services/apiKeyProvider.service.js', () => ({
  apiKeyProvider: {
    hasApiKey: vi.fn().mockResolvedValue(false),
    getApiKey: vi.fn().mockResolvedValue(null),
    setApiKey: vi.fn().mockResolvedValue(undefined),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    getAllApiKeys: vi.fn().mockResolvedValue([]),
    getGoogleSearchEngineId: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../services/envManager.service.js', () => ({
  getEnvironmentVariables: vi.fn().mockReturnValue({}),
  updateEnvironmentVariables: vi.fn().mockResolvedValue(undefined),
  getEditableVariables: vi.fn().mockReturnValue([]),
}));

vi.mock('../../middleware/auditLogger.js', () => ({
  logAudit: vi.fn((_action, _details) => (_req: any, _res: any, next: any) => next()),
}));

const { default: adminRoutes } = await import('../../routes/admin.routes.js');
const { createTestAdmin, createTestUser, getAuthHeaders } =
  await import('../helpers/testHelpers.js');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('TEST_MONGODB_URI not set');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Project.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Admin Routes', () => {
  describe('GET /api/admin/dashboard', () => {
    it('should require authentication', async () => {
      await request(app).get('/api/admin/dashboard').expect(401);
    });

    it('should require admin role', async () => {
      const regularUser = await createTestUser();
      const userHeaders = getAuthHeaders(regularUser.token);
      await request(app).get('/api/admin/dashboard').set(userHeaders).expect(403);
    });

    it('should get dashboard statistics for admin', async () => {
      const adminUser = await createTestAdmin();
      const adminHeaders = getAuthHeaders(adminUser.token);

      // Create test data
      await createTestUser({ email: 'user1@example.com' });
      await createTestUser({ email: 'user2@example.com' });
      await Project.create({
        name: 'Test Project',
        description: 'Test',
        userId: adminUser._id.toString(),
        currentPhase: 'planning',
        methodology: 'Agile',
      });

      const response = await request(app).get('/api/admin/dashboard').set(adminHeaders).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('totalUsers');
      expect(response.body.data.stats).toHaveProperty('activeUsers');
      expect(response.body.data.stats).toHaveProperty('totalProjects');
      expect(response.body.data.stats).toHaveProperty('activeProjects');
      expect(response.body.data).toHaveProperty('recentUsers');
      expect(response.body.data).toHaveProperty('recentProjects');
    });
  });

  describe('GET /api/admin/users', () => {
    it('should get all users for admin', async () => {
      const adminUser = await createTestAdmin();
      const adminHeaders = getAuthHeaders(adminUser.token);

      await createTestUser({ email: 'user1@example.com' });
      await createTestUser({ email: 'user2@example.com' });

      const response = await request(app).get('/api/admin/users').set(adminHeaders).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('users');
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should filter users by plan', async () => {
      const adminUser = await createTestAdmin();
      const adminHeaders = getAuthHeaders(adminUser.token);

      await createTestUser({ email: 'free@example.com', plan: 'Free' });
      await createTestUser({ email: 'pro@example.com', plan: 'Pro' });

      const response = await request(app)
        .get('/api/admin/users?plan=Pro')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.data.users.every((u: any) => u.plan === 'Pro')).toBe(true);
    });
  });
});
