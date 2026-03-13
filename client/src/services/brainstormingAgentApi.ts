/**
 * Brainstorming Agent API Service
 * Frontend service for interacting with the brainstorming agent
 */

import { apiRequest } from '@src/services/api.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export type BrainstormingFramework = 
  | 'scamper' 
  | 'six_thinking_hats' 
  | 'design_thinking' 
  | 'reverse_brainstorming' 
  | 'mind_mapping' 
  | 'random_word' 
  | 'analogy' 
  | 'auto';

export interface GeneratedIdea {
  id: string;
  label: string;
  description?: string;
  category?: 'feature' | 'constraint' | 'opportunity' | 'risk' | 'requirement' | 'improvement' | 'idea' | 'other';
  priority?: number;
  tags?: string[];
  framework?: string;
  evaluation?: {
    feasibility: number;
    impact: number;
    innovation: number;
    alignment: number;
    overall: number;
  };
}

export interface IdeaGenerationResult {
  ideas: GeneratedIdea[];
  frameworkUsed: string;
  reasoning?: string;
}

export interface IdeaEvaluation {
  ideaId: string;
  evaluation: {
    feasibility: number;
    impact: number;
    innovation: number;
    alignment: number;
    overall: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface IdeaCluster {
  id: string;
  theme: string;
  description: string;
  ideaIds: string[];
  representativeIdea?: string;
}

export interface ClusteringResult {
  clusters: IdeaCluster[];
}

export interface HMWQuestion {
  id: string;
  question: string;
  description?: string;
  linkedIdeas?: string[];
  category?: 'improve' | 'reduce' | 'enable' | 'reimagine' | 'simplify';
}

export interface HMWQuestionResult {
  questions: HMWQuestion[];
}

export interface FacilitationPrompt {
  type: 'guidance' | 'question' | 'technique' | 'evaluation' | 'transition';
  message: string;
  phase?: 0 | 1 | 2 | 3 | 4;
  framework?: string;
}

export const brainstormingAgentApi = {
  /**
   * Generate ideas using brainstorming agent
   */
  async generateIdeas(
    roomId: string,
    options?: {
      framework?: BrainstormingFramework;
      count?: number;
    }
  ): Promise<IdeaGenerationResult> {
    const response = await apiRequest<IdeaGenerationResult>(
      `/api/brainstorming-rooms/${roomId}/agent/generate-ideas`,
      {
        method: 'POST',
        body: JSON.stringify({
          framework: options?.framework || 'auto',
          count: options?.count || 5,
        }),
      }
    );
    return response;
  },

  /**
   * Evaluate specific ideas
   */
  async evaluateIdeas(roomId: string, ideaIds: string[]): Promise<{ evaluations: IdeaEvaluation[] }> {
    const response = await apiRequest<{ evaluations: IdeaEvaluation[] }>(
      `/api/brainstorming-rooms/${roomId}/agent/evaluate-ideas`,
      {
        method: 'POST',
        body: JSON.stringify({ ideaIds }),
      }
    );
    return response;
  },

  /**
   * Cluster ideas in the room
   */
  async clusterIdeas(roomId: string): Promise<ClusteringResult> {
    const response = await apiRequest<ClusteringResult>(
      `/api/brainstorming-rooms/${roomId}/agent/cluster`,
      {
        method: 'POST',
      }
    );
    return response;
  },

  /**
   * Generate HMW questions
   */
  async generateHMWQuestions(roomId: string, count?: number): Promise<HMWQuestionResult> {
    const response = await apiRequest<HMWQuestionResult>(
      `/api/brainstorming-rooms/${roomId}/agent/generate-hmw`,
      {
        method: 'POST',
        body: JSON.stringify({ count: count || 5 }),
      }
    );
    return response;
  },

  /**
   * Get facilitation prompt for current phase
   */
  async facilitate(roomId: string): Promise<FacilitationPrompt> {
    const response = await apiRequest<FacilitationPrompt>(
      `/api/brainstorming-rooms/${roomId}/agent/facilitate`,
      {
        method: 'POST',
      }
    );
    return response;
  },

  /**
   * Auto-facilitate (generate ideas automatically)
   */
  async autoFacilitate(
    roomId: string,
    options?: {
      framework?: BrainstormingFramework;
      iterations?: number;
    }
  ): Promise<IdeaGenerationResult> {
    const response = await apiRequest<IdeaGenerationResult>(
      `/api/brainstorming-rooms/${roomId}/agent/auto-facilitate`,
      {
        method: 'POST',
        body: JSON.stringify({
          framework: options?.framework || 'auto',
          iterations: options?.iterations || 1,
        }),
      }
    );
    return response;
  },

  /**
   * Export brainstorming ideas to a new project
   */
  async exportToProject(
    roomId: string,
    options: {
      projectName: string;
      includeEvaluated?: boolean;
      minScore?: number;
      maxTasks?: number;
      groupByCategory?: boolean;
    }
  ): Promise<{
    projectId: string;
    projectName: string;
    taskCount: number;
    tasks: any[];
    skippedCount: number;
    categories: string[];
  }> {
    const response = await apiRequest<any>(
      `/api/brainstorming-rooms/${roomId}/export/project`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
    return response;
  },

  /**
   * Export specific ideas to an existing project
   */
  async exportIdeasToProject(
    roomId: string,
    options: {
      projectId: string;
      ideaIds: string[];
      includeEvaluated?: boolean;
      minScore?: number;
    }
  ): Promise<{
    projectId: string;
    projectName: string;
    taskCount: number;
    tasks: any[];
    skippedCount: number;
    categories: string[];
  }> {
    const response = await apiRequest<any>(
      `/api/brainstorming-rooms/${roomId}/export/ideas`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
    return response;
  },
};

