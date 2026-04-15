import { Router, Request, Response } from 'express';
import { BrainstormingRoom, IBrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { ChatConversation } from '../models/ChatConversation.model.js';
import { Project } from '../models/Project.model.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { getUserPackage } from '../utils/packageLimits.js';
import { subProjectDetector } from '../services/subProjectDetector.service.js';
import { brainstormingAgentService } from '../services/brainstormingAgent.service.js';

const router = Router();

// Get all rooms for a user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { status, search } = req.query;

    const query: any = {
      $or: [
        { createdBy: userId },
        { 'participants.userId': userId }
      ]
    };

    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'archived' }; // Default: exclude archived
    }

    if (search) {
      query.$text = { $search: search as string };
    }

    const rooms = await BrainstormingRoom.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ rooms });
  } catch (error: unknown) {
    logger.error('Error fetching brainstorming rooms:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single room
router.get('/:roomId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check access
    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ room });
  } catch (error: unknown) {
    logger.error('Error fetching room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new room
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const userName = (req as any).user?.name || (req as any).user?.userName || 'User';
    const { name, description, topic, sessionTemplate, maxAttendees } = req.body;

    // Get user's package to determine default maxAttendees
    let defaultMaxAttendees: number | null = null;
    if (!maxAttendees) {
      const userPackage = await getUserPackage(userId);

      // Prefer maxBrainstormingAttendees, fallback to maxTeamMembers, then plan defaults
      if (userPackage?.limits?.maxBrainstormingAttendees !== undefined) {
        defaultMaxAttendees = userPackage.limits.maxBrainstormingAttendees === -1
          ? null
          : userPackage.limits.maxBrainstormingAttendees;
      } else if (userPackage?.limits?.maxTeamMembers) {
        // Use maxTeamMembers from package as attendee limit
        // -1 means unlimited
        defaultMaxAttendees = userPackage.limits.maxTeamMembers === -1 ? null : userPackage.limits.maxTeamMembers;
      } else {
        // Default limits based on plan (Free: 5, Pro: 100, Enterprise: unlimited)
        const { User } = await import('../models/User.model.js');
        const user = await User.findById(userId);
        if (user) {
          switch (user.plan) {
            case 'Free':
              defaultMaxAttendees = 5;
              break;
            case 'Pro':
              defaultMaxAttendees = 100;
              break;
            case 'Enterprise':
              defaultMaxAttendees = null; // unlimited
              break;
            default:
              defaultMaxAttendees = 5;
          }
        }
      }
    }

    const roomId = uuidv4();
    const room = new BrainstormingRoom({
      id: roomId,
      name: name || 'New Brainstorming Room',
      description,
      topic,
      createdBy: userId,
      ownerName: userName,
      sessionTemplate: sessionTemplate || 'brainstorm',
      maxAttendees: maxAttendees !== undefined ? maxAttendees : defaultMaxAttendees,
      participants: [{
        userId,
        userName,
        role: 'facilitator',
        joinedAt: new Date()
      }],
      status: 'active',
      currentVersion: 1,
      versions: [{
        version: 1,
        snapshot: { topic, ideas: [], hmwQuestions: [] },
        changedBy: userId,
        changeDate: new Date(),
        changeSummary: 'Initial room creation'
      }],
      statistics: {
        totalIdeas: 0,
        totalParticipants: 1,
        lastActivity: new Date()
      }
    });

    await room.save();

    res.status(201).json({ room });
  } catch (error: unknown) {
    logger.error('Error creating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update room
router.put('/:roomId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const updates = req.body;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is facilitator or owner
    const isFacilitator = room.createdBy === userId ||
                         room.participants.find(p => p.userId === userId && p.role === 'facilitator');

    if (!isFacilitator) {
      return res.status(403).json({ error: 'Only facilitators can update the room' });
    }

    // Handle version snapshot if ideas/topic changed
    if (updates.ideas || updates.topic || updates.hmwQuestions) {
      const newVersion = room.currentVersion + 1;
      room.versions.push({
        version: newVersion,
        snapshot: {
          topic: updates.topic || room.topic,
          ideas: updates.ideas || room.ideas || [],
          hmwQuestions: updates.hmwQuestions || room.hmwQuestions || []
        },
        changedBy: userId,
        changeDate: new Date(),
        changeSummary: updates.changeSummary || 'Room updated'
      });
      room.currentVersion = newVersion;
    }

    // Update fields
    if (updates.name) room.name = updates.name;
    if (updates.description !== undefined) room.description = updates.description;
    if (updates.topic !== undefined) room.topic = updates.topic;
    if (updates.ideas) room.ideas = updates.ideas;
    if (updates.hmwQuestions) room.hmwQuestions = updates.hmwQuestions;
    if (updates.facilitatorTools) {
      room.facilitatorTools = { ...room.facilitatorTools, ...updates.facilitatorTools };
    }
    if (updates.statistics) {
      room.statistics = { ...room.statistics, ...updates.statistics };
    }

    room.statistics.lastActivity = new Date();
    await room.save();

    res.json({ room });
  } catch (error: unknown) {
    logger.error('Error updating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Join room
router.post('/:roomId/join', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const userName = (req as any).user?.name || (req as any).user?.userName || 'User';
    const { roomId } = req.params;
    const { role } = req.body;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check attendee limit (check both room limit and user's package limit)
    if (room.maxAttendees && room.participants.length >= room.maxAttendees) {
      return res.status(403).json({
        error: 'Room is full',
        maxAttendees: room.maxAttendees,
        currentAttendees: room.participants.length
      });
    }

    // Also check if room owner's package allows more attendees
    const roomOwnerPackage = await getUserPackage(room.createdBy);
    const packageMaxAttendees = roomOwnerPackage?.limits?.maxBrainstormingAttendees ||
                                roomOwnerPackage?.limits?.maxTeamMembers;
    if (packageMaxAttendees && packageMaxAttendees !== -1) {
      if (room.participants.length >= packageMaxAttendees) {
        return res.status(403).json({
          error: 'Room has reached the maximum number of attendees for this plan',
          maxAttendees: packageMaxAttendees,
          currentAttendees: room.participants.length,
          upgradeRequired: true
        });
      }
    }

    // Check if already a participant
    const existingParticipant = room.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      existingParticipant.lastSeen = new Date();
      await room.save();
      return res.json({ room, joined: true });
    }

    // Add participant
    room.participants.push({
      userId,
      userName,
      role: role || 'contributor',
      joinedAt: new Date()
    });

    room.statistics.totalParticipants = room.participants.length;
    room.statistics.lastActivity = new Date();
    await room.save();

    res.json({ room, joined: true });
  } catch (error: unknown) {
    logger.error('Error joining room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Leave room
router.post('/:roomId/leave', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Cannot leave if you're the owner (must delete room instead)
    if (room.createdBy === userId) {
      return res.status(400).json({ error: 'Room owner cannot leave. Delete the room instead.' });
    }

    room.participants = room.participants.filter(p => p.userId !== userId);
    room.statistics.totalParticipants = room.participants.length;
    await room.save();

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error leaving room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add idea to room
router.post('/:roomId/ideas', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const idea = req.body;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check access
    const hasAccess = room.participants.some(p => p.userId === userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!room.ideas) room.ideas = [];

    const newIdea = {
      id: idea.id || uuidv4(),
      label: idea.label,
      description: idea.description,
      parentId: idea.parentId || null,
      priority: idea.priority,
      category: idea.category || 'idea',
      notes: idea.notes,
      connections: idea.connections || [],
      state: idea.state || 'new',
      tags: idea.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userId,
      votes: []
    };

    room.ideas.push(newIdea);
    room.statistics.totalIdeas = room.ideas.length;
    room.statistics.lastActivity = new Date();

    // Create version snapshot
    const newVersion = room.currentVersion + 1;
    room.versions.push({
      version: newVersion,
      snapshot: {
        topic: room.topic,
        ideas: room.ideas,
        hmwQuestions: room.hmwQuestions || []
      },
      changedBy: userId,
      changeDate: new Date(),
      changeSummary: `Added idea: ${idea.label}`
    });
    room.currentVersion = newVersion;

    await room.save();

    res.json({ idea: newIdea, room });
  } catch (error: unknown) {
    logger.error('Error adding idea:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add HMW question
router.post('/:roomId/hmw-questions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { question, description, linkedIdeas } = req.body;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.participants.some(p => p.userId === userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!room.hmwQuestions) room.hmwQuestions = [];

    const newQuestion = {
      id: uuidv4(),
      question,
      description,
      createdBy: userId,
      createdAt: new Date(),
      linkedIdeas: linkedIdeas || []
    };

    room.hmwQuestions.push(newQuestion);
    room.statistics.lastActivity = new Date();
    await room.save();

    res.json({ question: newQuestion, room });
  } catch (error: unknown) {
    logger.error('Error adding HMW question:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get version history
router.get('/:roomId/versions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.participants.some(p => p.userId === userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ versions: room.versions });
  } catch (error: unknown) {
    logger.error('Error fetching versions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore version
router.post('/:roomId/versions/:versionNumber/restore', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId, versionNumber } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isFacilitator = room.createdBy === userId ||
                         room.participants.find(p => p.userId === userId && p.role === 'facilitator');

    if (!isFacilitator) {
      return res.status(403).json({ error: 'Only facilitators can restore versions' });
    }

    const version = room.versions.find(v => v.version === parseInt(versionNumber));
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Restore from snapshot
    room.topic = version.snapshot.topic || room.topic;
    room.ideas = version.snapshot.ideas || [];
    room.hmwQuestions = version.snapshot.hmwQuestions || [];

    // Create new version for restore action
    const newVersion = room.currentVersion + 1;
    room.versions.push({
      version: newVersion,
      snapshot: {
        topic: room.topic,
        ideas: room.ideas,
        hmwQuestions: room.hmwQuestions
      },
      changedBy: userId,
      changeDate: new Date(),
      changeSummary: `Restored from version ${versionNumber}`
    });
    room.currentVersion = newVersion;

    await room.save();

    res.json({ room });
  } catch (error: unknown) {
    logger.error('Error restoring version:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert room to project
router.post('/:roomId/convert-to-project', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy !== userId) {
      return res.status(403).json({ error: 'Only room owner can convert to project' });
    }

    // Create project from room
    const projectId = uuidv4();
    const project = new Project({
      userId,
      name: room.name,
      description: room.description || room.topic || '',
      currentPhase: 'Initiation',
      currentSprint: 1,
      methodology: 'Agile',
      agents: [],
      tasks: room.ideas?.map(idea => ({
        id: uuidv4(),
        title: idea.label,
        description: idea.description || '',
        phase: 'Requirements',
        status: 'pending',
        assignedAgent: null
      })) || [],
      artifacts: [],
      logs: [],
      selectedStandards: [],
      useInternet: false,
      budget: { cap: 1000, spent: 0 },
      mcpServers: [],
      status: 'draft'
    });

    await project.save();

    // Update room
    room.convertedToProject = projectId;
    room.convertedAt = new Date();
    room.status = 'converted';
    await room.save();

    res.json({ project, room });
  } catch (error: unknown) {
    logger.error('Error converting room to project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete room
router.delete('/:roomId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.createdBy !== userId) {
      return res.status(403).json({ error: 'Only room owner can delete' });
    }

    // Archive instead of delete
    room.status = 'archived';
    await room.save();

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error deleting room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-create room endpoint
router.post('/auto-create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const userName = (req as any).user?.name || (req as any).user?.userName || 'User';
    const { name, description, topic, conversationId } = req.body;

    // Get user's package to determine default maxAttendees
    let defaultMaxAttendees: number | null = null;
    const userPackage = await getUserPackage(userId);
    if (userPackage?.limits?.maxBrainstormingAttendees !== undefined) {
      defaultMaxAttendees = userPackage.limits.maxBrainstormingAttendees === -1 ? null : userPackage.limits.maxBrainstormingAttendees;
    }

    const room = new BrainstormingRoom({
      id: uuidv4(),
      name: name || `New Room ${new Date().toLocaleDateString()}`,
      description: description || '',
      createdBy: userId,
      ownerName: userName,
      topic: topic || '',
      ideas: [],
      participants: [{ userId, userName, role: 'facilitator', joinedAt: new Date(), lastSeen: new Date() }],
      hmwQuestions: [],
      facilitatorTools: {
        timerActive: false,
        timerDuration: 0,
        votingEnabled: false,
      },
      currentVersion: 1,
      versions: [{
        version: 1,
        snapshot: {
          topic: topic || '',
          ideas: [],
          hmwQuestions: []
        },
        changedBy: userId,
        changeDate: new Date(),
        changeSummary: 'Initial room creation'
      }],
      statistics: {
        totalIdeas: 0,
        totalParticipants: 1,
        lastActivity: new Date()
      },
      maxAttendees: defaultMaxAttendees,
      currentPhase: 0,
      subProjects: [],
      conversationId: conversationId || undefined,
    });

    await room.save();

    res.status(201).json({ room });
  } catch (error: unknown) {
    logger.error('Error auto-creating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detect sub-projects from ideas
router.post('/:roomId/detect-sub-projects', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.participants.some(p => p.userId === userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const detected = subProjectDetector.detectSubProjects({
      ideas: room.ideas || [],
      topic: room.topic || '',
    });

    res.json({ subProjects: detected });
  } catch (error: unknown) {
    logger.error('Error detecting sub-projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create sub-project
router.post('/:roomId/sub-projects', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { name, type, ideas } = req.body;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isFacilitator = room.createdBy === userId ||
                         room.participants.find(p => p.userId === userId && p.role === 'facilitator');

    if (!isFacilitator) {
      return res.status(403).json({ error: 'Only facilitators can create sub-projects' });
    }

    const subProject = {
      id: uuidv4(),
      name,
      type: type || 'other',
      status: 'ideation' as const,
      currentPhase: 1,
      ideas: ideas || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!room.subProjects) {
      room.subProjects = [];
    }
    room.subProjects.push(subProject);
    room.activeSubProjectId = subProject.id;
    room.currentPhase = 1;

    await room.save();

    res.json({ subProject, room });
  } catch (error: unknown) {
    logger.error('Error creating sub-project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update sub-project
router.put('/:roomId/sub-projects/:subProjectId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId, subProjectId } = req.params;
    const updates = req.body;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isFacilitator = room.createdBy === userId ||
                         room.participants.find(p => p.userId === userId && p.role === 'facilitator');

    if (!isFacilitator) {
      return res.status(403).json({ error: 'Only facilitators can update sub-projects' });
    }

    const subProject = room.subProjects?.find(sp => sp.id === subProjectId);
    if (!subProject) {
      return res.status(404).json({ error: 'Sub-project not found' });
    }

    Object.assign(subProject, updates, { updatedAt: new Date() });

    // Update room phase if sub-project phase changes
    if (updates.currentPhase !== undefined) {
      room.currentPhase = updates.currentPhase;
    }

    await room.save();

    res.json({ subProject, room });
  } catch (error: unknown) {
    logger.error('Error updating sub-project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert sub-project to prototype (Phase 2 → 3)
router.post('/:roomId/sub-projects/:subProjectId/convert-to-prototype', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId, subProjectId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isFacilitator = room.createdBy === userId ||
                         room.participants.find(p => p.userId === userId && p.role === 'facilitator');

    if (!isFacilitator) {
      return res.status(403).json({ error: 'Only facilitators can convert sub-projects' });
    }

    const subProject = room.subProjects?.find(sp => sp.id === subProjectId);
    if (!subProject) {
      return res.status(404).json({ error: 'Sub-project not found' });
    }

    subProject.status = 'prototyping';
    subProject.currentPhase = 3;
    room.currentPhase = 3;
    subProject.updatedAt = new Date();

    await room.save();

    res.json({ subProject, room });
  } catch (error: unknown) {
    logger.error('Error converting sub-project to prototype:', error);
    res.status(500).json({ error: error.message });
  }
});

// Launch sub-project to workspace (Phase 3 → 4)
router.post('/:roomId/sub-projects/:subProjectId/launch-to-workspace', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId, subProjectId } = req.params;

    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isFacilitator = room.createdBy === userId ||
                         room.participants.find(p => p.userId === userId && p.role === 'facilitator');

    if (!isFacilitator) {
      return res.status(403).json({ error: 'Only facilitators can launch sub-projects' });
    }

    const subProject = room.subProjects?.find(sp => sp.id === subProjectId);
    if (!subProject) {
      return res.status(404).json({ error: 'Sub-project not found' });
    }

    // Get ideas for this sub-project
    const subProjectIdeas = room.ideas?.filter(idea => subProject.ideas?.includes(idea.id)) || [];

    // Create project from sub-project
    const project = new Project({
      userId,
      name: subProject.name,
      description: room.topic || `${subProject.name} from brainstorming room`,
      architecture: {
        needsBackend: subProject.type === 'webapp' || subProject.type === 'api',
        needsMobileApp: subProject.type === 'mobile-app',
        needsAdminPanel: subProject.type === 'webapp',
      },
      brainstormingRoomId: roomId,
      brainstormingSubProjectId: subProjectId,
    });

    await project.save();

    // Update sub-project
    subProject.status = 'production';
    subProject.currentPhase = 4;
    subProject.projectId = project._id.toString();
    room.currentPhase = 4;
    subProject.updatedAt = new Date();

    await room.save();

    res.json({ project, subProject, room });
  } catch (error: unknown) {
    logger.error('Error launching sub-project to workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ Brainstorming Agent Routes ============

/**
 * POST /api/brainstorming-rooms/:roomId/agent/generate-ideas
 * Generate ideas using brainstorming agent
 */
router.post('/:roomId/agent/generate-ideas', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { framework, count } = req.body;

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await brainstormingAgentService.generateIdeas(
      roomId,
      framework || 'auto',
      count || 5,
      userId
    );

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error generating ideas with agent:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/agent/evaluate-ideas
 * Evaluate specific ideas
 */
router.post('/:roomId/agent/evaluate-ideas', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { ideaIds } = req.body; // Array of idea IDs to evaluate

    if (!ideaIds || !Array.isArray(ideaIds)) {
      return res.status(400).json({ error: 'ideaIds array is required' });
    }

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Evaluate each idea
    const evaluations = await Promise.all(
      ideaIds.map((ideaId: string) => brainstormingAgentService.evaluateIdea(roomId, ideaId))
    );

    // Update room agent activity
    await BrainstormingRoom.updateOne(
      { id: roomId },
      { $set: { 'agentActivity.lastEvaluation': new Date() } }
    );

    res.json({ evaluations });
  } catch (error: unknown) {
    logger.error('Error evaluating ideas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/agent/cluster
 * Cluster ideas in the room
 */
router.post('/:roomId/agent/cluster', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await brainstormingAgentService.clusterIdeas(roomId);

    // Update room agent activity
    await BrainstormingRoom.updateOne(
      { id: roomId },
      { $set: { 'agentActivity.lastClustering': new Date() } }
    );

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error clustering ideas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/agent/generate-hmw
 * Generate HMW questions
 */
router.post('/:roomId/agent/generate-hmw', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { count } = req.body;

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await brainstormingAgentService.generateHMWQuestions(roomId, count || 5);

    // Update room agent activity
    await BrainstormingRoom.updateOne(
      { id: roomId },
      { $set: { 'agentActivity.lastHMWGeneration': new Date() } }
    );

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error generating HMW questions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/agent/facilitate
 * Get facilitation prompt for current phase
 */
router.post('/:roomId/agent/facilitate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const prompt = await brainstormingAgentService.facilitateSession(roomId);

    res.json(prompt);
  } catch (error: unknown) {
    logger.error('Error generating facilitation prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/agent/auto-facilitate
 * Start auto-facilitation (generates ideas automatically)
 */
router.post('/:roomId/agent/auto-facilitate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { iterations, framework } = req.body;

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate ideas (this will be called repeatedly from frontend)
    const result = await brainstormingAgentService.generateIdeas(
      roomId,
      framework || 'auto',
      3, // Generate 3 ideas per iteration
      userId
    );

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error in auto-facilitation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/export/project
 * Export brainstorming ideas to a new project
 */
router.post('/:roomId/export/project', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { projectName, includeEvaluated, minScore, maxTasks, groupByCategory } = req.body;

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { brainstormingExportService } = await import('../services/brainstormingExport.service.js');

    const result = await brainstormingExportService.exportToProject(roomId, projectName, {
      includeEvaluated: includeEvaluated !== false,
      minScore: minScore || 0,
      maxTasks: maxTasks || 20,
      groupByCategory: groupByCategory !== false
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error('Error exporting to project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/brainstorming-rooms/:roomId/export/ideas
 * Export specific ideas to an existing project
 */
router.post('/:roomId/export/ideas', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { roomId } = req.params;
    const { projectId, ideaIds, includeEvaluated, minScore } = req.body;

    if (!ideaIds || !Array.isArray(ideaIds) || ideaIds.length === 0) {
      return res.status(400).json({ error: 'ideaIds array is required' });
    }

    // Check access
    const room = await BrainstormingRoom.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const hasAccess = room.createdBy === userId ||
                     room.participants.some(p => p.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { brainstormingExportService } = await import('../services/brainstormingExport.service.js');

    const result = await brainstormingExportService.exportIdeasToProject(roomId, projectId, ideaIds, {
      includeEvaluated: includeEvaluated !== false,
      minScore: minScore || 0
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    logger.error('Error exporting ideas:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
