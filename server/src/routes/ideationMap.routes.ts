/**
 * AI-Powered Ideation Map Routes
 * Provides intelligent analysis of ideas including clustering, relationships, gap analysis, and insights
 */

import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { routeTimeout } from '../middleware/timeout.js';

const router = Router();

interface Idea {
  id: string;
  label: string;
  description?: string;
  parentId?: string | null;
  priority?: number;
  category?: 'feature' | 'constraint' | 'opportunity' | 'risk' | 'requirement' | 'improvement' | 'idea' | 'other';
  notes?: string;
  connections?: string[];
  state?: 'new' | 'developing' | 'refined' | 'merged';
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface IdeationMapAnalysis {
  clusters: Array<{
    id: string;
    name: string;
    description: string;
    ideaIds: string[];
    theme: string;
    priority: number;
  }>;
  relationships: Array<{
    sourceId: string;
    targetId: string;
    type: 'complements' | 'conflicts' | 'enables' | 'depends_on' | 'similar' | 'related';
    strength: number; // 0-1
    description: string;
  }>;
  gaps: Array<{
    category: string;
    description: string;
    suggestedIdeas: string[];
    priority: 'high' | 'medium' | 'low';
  }>;
  opportunities: Array<{
    title: string;
    description: string;
    relatedIdeaIds: string[];
    potentialImpact: 'high' | 'medium' | 'low';
    suggestedActions: string[];
  }>;
  insights: Array<{
    type: 'trend' | 'pattern' | 'recommendation' | 'warning';
    title: string;
    description: string;
    relatedIdeaIds?: string[];
  }>;
  recommendations: Array<{
    action: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    relatedIdeaIds?: string[];
  }>;
  maturityInsights?: {
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
      expectedImpact: number; // Expected maturity increase
    }>;
  };
}

/**
 * POST /api/ideation-map/analyze
 * Analyze ideas and generate AI-powered insights
 */
router.post('/analyze', authenticateToken, routeTimeout(60000), async (req: AuthRequest, res, next) => {
  try {
    const { ideas, topic, projectDescription, conversationContext, currentMaturity, maturityBreakdown } = req.body;

    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Ideas array is required and must not be empty'
      });
      return;
    }

    const userId = req.user?.id;
    const projectId = req.body.projectId;

    // Build comprehensive prompt for AI analysis
    const ideasText = ideas.map((idea: Idea) => {
      return `- **${idea.label}** (${idea.category || 'idea'})
  ${idea.description || 'No description'}
  ${idea.priority ? `Priority: ${idea.priority}/5` : ''}
  ${idea.tags && idea.tags.length > 0 ? `Tags: ${idea.tags.join(', ')}` : ''}
  ${idea.notes ? `Notes: ${idea.notes}` : ''}
  ${idea.connections && idea.connections.length > 0 ? `Connections: ${idea.connections.join(', ')}` : ''}`;
    }).join('\n\n');

    const maturityContext = currentMaturity !== undefined 
      ? `\n**Current Project Maturity: ${currentMaturity}%**\n${maturityBreakdown ? `Breakdown: ${JSON.stringify(maturityBreakdown)}` : ''}\n\nYour analysis should focus on identifying ideas and gaps that will help increase maturity towards 100%. Prioritize recommendations that address low-scoring maturity areas.`
      : '';

    const prompt = `You are an expert ideation analyst. Analyze the following ideas and provide comprehensive insights.

**Project Context:**
${topic ? `Topic: ${topic}` : ''}
${projectDescription ? `Description: ${projectDescription}` : ''}${maturityContext}

**Ideas to Analyze:**
${ideasText}

${conversationContext ? `\n**Conversation Context:**\n${conversationContext.substring(0, 2000)}` : ''}

**Your Task:**
Analyze these ideas and provide:
1. **Clusters**: Group related ideas into thematic clusters (3-7 clusters)
2. **Relationships**: Identify relationships between ideas (complements, conflicts, enables, depends_on, similar, related)
3. **Gaps**: Identify missing aspects or opportunities not yet explored${currentMaturity !== undefined ? ' - Focus on gaps that will improve project maturity' : ''}
4. **Opportunities**: Highlight high-potential opportunities for expansion${currentMaturity !== undefined ? ' - Prioritize opportunities that increase maturity' : ''}
5. **Insights**: Provide strategic insights about patterns, trends, and recommendations${currentMaturity !== undefined ? ' - Include insights on how to reach 100% maturity' : ''}
6. **Recommendations**: Suggest actionable next steps${currentMaturity !== undefined ? ' - Prioritize actions that will increase maturity score' : ''}
7. **Maturity Focus**: ${currentMaturity !== undefined ? `Identify which ideas are most critical for reaching 100% maturity. Current maturity is ${currentMaturity}%.` : 'N/A'}

**Output Format (JSON):**
{
  "clusters": [
    {
      "id": "cluster-1",
      "name": "Cluster Name",
      "description": "What this cluster represents",
      "ideaIds": ["idea-id-1", "idea-id-2"],
      "theme": "Main theme",
      "priority": 4
    }
  ],
  "relationships": [
    {
      "sourceId": "idea-id-1",
      "targetId": "idea-id-2",
      "type": "complements",
      "strength": 0.8,
      "description": "How they relate"
    }
  ],
  "gaps": [
    {
      "category": "Category name",
      "description": "What's missing",
      "suggestedIdeas": ["Idea 1", "Idea 2"],
      "priority": "high"
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title",
      "description": "Description",
      "relatedIdeaIds": ["idea-id-1"],
      "potentialImpact": "high",
      "suggestedActions": ["Action 1", "Action 2"]
    }
  ],
  "insights": [
    {
      "type": "trend",
      "title": "Insight title",
      "description": "Description",
      "relatedIdeaIds": ["idea-id-1"]
    }
  ],
  "recommendations": [
    {
      "action": "What to do",
      "reason": "Why",
      "priority": "high",
      "relatedIdeaIds": ["idea-id-1"]
    }
  ]${currentMaturity !== undefined ? `,
  "maturityInsights": {
    "currentMaturity": ${currentMaturity},
    "targetMaturity": 100,
    "criticalIdeas": [
      {
        "ideaId": "idea-id",
        "impact": "high",
        "reason": "Why this idea is critical for maturity"
      }
    ],
    "maturityGaps": [
      {
        "area": "Requirements",
        "currentScore": 60,
        "missingIdeas": ["Idea 1", "Idea 2"],
        "recommendations": ["Recommendation 1", "Recommendation 2"]
      }
    ],
    "pathTo100": [
      {
        "step": "Action step",
        "priority": "high",
        "expectedImpact": 10
      }
    ]
  }` : ''}
}

Return ONLY valid JSON, no markdown formatting.`;

    // Use LLM Router to generate analysis
    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        taskType: 'analysis',
        systemInstruction: 'You are an expert ideation analyst. Analyze ideas and provide structured insights in JSON format.',
        maxTokens: 4000
      },
      routingContext: {
        userId,
        projectId,
        userPreferences: {
          costPreference: 'balanced'
        }
      },
      requestType: 'ideation-analysis',
      contextType: 'workspace'
    });

    // Parse JSON response
    let analysis: IdeationMapAnalysis;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || result.text.match(/(\{[\s\S]*\})/);
      const jsonText = jsonMatch ? jsonMatch[1] : result.text;
      analysis = JSON.parse(jsonText);
    } catch (parseError: any) {
      logger.error('[Ideation Map] Failed to parse AI response:', parseError);
      // Return a basic structure if parsing fails
      analysis = {
        clusters: [],
        relationships: [],
        gaps: [],
        opportunities: [],
        insights: [],
        recommendations: []
      };
    }

    // Validate and clean the analysis
    if (!analysis.clusters) analysis.clusters = [];
    if (!analysis.relationships) analysis.relationships = [];
    if (!analysis.gaps) analysis.gaps = [];
    if (!analysis.opportunities) analysis.opportunities = [];
    if (!analysis.insights) analysis.insights = [];
    if (!analysis.recommendations) analysis.recommendations = [];
    
    // Add maturity context if provided
    if (currentMaturity !== undefined) {
      if (!analysis.maturityInsights) {
        analysis.maturityInsights = {
          currentMaturity,
          targetMaturity: 100,
          criticalIdeas: [],
          maturityGaps: [],
          pathTo100: []
        };
      } else {
        analysis.maturityInsights.currentMaturity = currentMaturity;
        analysis.maturityInsights.targetMaturity = 100;
      }
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: unknown) {
    logger.error('[Ideation Map] Analysis error:', error);
    next(error);
  }
});

/**
 * POST /api/ideation-map/suggest-connections
 * Suggest connections between ideas
 */
router.post('/suggest-connections', authenticateToken, routeTimeout(30000), async (req: AuthRequest, res, next) => {
  try {
    const { ideas, ideaId } = req.body;

    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Ideas array is required'
      });
      return;
    }

    if (!ideaId) {
      res.status(400).json({
        success: false,
        message: 'ideaId is required'
      });
      return;
    }

    const targetIdea = ideas.find((i: Idea) => i.id === ideaId);
    if (!targetIdea) {
      res.status(404).json({
        success: false,
        message: 'Idea not found'
      });
      return;
    }

    const otherIdeas = ideas.filter((i: Idea) => i.id !== ideaId);
    const ideasText = otherIdeas.map((idea: Idea) => {
      return `- **${idea.label}** (${idea.category || 'idea'}): ${idea.description || 'No description'}`;
    }).join('\n');

    const prompt = `Analyze the following idea and suggest which other ideas it should be connected to:

**Target Idea:**
- **${targetIdea.label}** (${targetIdea.category || 'idea'}): ${targetIdea.description || 'No description'}

**Other Ideas:**
${ideasText}

**Task:**
Identify which ideas should be connected to the target idea and why. Consider:
- Complementary relationships
- Dependencies
- Similar themes
- Sequential relationships

**Output Format (JSON):**
{
  "suggestedConnections": [
    {
      "ideaId": "idea-id",
      "relationshipType": "complements" | "depends_on" | "similar" | "enables",
      "reason": "Why these should be connected",
      "strength": 0.8
    }
  ]
}

Return ONLY valid JSON.`;

    const userId = req.user?.id;
    const projectId = req.body.projectId;

    const result = await llmRouter.executeWithFallback({
      prompt,
      context: {
        taskType: 'analysis',
        systemInstruction: 'You are an expert at identifying relationships between ideas.',
        maxTokens: 2000
      },
      routingContext: {
        userId,
        projectId
      },
      requestType: 'ideation-connections',
      contextType: 'workspace'
    });

    let suggestions: { suggestedConnections: Array<{ ideaId: string; relationshipType: string; reason: string; strength: number }> };
    try {
      const jsonMatch = result.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || result.text.match(/(\{[\s\S]*\})/);
      const jsonText = jsonMatch ? jsonMatch[1] : result.text;
      suggestions = JSON.parse(jsonText);
    } catch (parseError: any) {
      logger.error('[Ideation Map] Failed to parse connection suggestions:', parseError);
      suggestions = { suggestedConnections: [] };
    }

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error: unknown) {
    logger.error('[Ideation Map] Connection suggestion error:', error);
    next(error);
  }
});

export default router;

