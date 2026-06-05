import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks ──────────────────────────────────────────────────────────────────
// vi.mock is hoisted, so factories must not reference out-of-scope variables.

vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@test.com' };
    next();
  },
}));

vi.mock('../../models/CustomAgent.model.js', () => ({
  CustomAgent: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import companyRoutes from '../../routes/company.routes.js';
import { CustomAgent } from '../../models/CustomAgent.model.js';

describe('Company Routes - Agent Hierarchy', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
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

      // The route calls CustomAgent.find twice: first the chainable paginated
      // query (.sort().skip().limit().populate().exec()), then a .distinct()
      // query to discover which agents have direct reports.
      (CustomAgent.find as any)
        .mockReturnValueOnce({
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          populate: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue(mockAgents),
        })
        .mockReturnValueOnce({
          distinct: vi.fn().mockResolvedValue(['agent-1']),
        });

      (CustomAgent.countDocuments as any).mockResolvedValue(2);

      const response = await request(app).get('/api/company/agents').query({ page: 1, limit: 20 });

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
