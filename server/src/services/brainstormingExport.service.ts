/**
 * Brainstorming Export Service
 * Converts brainstorming ideas into project tasks
 */

import { BrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { Project } from '../models/Project.model.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface ExportOptions {
  includeEvaluated?: boolean; // Only include ideas with evaluations
  minScore?: number; // Minimum overall score to include
  maxTasks?: number; // Maximum number of tasks
  groupByCategory?: boolean; // Group tasks by idea category
}

export interface ExportedTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort?: string;
  sourceIdeaId: string;
  sourceIdeaLabel: string;
  evaluation?: {
    feasibility: number;
    impact: number;
    innovation: number;
    alignment: number;
    overall: number;
  };
}

export interface ExportResult {
  projectId: string;
  projectName: string;
  taskCount: number;
  tasks: ExportedTask[];
  skippedCount: number;
  categories: string[];
}

/**
 * Export brainstorming ideas to a new project
 */
export async function exportToProject(
  roomId: string,
  projectName: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const {
    includeEvaluated = true,
    minScore = 0,
    maxTasks = 20,
    // @ts-ignore TS6133
    _groupByCategory = true
  } = options;

  // Get the brainstorming room
  const room = await BrainstormingRoom.findOne({ id: roomId });
  if (!room) {
    throw new Error('Brainstorming room not found');
  }

  // Filter and sort ideas
  let ideas = room.ideas || [];
  
  // Filter by evaluation criteria
  if (includeEvaluated) {
    ideas = ideas.filter(idea => {
      const score = (idea as any).evaluation?.overall || 0;
      return score >= minScore;
    });
  }

  // Sort by evaluation score (highest first)
  ideas.sort((a, b) => {
    const scoreA = (a as any).evaluation?.overall || 0;
    const scoreB = (b as any).evaluation?.overall || 0;
    return scoreB - scoreA;
  });

  // Limit tasks
  ideas = ideas.slice(0, maxTasks);

  // Convert to tasks
  const tasks: ExportedTask[] = ideas.map(idea => ({
    id: `task-${uuidv4()}`,
    title: idea.label,
    description: idea.description || `Implement: ${idea.label}`,
    category: idea.category || 'feature',
    priority: mapScoreToPriority((idea as any).evaluation?.overall || 5),
    estimatedEffort: estimateEffort(idea),
    sourceIdeaId: idea.id,
    sourceIdeaLabel: idea.label,
    evaluation: (idea as any).evaluation
  }));

  // Create project
  const project = await Project.create({
    userId: room.createdBy,
    name: projectName,
    description: `Generated from brainstorming session: ${room.name || room.topic}`,
    currentPhase: 'Initiation',
    methodology: 'V-Model',
    tasks: tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: 'Pending',
      priority: task.priority,
      category: task.category,
      assignedTo: 'Orchestrator',
      createdBy: 'Brainstorming Export',
      createdAt: new Date(),
      evaluation: (task as any).evaluation
    })),
    artifacts: [],
    logs: [{
      id: uuidv4(),
      action: 'project_created',
      description: `Project created from brainstorming session with ${tasks.length} tasks`,
      timestamp: new Date(),
      userId: room.createdBy
    }],
    selectedStandards: [],
    useInternet: false,
    projectScope: 'standard',
    budget: { cap: 1000, spent: 0 },
    mcpServers: []
  });

  // Get unique categories
  const categories = [...new Set(tasks.map(t => t.category))];

  logger.info(`[BrainstormingExport] Exported ${tasks.length} tasks to project ${project._id}`);

  return {
    projectId: project._id.toString(),
    projectName,
    taskCount: tasks.length,
    tasks,
    skippedCount: (room.ideas?.length || 0) - tasks.length,
    categories
  };
}

/**
 * Export specific ideas to existing project
 */
export async function exportIdeasToProject(
  roomId: string,
  projectId: string,
  ideaIds: string[],
  options: ExportOptions = {}
): Promise<ExportResult> {
  const room = await BrainstormingRoom.findOne({ id: roomId });
  if (!room) {
    throw new Error('Brainstorming room not found');
  }

  const project = await Project.findOne({ _id: projectId });
  if (!project) {
    throw new Error('Project not found');
  }

  // Get selected ideas
  const ideas = (room.ideas || []).filter(idea => ideaIds.includes(idea.id));
  
  // Filter by score
  const filteredIdeas = ideas.filter(idea => 
    !options.minScore || ((idea as any).evaluation?.overall || 0) >= options.minScore
  );

  // Convert to tasks
  const tasks: ExportedTask[] = filteredIdeas.map(idea => ({
    id: `task-${uuidv4()}`,
    title: idea.label,
    description: idea.description || `Implement: ${idea.label}`,
    category: idea.category || 'feature',
    priority: mapScoreToPriority((idea as any).evaluation?.overall || 5),
    estimatedEffort: estimateEffort(idea),
    sourceIdeaId: idea.id,
    sourceIdeaLabel: idea.label,
    evaluation: (idea as any).evaluation
  }));

  // Add to project
  const existingTasks = project.tasks || [];
  const newTasks = existingTasks.concat(tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: 'Pending',
    priority: task.priority,
    category: task.category,
    assignedTo: 'Orchestrator',
    createdBy: 'Brainstorming Export',
    createdAt: new Date(),
    evaluation: (task as any).evaluation
  })));

  await Project.updateOne(
    { _id: projectId },
    { 
      $set: { tasks: newTasks, lastModified: new Date() },
      $push: { 
        logs: {
          id: uuidv4(),
          action: 'tasks_imported',
          description: `Imported ${tasks.length} tasks from brainstorming session`,
          timestamp: new Date()
        }
      }
    }
  );

  const categories = [...new Set(tasks.map(t => t.category))];

  return {
    projectId: project._id.toString(),
    projectName: project.name,
    taskCount: tasks.length,
    tasks,
    skippedCount: ideaIds.length - tasks.length,
    categories
  };
}

/**
 * Map evaluation score to priority
 */
function mapScoreToPriority(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

/**
 * Estimate effort based on evaluation
 */
function estimateEffort(idea: any): string {
  const feasibility = (idea as any).evaluation?.feasibility || 5;
  
  if (feasibility >= 9) return '1-2 hours';
  if (feasibility >= 7) return '4-8 hours';
  if (feasibility >= 5) return '1-2 days';
  if (feasibility >= 3) return '3-5 days';
  return '1-2 weeks';
}

export const brainstormingExportService = {
  exportToProject,
  exportIdeasToProject
};
