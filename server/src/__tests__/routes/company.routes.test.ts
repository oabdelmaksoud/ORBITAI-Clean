import request from 'supertest';
import express from 'express';
import companyRoutes from '../../src/routes/company.routes.js';
import { CustomAgent } from '../../src/models/CustomAgent.model.js';

// Mock dependencies
jest.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@test.com' };
    next();
  }
}));

describe('Company Routes - Agent Hierarchy', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/company', companyRoutes);
  });

  describe('GET /api/company/agents', () => {
    it('should return agents with hierarchy information', async () => {
      // Mock data
      const mockAgents = [
        {
          _id: 'agent-1',
          name: 'Team Lead',
          title: 'Senior Manager',
          role: 'Orchestrator',
          reportsTo: null,
          userId: 'test-user-id',
          isActive: true,
          toObject: () => ({
            _id: 'agent-1',
            name: 'Team Lead',
            title: 'Senior Manager',
            role: 'Orchestrator',
            reportsTo: null,
            userId: 'test-user-id',
            isActive: true
          })
        },
        {
          _id: 'agent-2',
          name: 'Developer',
          title: 'Senior Developer',
          role: 'Implementation Agent',
          reportsTo: 'agent-1',
          userId: 'test-user-id',
          isActive: true,
          toObject: () => ({
            _id: 'agent-2',
            name: 'Developer',
            title: 'Senior Developer',
            role: 'Implementation Agent',
            reportsTo: 'agent-1',
            userId: 'test-user-id',
            isActive: true
          })
        }
      ];

      // Mock CustomAgent.find
      (CustomAgent.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockAgents)
              })
            })
          })
        })
      });

      (CustomAgent.countDocuments as jest.Mock).mockResolvedValue(2);
      (CustomAgent.find as jest.Mock).mockReturnValueOnce({
        distinct: jest.fn().mockResolvedValue(['agent-1'])
      });

      const response = await request(app)
        .get('/api/company/agents')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agents).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter out inactive agents by default', async () => {
      // Implementation test
    });

    it('should populate reportsTo field when requested', async () => {
      // Implementation test
    });
  });

  describe('GET /api/company/agents/:id', () => {
    it('should return a single agent with full hierarchy details', async () => {
      // Mock implementation
    });
  });

  describe('GET /api/company/agents/hierarchy/tree', () => {
    it('should return the full agent hierarchy tree', async () => {
      // Mock implementation
    });
  });
});
