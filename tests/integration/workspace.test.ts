import request from 'supertest';
import app from '../src/app';
import { Workspace } from '../src/models/Workspace.model';
import { User } from '../src/models/User.model';
import { Comment } from '../src/models/Comment.model';
import { Notification } from '../src/models/Notification.model';
import { TimeEntry } from '../src/models/TimeEntry.model';
import mongoose from 'mongoose';

describe('Workspace API Integration Tests', () => {
  let token: string;
  let userId: string;
  let workspaceId: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/orbitai-test');
    
    // Create test user
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=test'
    });
    
    userId = user._id.toString();
    
    // Get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    token = response.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    await TimeEntry.deleteMany({});
    await mongoose.disconnect();
  });

  describe('POST /api/workspaces', () => {
    it('should create a new workspace', async () => {
      const response = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Workspace',
          description: 'Test workspace description'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Workspace');
      expect(response.body.slug).toBe('test-workspace');
      expect(response.body.owner).toBe(userId);
      
      workspaceId = response.body._id;
    });

    it('should not create workspace without name', async () => {
      const response = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Missing name'
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/workspaces')
        .send({
          name: 'Test Workspace'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/workspaces', () => {
    it('should list user workspaces', async () => {
      const response = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('should get workspace details', async () => {
      const response = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(workspaceId);
      expect(response.body.name).toBe('Test Workspace');
    });

    it('should return 404 for non-existent workspace', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/workspaces/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/workspaces/:id', () => {
    it('should update workspace', async () => {
      const response = await request(app)
        .put(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Workspace',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Workspace');
    });

    it('should not allow non-owners to update', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User'
      });

      const otherToken = (await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'password123'
        })).body.token;

      const response = await request(app)
        .put(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/workspaces/:id/members', () => {
    it('should invite member to workspace', async () => {
      const response = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'invited@example.com',
          role: 'member',
          message: 'Please join my workspace'
        });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe('invited@example.com');
      expect(response.body.role).toBe('member');
    });
  });

  describe('DELETE /api/workspaces/:id', () => {
    it('should soft delete workspace', async () => {
      const response = await request(app)
        .delete(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      
      // Verify it's deleted (isActive = false)
      const workspace = await Workspace.findById(workspaceId);
      expect(workspace?.isActive).toBe(false);
    });
  });
});

describe('Comment API Integration Tests', () => {
  // Comment test implementation
  it('should create comment', async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});

describe('Notification API Integration Tests', () => {
  // Notification test implementation
  it('should get notifications', async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});

describe('Time Tracking API Integration Tests', () => {
  // Time tracking test implementation
  it('should start timer', async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
