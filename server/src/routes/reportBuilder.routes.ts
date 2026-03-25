import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { User } from '../models/User.model.js';
import { Project } from '../models/Project.model.js';
import { ActivityEvent } from '../models/ActivityEvent.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { AppError } from '../middleware/errorHandler.js';

import { FilterQuery } from 'mongoose';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/reports/generate
 * Generate a custom report based on configuration
 */
router.post('/generate', async (req: AdminRequest, res, next) => {
  try {
    const {
      name,
      dataSource,
      metrics,
      filters,
      groupBy,
      dateRange,
      format = 'json'
    } = req.body;

    if (!dataSource || !metrics || !Array.isArray(metrics) || metrics.length === 0) {
      throw new AppError('dataSource and metrics are required', 400);
    }

    const startDate = dateRange?.start ? new Date(dateRange.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end ? new Date(dateRange.end) : new Date();

    let reportData: any = {};

    // Generate report based on data source
    switch (dataSource) {
      case 'users':
        reportData = await generateUserReport(metrics, filters, groupBy, startDate, endDate);
        break;
      case 'projects':
        reportData = await generateProjectReport(metrics, filters, groupBy, startDate, endDate);
        break;
      case 'activity':
        reportData = await generateActivityReport(metrics, filters, groupBy, startDate, endDate);
        break;
      case 'audit':
        reportData = await generateAuditReport(metrics, filters, groupBy, startDate, endDate);
        break;
      default:
        throw new AppError(`Unknown data source: ${dataSource}`, 400);
    }

    // Format response based on requested format
    if (format === 'csv') {
      const csv = convertToCSV(reportData, name || 'report');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${name || 'report'}-${Date.now()}.csv"`);
      res.send(csv);
      return;
    }

    res.json({
      success: true,
      data: {
        name: name || 'Custom Report',
        generatedAt: new Date().toISOString(),
        dataSource,
        metrics,
        filters,
        groupBy,
        dateRange: { start: startDate, end: endDate },
        results: reportData
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/reports/templates
 * Get available report templates
 */
router.get('/templates', async (_req: AdminRequest, res, next) => {
  try {
    const templates = [
      {
        id: 'user-growth',
        name: 'User Growth Report',
        description: 'Track user signups and growth over time',
        dataSource: 'users',
        metrics: ['signups', 'activeUsers', 'churn'],
        defaultGroupBy: 'month',
        defaultDateRange: { days: 90 }
      },
      {
        id: 'project-activity',
        name: 'Project Activity Report',
        description: 'Analyze project creation and activity patterns',
        dataSource: 'projects',
        metrics: ['created', 'active', 'byPhase'],
        defaultGroupBy: 'week',
        defaultDateRange: { days: 30 }
      },
      {
        id: 'user-engagement',
        name: 'User Engagement Report',
        description: 'Measure user engagement and activity levels',
        dataSource: 'activity',
        metrics: ['loginCount', 'actionCount', 'avgSessionDuration'],
        defaultGroupBy: 'day',
        defaultDateRange: { days: 7 }
      },
      {
        id: 'audit-summary',
        name: 'Audit Summary Report',
        description: 'Summary of system actions and changes',
        dataSource: 'audit',
        metrics: ['actionCount', 'byType', 'byUser'],
        defaultGroupBy: 'day',
        defaultDateRange: { days: 30 }
      }
    ];

    res.json({
      success: true,
      data: { templates }
    });
  } catch (error: any) {
    next(error);
  }
});

// Helper functions

async function generateUserReport(
  metrics: string[],
  filters: any,
  groupBy: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const query: FilterQuery<any> = {};
  if (filters?.plan) query.plan = filters.plan;
  if (filters?.role) query.role = filters.role;
  if (filters?.isActive !== undefined) query.isActive = filters.isActive;

  const users = await User.find({
    ...query,
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();

  const report: any = {
    totalUsers: users.length,
    metrics: {}
  };

  if (metrics.includes('signups')) {
    report.metrics.signups = users.length;
  }

  if (metrics.includes('byPlan')) {
    const byPlan = users.reduce((acc: any, user) => {
      acc[user.plan] = (acc[user.plan] || 0) + 1;
      return acc;
    }, {});
    report.metrics.byPlan = byPlan;
  }

  if (metrics.includes('byRole')) {
    const byRole = users.reduce((acc: any, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    report.metrics.byRole = byRole;
  }

  if (groupBy) {
    report.grouped = groupUsersBy(users, groupBy);
  }

  return report;
}

async function generateProjectReport(
  metrics: string[],
  filters: any,
  groupBy: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const query: FilterQuery<any> = {};
  if (filters?.phase) query.currentPhase = filters.phase;
  if (filters?.methodology) query.methodology = filters.methodology;

  const projects = await Project.find({
    ...query,
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();

  const report: any = {
    totalProjects: projects.length,
    metrics: {}
  };

  if (metrics.includes('created')) {
    report.metrics.created = projects.length;
  }

  if (metrics.includes('byPhase')) {
    const byPhase = projects.reduce((acc: any, project) => {
      acc[project.currentPhase] = (acc[project.currentPhase] || 0) + 1;
      return acc;
    }, {});
    report.metrics.byPhase = byPhase;
  }

  if (groupBy) {
    report.grouped = groupProjectsBy(projects, groupBy);
  }

  return report;
}

async function generateActivityReport(
  metrics: string[],
  filters: any,
  groupBy: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const query: FilterQuery<any> = {
    timestamp: { $gte: startDate, $lte: endDate }
  };
  if (filters?.type) query.type = filters.type;

  const activities = await ActivityEvent.find(query).lean();

  const report: any = {
    totalActivities: activities.length,
    metrics: {}
  };

  if (metrics.includes('actionCount')) {
    report.metrics.actionCount = activities.length;
  }

  if (metrics.includes('byType')) {
    const byType = activities.reduce((acc: any, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {});
    report.metrics.byType = byType;
  }

  if (groupBy) {
    report.grouped = groupActivitiesBy(activities, groupBy);
  }

  return report;
}

async function generateAuditReport(
  metrics: string[],
  filters: any,
  groupBy: string,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const query: FilterQuery<any> = {
    createdAt: { $gte: startDate, $lte: endDate }
  };
  if (filters?.action) query.action = filters.action;
  if (filters?.entityType) query.entityType = filters.entityType;
  if (filters?.status) query.status = filters.status;

  const audits = await AuditLog.find(query).lean();

  const report: any = {
    totalAudits: audits.length,
    metrics: {}
  };

  if (metrics.includes('actionCount')) {
    report.metrics.actionCount = audits.length;
  }

  if (metrics.includes('byType')) {
    const byType = audits.reduce((acc: any, audit) => {
      acc[audit.entityType] = (acc[audit.entityType] || 0) + 1;
      return acc;
    }, {});
    report.metrics.byType = byType;
  }

  if (groupBy) {
    report.grouped = groupAuditsBy(audits, groupBy);
  }

  return report;
}

function groupUsersBy(users: any[], groupBy: string): any {
  const grouped: any = {};
  users.forEach(user => {
    let key: string;
    if (groupBy === 'month') {
      key = new Date(user.createdAt).toISOString().substring(0, 7);
    } else if (groupBy === 'week') {
      const date = new Date(user.createdAt);
      const week = getWeekNumber(date);
      key = `${date.getFullYear()}-W${week}`;
    } else if (groupBy === 'day') {
      key = new Date(user.createdAt).toISOString().substring(0, 10);
    } else {
      key = user[groupBy] || 'unknown';
    }
    grouped[key] = (grouped[key] || 0) + 1;
  });
  return grouped;
}

function groupProjectsBy(projects: any[], groupBy: string): any {
  const grouped: any = {};
  projects.forEach(project => {
    let key: string;
    if (groupBy === 'month') {
      key = new Date(project.createdAt).toISOString().substring(0, 7);
    } else {
      key = project[groupBy] || 'unknown';
    }
    grouped[key] = (grouped[key] || 0) + 1;
  });
  return grouped;
}

function groupActivitiesBy(activities: any[], groupBy: string): any {
  const grouped: any = {};
  activities.forEach(activity => {
    let key: string;
    if (groupBy === 'day') {
      key = new Date(activity.timestamp).toISOString().substring(0, 10);
    } else if (groupBy === 'type') {
      key = activity.type;
    } else {
      key = 'all';
    }
    grouped[key] = (grouped[key] || 0) + 1;
  });
  return grouped;
}

function groupAuditsBy(audits: any[], groupBy: string): any {
  const grouped: any = {};
  audits.forEach(audit => {
    let key: string;
    if (groupBy === 'day') {
      key = new Date(audit.createdAt).toISOString().substring(0, 10);
    } else if (groupBy === 'type') {
      key = audit.entityType;
    } else {
      key = 'all';
    }
    grouped[key] = (grouped[key] || 0) + 1;
  });
  return grouped;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function convertToCSV(data: any, name: string): string {
  // Simple CSV conversion - can be enhanced
  const rows: string[] = [];
  rows.push(`Report: ${name}`);
  rows.push(`Generated: ${new Date().toISOString()}`);
  rows.push('');

  if (data.metrics) {
    rows.push('Metrics:');
    Object.keys(data.metrics).forEach(key => {
      if (typeof data.metrics[key] === 'object') {
        rows.push(`${key},${JSON.stringify(data.metrics[key])}`);
      } else {
        rows.push(`${key},${data.metrics[key]}`);
      }
    });
    rows.push('');
  }

  if (data.grouped) {
    rows.push('Grouped Data:');
    rows.push('Group,Count');
    Object.keys(data.grouped).forEach(key => {
      rows.push(`${key},${data.grouped[key]}`);
    });
  }

  return rows.join('\n');
}

export default router;
















