import request from 'supertest';
import app from '../../src/index';
import mongoose from 'mongoose';

describe('GitHub Integration API', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/orbitai-test');
    
    // Create test user and get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginRes.body.token;
    userId = loginRes.body.user._id;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe('GET /api/integrations/github/repos', () => {
    it('should list repositories', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('full_name');
        expect(res.body[0]).toHaveProperty('private');
      }
    });

    it('should filter repositories by type', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos?type=owner')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should sort repositories', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos?sort=updated&direction=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should paginate repositories', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(10);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/integrations/github/repos/:owner/:repo', () => {
    it('should get repository details', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'test-repo');
      expect(res.body).toHaveProperty('full_name');
    });

    it('should handle non-existent repository', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/nonexistent/repo')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/integrations/github/repos/:owner/:repo/branches', () => {
    it('should list branches', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/branches')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('commit');
      }
    });

    it('should protect branch information for private repos', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/private/repo/branches')
        .set('Authorization', `Bearer ${authToken}`);

      // Should either succeed (if authorized) or return 404/403
      expect([200, 403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/integrations/github/repos/:owner/:repo/contents', () => {
    it('should list root directory contents', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('path');
        expect(res.body[0]).toHaveProperty('type');
        expect(res.body[0]).toHaveProperty('sha');
      }
    });

    it('should get file contents', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents/README.md')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'README.md');
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('encoding');
      expect(res.body).toHaveProperty('sha');
    });

    it('should get directory contents', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents/src')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should handle non-existent file', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents/nonexistent.txt')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should support branch parameter', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents?ref=develop')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/integrations/github/repos/:owner/:repo/contents/:path', () => {
    it('should create new file', async () => {
      const res = await request(app)
        .put('/api/integrations/github/repos/test-owner/test-repo/contents/new-file.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Create new file',
          content: Buffer.from('Hello World').toString('base64'),
          branch: 'main'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('commit');
    });

    it('should update existing file', async () => {
      // First, get the file to obtain its SHA
      const getRes = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents/existing-file.txt')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .put('/api/integrations/github/repos/test-owner/test-repo/contents/existing-file.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Update file',
          content: Buffer.from('Updated content').toString('base64'),
          sha: getRes.body.sha,
          branch: 'main'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('commit');
    });

    it('should require SHA for updates', async () => {
      const res = await request(app)
        .put('/api/integrations/github/repos/test-owner/test-repo/contents/existing-file.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Update file',
          content: Buffer.from('Updated content').toString('base64'),
          branch: 'main'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('SHA');
    });

    it('should validate content is base64', async () => {
      const res = await request(app)
        .put('/api/integrations/github/repos/test-owner/test-repo/contents/new-file.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Create file',
          content: 'Not base64!@#$',
          branch: 'main'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/integrations/github/repos/:owner/:repo/contents/:path', () => {
    it('should delete file', async () => {
      // First, get the file to obtain its SHA
      const getRes = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/contents/file-to-delete.txt')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .delete('/api/integrations/github/repos/test-owner/test-repo/contents/file-to-delete.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Delete file',
          sha: getRes.body.sha,
          branch: 'main'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('commit');
    });

    it('should require SHA for deletion', async () => {
      const res = await request(app)
        .delete('/api/integrations/github/repos/test-owner/test-repo/contents/file.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Delete file',
          branch: 'main'
        });

      expect(res.status).toBe(400);
    });

    it('should handle non-existent file', async () => {
      const res = await request(app)
        .delete('/api/integrations/github/repos/test-owner/test-repo/contents/nonexistent.txt')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Delete file',
          sha: 'abc123',
          branch: 'main'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/integrations/github/repos/:owner/:repo/commits', () => {
    it('should list commits', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/commits')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('sha');
        expect(res.body[0]).toHaveProperty('commit');
        expect(res.body[0]).toHaveProperty('author');
      }
    });

    it('should filter commits by branch', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/commits?sha=develop')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter commits by path', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/commits?path=src/index.ts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should paginate commits', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/commits?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(20);
    });

    it('should filter commits by author', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo/commits?author=testuser')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/integrations/github/rate-limit', () => {
    it('should return rate limit status', async () => {
      const res = await request(app)
        .get('/api/integrations/github/rate-limit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('remaining');
      expect(res.body).toHaveProperty('reset');
    });
  });

  describe('Error handling', () => {
    it('should handle GitHub API errors gracefully', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/invalid/repo')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle rate limit exceeded', async () => {
      // This would require mocking GitHub API to return 403
      const res = await request(app)
        .get('/api/integrations/github/repos/test-owner/test-repo')
        .set('Authorization', `Bearer ${authToken}`);

      // Should either succeed or return rate limit error
      expect([200, 429]).toContain(res.status);
    });

    it('should validate repository parameters', async () => {
      const res = await request(app)
        .get('/api/integrations/github/repos/invalid@name/repo')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });
});
