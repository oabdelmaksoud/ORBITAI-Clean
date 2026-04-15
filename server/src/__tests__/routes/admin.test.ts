import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import adminRoutes from '../../routes/admin.routes.js';
import { createTestAdmin, createTestUser, getAuthHeaders } from '../helpers/testHelpers.js';
import { User } from '../../models/User.model.js';
import { Project } from '../../models/Project.model.js';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Admin Routes', () => {
  let adminUser: Awaited<ReturnType<typeof createTestAdmin>>;
  let adminHeaders: ReturnType<typeof getAuthHeaders>;
  let regularUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    adminUser = await createTestAdmin();
    regularUser = await createTestUser();
    adminHeaders = getAuthHeaders(adminUser.token);
  });

  describe('GET /api/admin/dashboard', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard')
        .expect(401);
    });

    it('should require admin role', async () => {
      const userHeaders = getAuthHeaders(regularUser.token);
      await request(app)
        .get('/api/admin/dashboard')
        .set(userHeaders)
        .expect(403);
    });

    it('should get dashboard statistics for admin', async () => {
      // Create test data
      await createTestUser({ email: 'user1@example.com' });
      await createTestUser({ email: 'user2@example.com' });
      await Project.create({
        name: 'Test Project',
        description: 'Test',
        userId: regularUser._id,
        currentPhase: 'planning',
        methodology: 'agile'
      });

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set(adminHeaders)
        .expect(200);

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
      await createTestUser({ email: 'user1@example.com' });
      await createTestUser({ email: 'user2@example.com' });

      const response = await request(app)
        .get('/api/admin/users')
        .set(adminHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('users');
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should filter users by plan', async () => {
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
