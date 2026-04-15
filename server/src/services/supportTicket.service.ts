/**
 * Support Ticket Service
 * Business logic for ticket management, auto-assignment, and SLA tracking
 */

import { SupportTicket, ISupportTicket, TicketPriority } from '../models/SupportTicket.model.js';
import { User } from '../models/User.model.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// SLA Configuration (in hours)
const SLA_CONFIG = {
  urgent: { firstResponse: 1, resolution: 4 },
  high: { firstResponse: 4, resolution: 24 },
  medium: { firstResponse: 8, resolution: 48 },
  low: { firstResponse: 24, resolution: 72 },
};

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  waitingOnCustomer: number;
  resolved: number;
  closed: number;
  unassigned: number;
  breachedSLA: number;
  avgFirstResponseTime: number;
  avgResolutionTime: number;
}

export interface AgentWorkload {
  agentId: string;
  agentName: string;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  avgResponseTime: number;
}

class SupportTicketService {
  /**
   * Get comprehensive ticket statistics
   */
  async getTicketStats(): Promise<TicketStats> {
    const [statusCounts, unassignedCount, breachedCount, avgTimes] = await Promise.all([
      SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      SupportTicket.countDocuments({
        assignedTo: { $exists: false },
        status: { $in: ['open', 'in_progress'] },
      }),
      this.getBreachedSLACount(),
      this.getAverageResponseTimes(),
    ]);

    const statusMap = statusCounts.reduce((acc: any, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    return {
      total: Object.values(statusMap).reduce((sum: number, count: any) => sum + count, 0),
      open: statusMap.open || 0,
      inProgress: statusMap.in_progress || 0,
      waitingOnCustomer: statusMap.waiting_on_customer || 0,
      resolved: statusMap.resolved || 0,
      closed: statusMap.closed || 0,
      unassigned: unassignedCount,
      breachedSLA: breachedCount,
      avgFirstResponseTime: avgTimes.avgFirstResponse,
      avgResolutionTime: avgTimes.avgResolution,
    };
  }

  /**
   * Get count of tickets that have breached SLA
   */
  async getBreachedSLACount(): Promise<number> {
    const now = new Date();
    let breachedCount = 0;

    // Check tickets without first response
    for (const priority of ['urgent', 'high', 'medium', 'low'] as TicketPriority[]) {
      const slaHours = SLA_CONFIG[priority].firstResponse;
      const threshold = new Date(now.getTime() - slaHours * 60 * 60 * 1000);

      const count = await SupportTicket.countDocuments({
        priority,
        status: { $in: ['open', 'in_progress'] },
        firstResponseAt: { $exists: false },
        createdAt: { $lt: threshold },
      });
      breachedCount += count;
    }

    return breachedCount;
  }

  /**
   * Get average response times
   */
  async getAverageResponseTimes(): Promise<{ avgFirstResponse: number; avgResolution: number }> {
    const result = await SupportTicket.aggregate([
      {
        $match: {
          firstResponseAt: { $exists: true },
        },
      },
      {
        $project: {
          firstResponseTime: {
            $divide: [
              { $subtract: ['$firstResponseAt', '$createdAt'] },
              1000 * 60, // Convert to minutes
            ],
          },
          resolutionTime: {
            $cond: {
              if: { $and: [{ $eq: ['$status', 'resolved'] }, '$resolvedAt'] },
              then: {
                $divide: [
                  { $subtract: ['$resolvedAt', '$createdAt'] },
                  1000 * 60, // Convert to minutes
                ],
              },
              else: null,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          avgFirstResponse: { $avg: '$firstResponseTime' },
          avgResolution: { $avg: '$resolutionTime' },
        },
      },
    ]);

    return {
      avgFirstResponse: result[0]?.avgFirstResponse || 0,
      avgResolution: result[0]?.avgResolution || 0,
    };
  }

  /**
   * Get agent workload statistics
   */
  async getAgentWorkloads(): Promise<AgentWorkload[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const workloads = await SupportTicket.aggregate([
      {
        $match: {
          assignedTo: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          assignedToName: { $first: '$assignedToName' },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] },
          },
          inProgressTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
          },
          resolvedToday: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ['$status', 'resolved'] }, { $gte: ['$resolvedAt', today] }],
                },
                1,
                0,
              ],
            },
          },
          totalResponseTime: {
            $sum: {
              $cond: {
                if: '$firstResponseAt',
                then: { $subtract: ['$firstResponseAt', '$createdAt'] },
                else: 0,
              },
            },
          },
          ticketsWithResponse: {
            $sum: { $cond: ['$firstResponseAt', 1, 0] },
          },
        },
      },
      {
        $project: {
          agentId: '$_id',
          agentName: '$assignedToName',
          openTickets: 1,
          inProgressTickets: 1,
          resolvedToday: 1,
          avgResponseTime: {
            $cond: {
              if: { $gt: ['$ticketsWithResponse', 0] },
              then: {
                $divide: [
                  '$totalResponseTime',
                  { $multiply: ['$ticketsWithResponse', 1000 * 60] }, // Convert to minutes
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    return workloads;
  }

  /**
   * Auto-assign ticket to least busy agent
   */
  async autoAssignTicket(ticketId: string): Promise<ISupportTicket | null> {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket || ticket.assignedTo) {
      return ticket;
    }

    // Get all available agents (admins/superadmins)
    const agents = (await User.find({
      role: { $in: ['admin', 'superadmin'] },
      isActive: true,
    })
      .select('_id name')
      .lean()) as any;

    if (agents.length === 0) {
      logger.warn('[Support] No available agents for auto-assignment');
      return ticket;
    }

    // Get current workload for each agent
    const workloads = await SupportTicket.aggregate([
      {
        $match: {
          assignedTo: { $in: agents.map((a: any) => a._id?.toString()) },
          status: { $in: ['open', 'in_progress', 'waiting_on_customer'] },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 },
        },
      },
    ]);

    const workloadMap = workloads.reduce((acc: any, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    // Find agent with lowest workload
    let minWorkload = Infinity;
    let selectedAgent: any = null;

    for (const agent of agents) {
      const agentId = agent._id?.toString();
      const workload = workloadMap[agentId] || 0;
      if (workload < minWorkload) {
        minWorkload = workload;
        selectedAgent = agent;
      }
    }

    if (selectedAgent) {
      ticket.assignedTo = selectedAgent._id?.toString();
      ticket.assignedToName = selectedAgent.name;
      ticket.history.push({
        id: uuidv4(),
        action: 'auto_assigned',
        performedBy: 'system',
        performedByName: 'System',
        details: `Auto-assigned to ${selectedAgent.name}`,
        createdAt: new Date(),
      });
      await ticket.save();
      logger.info(`[Support] Ticket ${ticket.ticketNumber} auto-assigned to ${selectedAgent.name}`);
    }

    return ticket;
  }

  /**
   * Get tickets approaching SLA breach
   */
  async getTicketsApproachingSLA(hoursThreshold: number = 2): Promise<ISupportTicket[]> {
    const now = new Date();
    const tickets: ISupportTicket[] = [];

    for (const priority of ['urgent', 'high', 'medium', 'low'] as TicketPriority[]) {
      const slaHours = SLA_CONFIG[priority].firstResponse;
      const warningThreshold = new Date(
        now.getTime() - (slaHours - hoursThreshold) * 60 * 60 * 1000
      );

      const approachingTickets = (await SupportTicket.find({
        priority,
        status: { $in: ['open', 'in_progress'] },
        firstResponseAt: { $exists: false },
        createdAt: { $lt: warningThreshold },
      }).lean()) as any;

      tickets.push(...(approachingTickets as ISupportTicket[]));
    }

    return tickets;
  }

  /**
   * Get ticket metrics for a date range
   */
  async getTicketMetrics(startDate: Date, endDate: Date): Promise<any> {
    const metrics = await SupportTicket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $facet: {
          byDay: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                created: { $sum: 1 },
                resolved: {
                  $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byCategory: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
              },
            },
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                resolved: {
                  $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
                },
                avgFirstResponse: {
                  $avg: {
                    $cond: {
                      if: '$firstResponseAt',
                      then: { $subtract: ['$firstResponseAt', '$createdAt'] },
                      else: null,
                    },
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    return metrics[0];
  }

  /**
   * Search tickets with full-text search
   */
  async searchTickets(query: string, filters: any = {}): Promise<ISupportTicket[]> {
    const searchQuery: any = {
      $or: [
        { ticketNumber: { $regex: query, $options: 'i' } },
        { subject: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { userName: { $regex: query, $options: 'i' } },
        { userEmail: { $regex: query, $options: 'i' } },
        { 'messages.content': { $regex: query, $options: 'i' } },
      ],
    };

    if (filters.status) searchQuery.status = filters.status;
    if (filters.priority) searchQuery.priority = filters.priority;
    if (filters.category) searchQuery.category = filters.category;
    if (filters.assignedTo) searchQuery.assignedTo = filters.assignedTo;

    return SupportTicket.find(searchQuery)
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean() as unknown as Promise<ISupportTicket[]>;
  }

  /**
   * Get SLA status for a ticket
   */
  getSLAStatus(ticket: ISupportTicket): {
    firstResponse: { deadline: Date; breached: boolean; remaining: number };
    resolution: { deadline: Date; breached: boolean; remaining: number };
  } {
    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const sla = SLA_CONFIG[ticket.priority];

    const firstResponseDeadline = new Date(
      createdAt.getTime() + sla.firstResponse * 60 * 60 * 1000
    );
    const resolutionDeadline = new Date(createdAt.getTime() + sla.resolution * 60 * 60 * 1000);

    const firstResponseBreached = !ticket.firstResponseAt && now > firstResponseDeadline;
    const resolutionBreached =
      !['resolved', 'closed'].includes(ticket.status) && now > resolutionDeadline;

    return {
      firstResponse: {
        deadline: firstResponseDeadline,
        breached: firstResponseBreached,
        remaining: Math.max(0, firstResponseDeadline.getTime() - now.getTime()) / (1000 * 60), // minutes
      },
      resolution: {
        deadline: resolutionDeadline,
        breached: resolutionBreached,
        remaining: Math.max(0, resolutionDeadline.getTime() - now.getTime()) / (1000 * 60), // minutes
      },
    };
  }
}

export const supportTicketService = new SupportTicketService();
