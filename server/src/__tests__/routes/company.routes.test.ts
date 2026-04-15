import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock authentication middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = { id: 'test-user-id', email: 'test@test.com', plan: 'Free', role: 'user' };
    next();
  }),
  AuthRequest: {},
}));

// Mock the validation schemas (may not exist)
vi.mock('../../validation/schemas.js', () => ({
  paginationSchema: {},
}));

// Helper to create a chainable query mock
function createChainableQuery(resolvedValue: any) {
  const chain: any = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(resolvedValue),
    distinct: vi.fn().mockResolvedValue([]),
  };
  return chain;
}

const mockFind = vi.fn();
const mockCountDocuments = vi.fn();

vi.mock('../../models/CustomAgent.model.js', () => ({
  CustomAgent: {
    find: mockFind,
    countDocuments: mockCountDocuments,
  },
  ICustomAgent: {},
}));

const { default: companyRoutes } = await import('../../routes/company.routes.js');

describe('Company Routes - Agent Hierarchy', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/company', companyRoutes);
    // Error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal server error',
      });
    });
    vi.clearAllMocks();
  });

  describe('GET /api/company/agents', () => {
    it('should return agents with hierarchy information', async () => {
      const mockAgentData = [
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
            isActive: true,
          }),
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
            isActive: true,
          }),
        },
      ];

      // First find call: main query for agents
      const mainQuery = createChainableQuery(mockAgentData);
      // Second find call: check which agents have reports
      const reportsQuery = createChainableQuery([]);
      reportsQuery.distinct = vi.fn().mockResolvedValue(['agent-1']);

      mockFind
        .mockReturnValueOnce(mainQuery)
        .mockReturnValueOnce(reportsQuery);
      mockCountDocuments.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/company/agents')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agents).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should return empty list when no agents exist', async () => {
      const emptyQuery = createChainableQuery([]);
      const reportsQuery = createChainableQuery([]);
      reportsQuery.distinct = vi.fn().mockResolvedValue([]);

      mockFind
        .mockReturnValueOnce(emptyQuery)
        .mockReturnValueOnce(reportsQuery);
      mockCountDocuments.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/company/agents')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agents).toEqual([]);
    });
  });
});
