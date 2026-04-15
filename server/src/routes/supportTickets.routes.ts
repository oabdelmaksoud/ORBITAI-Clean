import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { SupportTicket, ISupportTicket } from '../models/SupportTicket.model.js';
import { ResponseTemplate } from '../models/SupportChat.model.js';
import { User } from '../models/User.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Validation schemas
const createTicketSchema = z
  .object({
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    category: z.enum(['billing', 'technical', 'account', 'general']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  })
  .strict();

const updateTicketSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    category: z.enum(['billing', 'technical', 'account', 'general']).optional(),
    assignedTo: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
  })
  .strict();

const addMessageSchema = z
  .object({
    content: z.string().min(1).max(10000),
    attachments: z.array(z.string()).optional(),
  })
  .strict();

const addNoteSchema = z
  .object({
    content: z.string().min(1).max(5000),
  })
  .strict();

const templateSchema = z
  .object({
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    shortcut: z.string().min(1).max(20),
    content: z.string().min(1).max(5000),
    variables: z.array(z.string()).optional(),
  })
  .strict();

// Helper function to add history entry
function addHistoryEntry(
  ticket: ISupportTicket,
  action: string,
  performedBy: string,
  performedByName: string,
  details: string,
  previousValue?: string,
  newValue?: string
) {
  ticket.history.push({
    id: uuidv4(),
    action,
    performedBy,
    performedByName,
    details,
    previousValue,
    newValue,
    createdAt: new Date(),
  });
}

// ==================== USER ENDPOINTS ====================

/**
 * POST /api/support/tickets
 * Create a new support ticket (user)
 */
router.post(
  '/tickets',
  authenticateToken,
  validate(createTicketSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { subject, description, category, priority } = req.body;
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', 401);
      }

      const ticket = new SupportTicket({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        subject,
        description,
        category: category || 'general',
        priority: priority || 'medium',
        messages: [
          {
            id: uuidv4(),
            sender: 'user',
            senderId: user.id,
            senderName: user.name,
            content: description,
            createdAt: new Date(),
          },
        ],
        history: [
          {
            id: uuidv4(),
            action: 'created',
            performedBy: user.id,
            performedByName: user.name,
            details: 'Ticket created',
            createdAt: new Date(),
          },
        ],
      });

      await ticket.save();

      logger.info(`[Support] Ticket ${ticket.ticketNumber} created by user ${user.email}`);

      res.status(201).json({
        success: true,
        data: { ticket },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/support/tickets/my
 * Get user's own tickets
 */
router.get('/tickets/my', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query: any = { userId };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-internalNotes')
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/support/tickets/my/:id
 * Get a specific ticket (user - own ticket only)
 */
router.get('/tickets/my/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const ticket = await SupportTicket.findOne({
      $or: [{ _id: id }, { ticketNumber: id }],
      userId,
    })
      .select('-internalNotes')
      .lean();

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    res.json({
      success: true,
      data: { ticket },
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/support/tickets/my/:id/messages
 * Add a message to own ticket (user)
 */
router.post(
  '/tickets/my/:id/messages',
  authenticateToken,
  validate(addMessageSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { content, attachments } = req.body;
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', 401);
      }

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: id }, { ticketNumber: id }],
        userId: user.id,
      });

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      if (ticket.status === 'closed') {
        throw new AppError('Cannot add message to closed ticket', 400);
      }

      ticket.messages.push({
        id: uuidv4(),
        sender: 'user',
        senderId: user.id,
        senderName: user.name,
        content,
        attachments,
        createdAt: new Date(),
      });

      // If ticket was waiting on customer, move to in_progress
      if (ticket.status === 'waiting_on_customer') {
        const previousStatus = ticket.status;
        ticket.status = 'in_progress';
        addHistoryEntry(
          ticket,
          'status_changed',
          user.id,
          user.name,
          'Status changed due to customer response',
          previousStatus,
          'in_progress'
        );
      }

      addHistoryEntry(ticket, 'message_added', user.id, user.name, 'Customer added a message');

      await ticket.save();

      res.json({
        success: true,
        data: { ticket: { ...ticket.toObject(), internalNotes: undefined } },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/support/admin/tickets
 * Get all tickets (admin)
 */
router.get(
  '/admin/tickets',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const {
        status,
        priority,
        category,
        assignedTo,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const query: any = {};
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (category) query.category = category;
      if (assignedTo === 'unassigned') {
        query.assignedTo = { $exists: false };
      } else if (assignedTo === 'me') {
        query.assignedTo = req.user?.id;
      } else if (assignedTo) {
        query.assignedTo = assignedTo;
      }
      if (search) {
        const safeSearch = (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { ticketNumber: { $regex: safeSearch, $options: 'i' } },
          { subject: { $regex: safeSearch, $options: 'i' } },
          { userEmail: { $regex: safeSearch, $options: 'i' } },
          { userName: { $regex: safeSearch, $options: 'i' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const sort: any = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

      const [tickets, total, stats] = await Promise.all([
        SupportTicket.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
        SupportTicket.countDocuments(query),
        SupportTicket.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const statusCounts = stats.reduce((acc: any, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          tickets,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
          stats: {
            total,
            byStatus: statusCounts,
          },
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/support/admin/tickets/stats
 * Get ticket statistics (admin)
 */
router.get(
  '/admin/tickets/stats',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res, next) => {
    try {
      const [statusStats, priorityStats, categoryStats, agentStats, recentTickets] =
        await Promise.all([
          SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
          SupportTicket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
          SupportTicket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
          SupportTicket.aggregate([
            { $match: { assignedTo: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: '$assignedTo',
                assignedToName: { $first: '$assignedToName' },
                count: { $sum: 1 },
              },
            },
          ]),
          SupportTicket.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('ticketNumber subject status priority createdAt userName')
            .lean(),
        ]);

      const total = await SupportTicket.countDocuments();
      const unassigned = await SupportTicket.countDocuments({ assignedTo: { $exists: false } });

      res.json({
        success: true,
        data: {
          total,
          unassigned,
          byStatus: statusStats.reduce(
            (acc: any, { _id, count }) => ({ ...acc, [_id]: count }),
            {}
          ),
          byPriority: priorityStats.reduce(
            (acc: any, { _id, count }) => ({ ...acc, [_id]: count }),
            {}
          ),
          byCategory: categoryStats.reduce(
            (acc: any, { _id, count }) => ({ ...acc, [_id]: count }),
            {}
          ),
          byAgent: agentStats,
          recentTickets,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/support/admin/tickets/:id
 * Get a specific ticket with full details (admin)
 */
router.get(
  '/admin/tickets/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: id }, { ticketNumber: id }],
      }).lean();

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      // Get user's other tickets for context
      const userTickets = await SupportTicket.find({
        userId: ticket.userId,
        _id: { $ne: ticket._id },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('ticketNumber subject status createdAt')
        .lean();

      // Get user info
      const user = await User.findById(ticket.userId)
        .select('name email plan role createdAt lastLogin')
        .lean();

      res.json({
        success: true,
        data: {
          ticket,
          userContext: {
            user,
            recentTickets: userTickets,
          },
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * PUT /api/support/admin/tickets/:id
 * Update a ticket (admin)
 */
router.put(
  '/admin/tickets/:id',
  authenticateToken,
  requireAdmin,
  validate(updateTicketSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { status, priority, category, assignedTo, tags } = req.body;
      const admin = req.user;

      if (!admin) {
        throw new AppError('Admin not authenticated', 401);
      }

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: id }, { ticketNumber: id }],
      });

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      // Track changes for history
      if (status && status !== ticket.status) {
        addHistoryEntry(
          ticket,
          'status_changed',
          admin.id,
          admin.name,
          `Status changed from ${ticket.status} to ${status}`,
          ticket.status,
          status
        );
        ticket.status = status;

        if (status === 'resolved') {
          ticket.resolvedAt = new Date();
        } else if (status === 'closed') {
          ticket.closedAt = new Date();
        }
      }

      if (priority && priority !== ticket.priority) {
        addHistoryEntry(
          ticket,
          'priority_changed',
          admin.id,
          admin.name,
          `Priority changed from ${ticket.priority} to ${priority}`,
          ticket.priority,
          priority
        );
        ticket.priority = priority;
      }

      if (category && category !== ticket.category) {
        addHistoryEntry(
          ticket,
          'category_changed',
          admin.id,
          admin.name,
          `Category changed from ${ticket.category} to ${category}`,
          ticket.category,
          category
        );
        ticket.category = category;
      }

      if (assignedTo !== undefined) {
        if (assignedTo === null) {
          addHistoryEntry(
            ticket,
            'unassigned',
            admin.id,
            admin.name,
            `Ticket unassigned from ${ticket.assignedToName || 'unknown'}`
          );
          ticket.assignedTo = undefined;
          ticket.assignedToName = undefined;
        } else if (assignedTo !== ticket.assignedTo) {
          const assignee = await User.findById(assignedTo).select('name').lean();
          if (!assignee) {
            throw new AppError('Assignee not found', 404);
          }
          addHistoryEntry(
            ticket,
            'assigned',
            admin.id,
            admin.name,
            `Ticket assigned to ${assignee.name}`,
            ticket.assignedToName,
            assignee.name
          );
          ticket.assignedTo = assignedTo;
          ticket.assignedToName = assignee.name;
        }
      }

      if (tags) {
        ticket.tags = tags;
        addHistoryEntry(ticket, 'tags_updated', admin.id, admin.name, `Tags updated`);
      }

      await ticket.save();

      logger.info(`[Support] Ticket ${ticket.ticketNumber} updated by admin ${admin.email}`);

      res.json({
        success: true,
        data: { ticket },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/support/admin/tickets/:id/messages
 * Add a message to ticket (admin)
 */
router.post(
  '/admin/tickets/:id/messages',
  authenticateToken,
  requireAdmin,
  validate(addMessageSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { content, attachments } = req.body;
      const admin = req.user;

      if (!admin) {
        throw new AppError('Admin not authenticated', 401);
      }

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: id }, { ticketNumber: id }],
      });

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      ticket.messages.push({
        id: uuidv4(),
        sender: 'agent',
        senderId: admin.id,
        senderName: admin.name,
        content,
        attachments,
        createdAt: new Date(),
      });

      // Track first response time
      if (!ticket.firstResponseAt) {
        ticket.firstResponseAt = new Date();
      }

      // Auto-update status if open
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
        addHistoryEntry(
          ticket,
          'status_changed',
          admin.id,
          admin.name,
          'Status changed to in_progress on first response',
          'open',
          'in_progress'
        );
      }

      addHistoryEntry(ticket, 'message_added', admin.id, admin.name, 'Agent added a response');

      await ticket.save();

      res.json({
        success: true,
        data: { ticket },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/support/admin/tickets/:id/notes
 * Add an internal note (admin)
 */
router.post(
  '/admin/tickets/:id/notes',
  authenticateToken,
  requireAdmin,
  validate(addNoteSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const admin = req.user;

      if (!admin) {
        throw new AppError('Admin not authenticated', 401);
      }

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: id }, { ticketNumber: id }],
      });

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      ticket.internalNotes.push({
        id: uuidv4(),
        agentId: admin.id,
        agentName: admin.name,
        content,
        createdAt: new Date(),
      });

      addHistoryEntry(ticket, 'note_added', admin.id, admin.name, 'Internal note added');

      await ticket.save();

      res.json({
        success: true,
        data: { ticket },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/support/admin/tickets/bulk
 * Bulk actions on tickets (admin)
 */
router.post(
  '/admin/tickets/bulk',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const { ticketIds, action, value } = req.body;
      const admin = req.user;

      if (!admin) {
        throw new AppError('Admin not authenticated', 401);
      }

      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        throw new AppError('No tickets specified', 400);
      }

      let updateData: any = {};
      let historyAction = '';
      let historyDetails = '';

      switch (action) {
        case 'assign':
          const assignee = await User.findById(value).select('name').lean();
          if (!assignee) throw new AppError('Assignee not found', 404);
          updateData = { assignedTo: value, assignedToName: assignee.name };
          historyAction = 'bulk_assigned';
          historyDetails = `Bulk assigned to ${assignee.name}`;
          break;
        case 'unassign':
          updateData = { $unset: { assignedTo: 1, assignedToName: 1 } };
          historyAction = 'bulk_unassigned';
          historyDetails = 'Bulk unassigned';
          break;
        case 'status':
          updateData = { status: value };
          historyAction = 'bulk_status_changed';
          historyDetails = `Bulk status changed to ${value}`;
          break;
        case 'priority':
          updateData = { priority: value };
          historyAction = 'bulk_priority_changed';
          historyDetails = `Bulk priority changed to ${value}`;
          break;
        default:
          throw new AppError('Invalid action', 400);
      }

      const result = await SupportTicket.updateMany(
        { _id: { $in: ticketIds } },
        {
          ...updateData,
          $push: {
            history: {
              id: uuidv4(),
              action: historyAction,
              performedBy: admin.id,
              performedByName: admin.name,
              details: historyDetails,
              createdAt: new Date(),
            },
          },
        }
      );

      logger.info(
        `[Support] Bulk action ${action} on ${result.modifiedCount} tickets by admin ${admin.email}`
      );

      res.json({
        success: true,
        data: { modifiedCount: result.modifiedCount },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

// ==================== RESPONSE TEMPLATES ====================

/**
 * GET /api/support/admin/templates
 * Get all response templates (admin)
 */
router.get(
  '/admin/templates',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const { category, search } = req.query;

      const query: any = { isActive: true };
      if (category) query.category = category;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { shortcut: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
        ];
      }

      const templates = await ResponseTemplate.find(query).sort({ category: 1, name: 1 }).lean();

      res.json({
        success: true,
        data: { templates },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/support/admin/templates
 * Create a response template (admin)
 */
router.post(
  '/admin/templates',
  authenticateToken,
  requireAdmin,
  validate(templateSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { name, category, shortcut, content, variables } = req.body;
      const admin = req.user;

      if (!admin) {
        throw new AppError('Admin not authenticated', 401);
      }

      // Check for duplicate shortcut
      const existing = await ResponseTemplate.findOne({ shortcut });
      if (existing) {
        throw new AppError('Shortcut already exists', 400);
      }

      const template = new ResponseTemplate({
        name,
        category,
        shortcut,
        content,
        variables: variables || [],
        createdBy: admin.id,
      });

      await template.save();

      res.status(201).json({
        success: true,
        data: { template },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * PUT /api/support/admin/templates/:id
 * Update a response template (admin)
 */
router.put(
  '/admin/templates/:id',
  authenticateToken,
  requireAdmin,
  validate(templateSchema.partial()),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const template = await ResponseTemplate.findByIdAndUpdate(id, updates, { new: true });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      res.json({
        success: true,
        data: { template },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * DELETE /api/support/admin/templates/:id
 * Delete a response template (admin)
 */
router.delete(
  '/admin/templates/:id',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const template = await ResponseTemplate.findByIdAndDelete(id);

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      res.json({
        success: true,
        message: 'Template deleted',
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/support/admin/templates/:id/use
 * Track template usage (admin)
 */
router.post(
  '/admin/templates/:id/use',
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      await ResponseTemplate.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });

      res.json({
        success: true,
        message: 'Usage tracked',
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

export default router;
