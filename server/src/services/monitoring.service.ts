import { Session } from '../models/Session.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { queueService } from './queue.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

interface ActiveSession {
  id: string;
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

interface ActiveRequest {
  id: string;
  method: string;
  path: string;
  userId?: string;
  startedAt: Date;
  duration: number;
}

interface SystemMetrics {
  activeSessions: number;
  activeRequests: number;
  queueSize: number;
  queuePending: number;
  queueProcessing: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  timestamp: Date;
}

/**
 * Monitoring Service
 * Provides real-time monitoring capabilities
 */
export class MonitoringService {
  private activeRequests: Map<string, ActiveRequest> = new Map();
  private requestCounter = 0;

  /**
   * Track an active request
   */
  startRequest(method: string, path: string, userId?: string): string {
    const requestId = `req_${Date.now()}_${++this.requestCounter}`;
    this.activeRequests.set(requestId, {
      id: requestId,
      method,
      path,
      userId,
      startedAt: new Date(),
      duration: 0,
    });
    return requestId;
  }

  /**
   * End tracking for a request
   */
  endRequest(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (request) {
      request.duration = Date.now() - request.startedAt.getTime();
      // Remove after a short delay to allow viewing
      setTimeout(() => {
        this.activeRequests.delete(requestId);
      }, 5000);
    }
  }

  /**
   * Cancel an active request
   */
  cancelRequest(requestId: string): boolean {
    return this.activeRequests.delete(requestId);
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<ActiveSession[]> {
    try {
      const sessions = await Session.find({
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
        .sort({ lastActivity: -1 })
        .limit(100);

      return sessions.map((session: any) => ({
        id: session._id.toString(),
        userId: session.userId,
        userEmail: session.email,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
      })) as any;
    } catch (error: unknown) {
      throw new AppError(
        `Failed to get active sessions: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Kill a user session
   */
  async killSession(sessionId: string, adminId: string): Promise<void> {
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new AppError('Session not found', 404);
      }

      session.isActive = false;
      await session.save();

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'session_killed',
        entityType: 'session',
        details: {
          sessionId,
          targetUserId: session.userId,
        },
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true,
      });
    } catch (error: unknown) {
      throw new AppError(
        `Failed to kill session: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Get active requests
   */
  getActiveRequests(): ActiveRequest[] {
    return Array.from(this.activeRequests.values()).map(req => ({
      ...req,
      duration: Date.now() - req.startedAt.getTime(),
    }));
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<any> {
    try {
      if (!queueService) {
        return {
          available: false,
          message: 'Queue service not available',
        };
      }

      // Get queue stats if available
      const stats = (await (queueService as any).getStats?.()) || {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };

      return {
        available: true,
        ...stats,
      };
    } catch (error: unknown) {
      logger.error('Failed to get queue status:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear job queue
   */
  async clearQueue(adminId: string): Promise<void> {
    try {
      if (!queueService) {
        throw new AppError('Queue service not available', 400);
      }

      await (queueService as any).clear?.();

      // Log audit
      await AuditLog.create({
        userId: adminId,
        action: 'queue_cleared',
        entityType: 'queue',
        details: {},
        ipAddress: 'admin-console',
        userAgent: 'admin-console',
        success: true,
      });
    } catch (error: unknown) {
      throw new AppError(
        `Failed to clear queue: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const activeSessions = await Session.countDocuments({
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      const activeRequests = this.activeRequests.size;
      const queueStatus = await this.getQueueStatus();

      return {
        activeSessions,
        activeRequests,
        queueSize: queueStatus.waiting || 0,
        queuePending: queueStatus.waiting || 0,
        queueProcessing: queueStatus.active || 0,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      throw new AppError(
        `Failed to get system metrics: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }
}

export const monitoringService = new MonitoringService();
