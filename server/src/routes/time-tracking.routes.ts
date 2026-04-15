import { Router } from 'express';
import { TimeEntry } from '../models/TimeEntry.model';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger.js';

const router = Router();

// All time tracking routes require authentication
router.use(authenticateToken);

/**
 * POST /api/time-tracking/start
 * Start a new timer
 */
router.post('/start', async (req, res) => {
  try {
    const { workspace, project, task, description, tags, isBillable } = req.body;
    const userId = (req as any).user._id;

    // Check if there's already an active timer
    const activeTimer = await (TimeEntry as any).getActiveTimer(userId);

    if (activeTimer) {
      res.status(400).json({
        error: 'You already have an active timer',
        activeTimer,
      });
      return;
    }

    // Create new time entry
    const timeEntry = new TimeEntry({
      user: userId,
      workspace,
      project,
      task,
      description,
      tags: tags || [],
      isBillable: isBillable !== undefined ? isBillable : true,
      startTime: new Date(),
      isRunning: true,
    });

    await timeEntry.save();
    await timeEntry.populate('project', 'name');
    if (task) await timeEntry.populate('task', 'title');

    res.status(201).json(timeEntry);
  } catch (error: any) {
    logger.error('Start timer error:', error);
    res.status(500).json({ error: error.message || 'Failed to start timer' });
  }
});

/**
 * POST /api/time-tracking/stop/:id
 * Stop a running timer
 */
router.post('/stop/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const timeEntry = await TimeEntry.findById(id);

    if (!timeEntry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    // Check if time entry belongs to user
    if (!timeEntry.user.equals(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await (timeEntry as any).stopTimer();
    await timeEntry.populate('project', 'name');
    if (timeEntry.task) await timeEntry.populate('task', 'title');

    res.json(timeEntry);
  } catch (error: any) {
    logger.error('Stop timer error:', error);
    res.status(500).json({ error: error.message || 'Failed to stop timer' });
  }
});

/**
 * POST /api/time-tracking/manual
 * Create a manual time entry
 */
router.post('/manual', async (req, res) => {
  try {
    const {
      workspace,
      project,
      task,
      description,
      startTime,
      endTime,
      duration,
      tags,
      isBillable,
    } = req.body;
    const userId = (req as any).user._id;

    // Create time entry
    const timeEntry = new TimeEntry({
      user: userId,
      workspace,
      project,
      task,
      description,
      tags: tags || [],
      isBillable: isBillable !== undefined ? isBillable : true,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : undefined,
      duration: duration || 0,
      isRunning: false,
    });

    await timeEntry.save();
    await timeEntry.populate('project', 'name');
    if (task) await timeEntry.populate('task', 'title');

    res.status(201).json(timeEntry);
  } catch (error: any) {
    logger.error('Create manual entry error:', error);
    res.status(500).json({ error: error.message || 'Failed to create manual entry' });
  }
});

/**
 * GET /api/time-tracking/entries
 * Get time entries with filters
 */
router.get('/entries', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const { startDate, endDate, project, workspace, limit, page } = req.query;

    const query: any = { user: userId };

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate as string);
      if (endDate) query.startTime.$lte = new Date(endDate as string);
    }

    if (project) query.project = project;
    if (workspace) query.workspace = workspace;

    const pageNum = parseInt(page as string) || 0;
    const limitNum = parseInt(limit as string) || 50;

    const entries = await TimeEntry.find(query)
      .sort({ startTime: -1 })
      .skip(pageNum * limitNum)
      .limit(limitNum)
      .populate('project', 'name')
      .populate('task', 'title');

    const totalCount = await TimeEntry.countDocuments(query);

    res.json({
      entries,
      totalCount,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    logger.error('Get entries error:', error);
    res.status(500).json({ error: error.message || 'Failed to get entries' });
  }
});

/**
 * GET /api/time-tracking/active
 * Get user's active timer
 */
router.get('/active', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const activeTimer = await (TimeEntry as any).getActiveTimer(userId);

    if (!activeTimer) {
      res.json({ activeTimer: null });
      return;
    }

    // Update duration for active timer
    activeTimer.updateDuration();

    res.json({ activeTimer });
  } catch (error: any) {
    logger.error('Get active timer error:', error);
    res.status(500).json({ error: error.message || 'Failed to get active timer' });
  }
});

/**
 * PUT /api/time-tracking/entries/:id
 * Update time entry
 */
router.put('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, startTime, endTime, tags, isBillable } = req.body;
    const userId = (req as any).user._id;

    const timeEntry = await TimeEntry.findById(id);

    if (!timeEntry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    // Check if time entry belongs to user
    if (!timeEntry.user.equals(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Can't update running timer
    if (timeEntry.isRunning) {
      res.status(400).json({ error: 'Stop the timer before updating' });
      return;
    }

    // Update fields
    if (description !== undefined) timeEntry.description = description;
    if (startTime) timeEntry.startTime = new Date(startTime);
    if (endTime) timeEntry.endTime = new Date(endTime);
    if (tags) timeEntry.tags = tags;
    if (isBillable !== undefined) timeEntry.isBillable = isBillable;

    await timeEntry.save();

    res.json(timeEntry);
  } catch (error: any) {
    logger.error('Update entry error:', error);
    res.status(500).json({ error: error.message || 'Failed to update entry' });
  }
});

/**
 * DELETE /api/time-tracking/entries/:id
 * Delete time entry
 */
router.delete('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const timeEntry = await TimeEntry.findById(id);

    if (!timeEntry) {
      res.status(404).json({ error: 'Time entry not found' });
      return;
    }

    // Check if time entry belongs to user
    if (!timeEntry.user.equals(userId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await timeEntry.deleteOne();

    res.json({ message: 'Time entry deleted successfully' });
  } catch (error: any) {
    logger.error('Delete entry error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete entry' });
  }
});

/**
 * GET /api/time-tracking/summary
 * Get time summary by date range
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = (req as any).user._id;
    // @ts-ignore TS6133
    const { startDate, endDate, _groupBy, project } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const query: any = {
      user: userId,
      startTime: { $gte: start, $lte: end },
    };

    if (project) query.project = project;

    const entries = await TimeEntry.find(query);

    // Calculate totals
    const totalSeconds = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const billableSeconds = entries
      .filter(e => e.isBillable)
      .reduce((sum, entry) => sum + entry.duration, 0);

    const summary = {
      totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
      billableHours: Math.round((billableSeconds / 3600) * 100) / 100,
      nonBillableHours: Math.round(((totalSeconds - billableSeconds) / 3600) * 100) / 100,
      totalEntries: entries.length,
      dateRange: { start, end },
    };

    res.json(summary);
  } catch (error: any) {
    logger.error('Get summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to get summary' });
  }
});

export default router;
