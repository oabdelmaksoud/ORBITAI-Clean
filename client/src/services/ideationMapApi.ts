/**
 * Ideation Map API Service
 * Handles AI-powered ideation map analysis
 */

import { apiRequest } from './api';
import { Idea } from './chatApi';

export interface IdeationMapCluster {
  id: string;
  name: string;
  description: string;
  ideaIds: string[];
  theme: string;
  priority: number;
}

export interface IdeationMapRelationship {
  sourceId: string;
  targetId: string;
  type: 'complements' | 'conflicts' | 'enables' | 'depends_on' | 'similar' | 'related';
  strength: number; // 0-1
  description: string;
}

export interface IdeationMapGap {
  category: string;
  description: string;
  suggestedIdeas: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface IdeationMapOpportunity {
  title: string;
  description: string;
  relatedIdeaIds: string[];
  potentialImpact: 'high' | 'medium' | 'low';
  suggestedActions: string[];
}

export interface IdeationMapInsight {
  type: 'trend' | 'pattern' | 'recommendation' | 'warning';
  title: string;
  description: string;
  relatedIdeaIds?: string[];
}

export interface IdeationMapRecommendation {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  relatedIdeaIds?: string[];
}

export interface MaturityInsight {
  currentMaturity?: number;
  targetMaturity: number;
  criticalIdeas: Array<{
    ideaId: string;
    impact: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  maturityGaps: Array<{
    area: string;
    currentScore?: number;
    missingIdeas: string[];
    recommendations: string[];
  }>;
  pathTo100: Array<{
    step: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: number;
  }>;
}

export interface IdeationMapAnalysis {
  clusters: IdeationMapCluster[];
  relationships: IdeationMapRelationship[];
  gaps: IdeationMapGap[];
  opportunities: IdeationMapOpportunity[];
  insights: IdeationMapInsight[];
  recommendations: IdeationMapRecommendation[];
  maturityInsights?: MaturityInsight;
}

export interface ConnectionSuggestion {
  ideaId: string;
  relationshipType: 'complements' | 'depends_on' | 'similar' | 'enables' | 'related';
  reason: string;
  strength: number;
}

export const ideationMapApi = {
  /**
   * Analyze ideas and generate AI-powered insights
   */
  async analyzeIdeas(
    ideas: Idea[],
    options?: {
      topic?: string;
      projectDescription?: string;
      conversationContext?: string;
      projectId?: string;
      currentMaturity?: number;
      maturityBreakdown?: {
        requirements?: number;
        design?: number;
        implementation?: number;
        testing?: number;
        deployment?: number;
        documentation?: number;
        overall?: number;
      };
    }
  ): Promise<IdeationMapAnalysis> {
    const response = await apiRequest<{ success: boolean; data: IdeationMapAnalysis }>(
      '/api/ideation-map/analyze',
      {
        method: 'POST',
        body: JSON.stringify({
          ideas,
          topic: options?.topic,
          projectDescription: options?.projectDescription,
          conversationContext: options?.conversationContext,
          projectId: options?.projectId,
          currentMaturity: options?.currentMaturity,
          maturityBreakdown: options?.maturityBreakdown
        })
      }
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to analyze ideas');
    }

    return response.data;
  },

  /**
   * Suggest connections for a specific idea
   */
  async suggestConnections(
    ideas: Idea[],
    ideaId: string,
    options?: {
      projectId?: string;
    }
  ): Promise<{ suggestedConnections: ConnectionSuggestion[] }> {
    const response = await apiRequest<{
      success: boolean;
      data: { suggestedConnections: ConnectionSuggestion[] };
    }>('/api/ideation-map/suggest-connections', {
      method: 'POST',
      body: JSON.stringify({
        ideas,
        ideaId,
        projectId: options?.projectId
      })
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to suggest connections');
    }

    return response.data;
  }
};

