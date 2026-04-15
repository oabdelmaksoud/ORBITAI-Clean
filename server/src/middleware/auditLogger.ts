import { logger } from '../utils/logger.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { AdminRequest } from './adminAuth.js';
import { AuthRequest } from './auth.js';

export interface AuditContext {
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>; // Additional context including before/after states
  status?: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  complianceTags?: string[]; // 'gdpr', 'hipaa', 'soc2', etc.
  context?: {
    requestId?: string;
    sessionId?: string;
    traceId?: string;
  };
}

/**
 * Middleware to log admin actions
 */
export async function logAudit(
  req: AdminRequest | AuthRequest,
  context: AuditContext
): Promise<void> {
  try {
    const userId = (req as AdminRequest).admin?.id || (req as AuthRequest).user?.id;
    const userEmail = (req as AdminRequest).admin?.email || (req as AuthRequest).user?.email;

    // Get IP address (handles proxies)
    const ipAddress = req.ip || 
                     (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                     req.socket.remoteAddress || 
                     undefined;

    await AuditLog.create({
      action: context.action,
      entityType: context.entityType,
      entityId: context.entityId,
      userId,
      userEmail,
      details: context.details || {},
      ipAddress,
      userAgent: req.get('user-agent'),
      context: context.context,
      status: context.status || 'success',
      errorMessage: context.errorMessage,
      complianceTags: context.complianceTags || []
    });
  } catch (error: unknown) {
    // Don't throw - audit logging should not break the request
    logger.error('Failed to log audit:', error);
  }
}

/**
 * Helper function to create audit log entry
 */
export async function createAuditLog(
  userId: string | undefined,
  userEmail: string | undefined,
  action: string,
  entityType: string,
  entityId: string | undefined,
  details?: Record<string, any>,
  status: 'success' | 'failed' | 'pending' = 'success',
  errorMessage?: string
): Promise<void> {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId,
      userId,
      userEmail,
      details: details || {},
      status,
      errorMessage
    });
  } catch (error: unknown) {
    logger.error('Failed to create audit log:', error);
  }
}

