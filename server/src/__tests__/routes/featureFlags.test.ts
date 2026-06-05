import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import featureFlagsRoutes from '../../routes/featureFlags.routes.js';
import { createTestAdmin, getAuthHeaders } from '../helpers/testHelpers.js';
import { FeatureFlag } from '../../models/FeatureFlag.model.js';
import { User } from '../../models/User.model.js';
import { hasMongo } from '../helpers/testEnv.js';

const app = express();
app.use(express.json());
app.use('/api/admin/feature-flags', featureFlagsRoutes);

// Requires a reachable MongoDB server (createTestAdmin/FeatureFlag persist to mongoose).
describe.skipIf(!hasMongo)('Feature Flags Routes', () => {
  let adminUser: Awaited<ReturnType<typeof createTestAdmin>>;
  let adminHeaders: ReturnType<typeof getAuthHeaders>;

  beforeEach(async () => {
    await User.deleteMany({});
    await FeatureFlag.deleteMany({});
    adminUser = await createTestAdmin();
    adminHeaders = getAuthHeaders(adminUser.token);
  });

  describe('GET /api/admin/feature-flags/check/:key (Public)', () => {
    it('should check feature flag without authentication', async () => {
      await FeatureFlag.create({
        featureKey: 'test_feature',
        featureName: 'Test Feature',
        description: 'Test Description',
        category: 'test',
        enabledRoles: ['user', 'admin'],
        isActive: true,
      });

      const response = await request(app)
        .get('/api/admin/feature-flags/check/test_feature')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('enabled');
    });

    it('should return enabled=true for non-existent flag (backward compatibility)', async () => {
      const response = await request(app)
        .get('/api/admin/feature-flags/check/nonexistent')
        .expect(200);

      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.reason).toContain('not found');
    });

    it('should check feature flag for specific role', async () => {
      await FeatureFlag.create({
        featureKey: 'role_feature',
        featureName: 'Role Feature',
        description: 'Test',
        category: 'test',
        enabledRoles: ['admin'],
        isActive: true,
      });

      const response = await request(app)
        .get('/api/admin/feature-flags/check/role_feature?role=admin')
        .expect(200);

      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.hasRoleAccess).toBe(true);
    });

    it('should return disabled for inactive feature', async () => {
      await FeatureFlag.create({
        featureKey: 'inactive_feature',
        featureName: 'Inactive Feature',
        description: 'Test',
        category: 'test',
        enabledRoles: ['user'],
        isActive: false,
      });

      const response = await request(app)
        .get('/api/admin/feature-flags/check/inactive_feature')
        .expect(200);

      expect(response.body.data.enabled).toBe(false);
      expect(response.body.data.reason).toContain('disabled system-wide');
    });
  });

  describe('GET /api/admin/feature-flags (Admin Only)', () => {
    it('should require authentication', async () => {
      await request(app).get('/api/admin/feature-flags').expect(401);
    });

    it('should get all feature flags for admin', async () => {
      await FeatureFlag.create({
        featureKey: 'feature1',
        featureName: 'Feature 1',
        description: 'Test',
        category: 'test',
        enabledRoles: ['user'],
        isActive: true,
      });

      await FeatureFlag.create({
        featureKey: 'feature2',
        featureName: 'Feature 2',
        description: 'Test',
        category: 'test',
        enabledRoles: ['admin'],
        isActive: true,
      });

      const response = await request(app)
        .get('/api/admin/feature-flags')
        .set(adminHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('flags');
      expect(response.body.data.flags.length).toBeGreaterThanOrEqual(2);
    });
  });
});
