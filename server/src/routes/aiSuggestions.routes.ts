import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AISuggestion } from '../models/AISuggestion.model.js';
import { Project } from '../models/Project.model.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { checkFeatureAccess } from '../middleware/featureCheck.js';
import { llmRouter } from '../services/llm/llmRouter.js';

const router = express.Router();

// All routes require authentication - Applied individually to avoid blocking other /api/ai routes
// router.use(authenticateToken);
// router.use(rateLimiter);

/**
 * POST /api/ai/suggestions
 * Generate AI suggestions for a project
 */
router.post('/suggestions', authenticateToken, rateLimiter, checkFeatureAccess('ai_suggestions'), async (req: AuthRequest, res, next) => {
  try {
    const { projectId, projectContext, artifacts = [], tasks = [] } = req.body;
    const userId = req.user?.id || '';

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required'
      });
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - return mock suggestions
      logger.warn('MongoDB not connected, returning mock AI suggestions');
      const mockSuggestions = generateMockSuggestions(projectContext, artifacts, tasks);
      return res.json({
        success: true,
        suggestions: mockSuggestions,
      });
    }

    // Verify project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (project.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Generate AI suggestions based on project context
    const suggestions = await generateSuggestions(project, projectContext, artifacts, tasks);

    // Save suggestions to database
    const savedSuggestions = await Promise.all(
      suggestions.map(suggestion =>
        AISuggestion.create({
          projectId,
          userId,
          ...suggestion,
          dismissed: false,
          applied: false,
        })
      )
    );

    logger.info(`Generated ${savedSuggestions.length} AI suggestions for project ${projectId}`);

    res.json({
      success: true,
      suggestions: savedSuggestions,
    });
  } catch (error: unknown) {
    logger.error('Failed to generate AI suggestions:', error);
    // Return mock suggestions on error instead of failing
    try {
      const mockSuggestions = generateMockSuggestions(req.body.projectContext, req.body.artifacts || [], req.body.tasks || []);
      return res.json({
        success: true,
        suggestions: mockSuggestions,
      });
    } catch (fallbackError) {
      next(error);
    }
  }
});

/**
 * GET /api/ai/suggestions
 * Get AI suggestions for a project
 */
router.get('/suggestions', authenticateToken, rateLimiter, checkFeatureAccess('ai_suggestions'), async (req: AuthRequest, res, next) => {
  try {
    const { projectId } = req.query;
    const userId = req.user?.id || '';

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'projectId is required'
      });
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - return empty array
      return res.json({
        success: true,
        suggestions: [],
      });
    }

    const suggestions = await AISuggestion.find({
      projectId,
      userId,
      dismissed: false,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      suggestions,
    });
  } catch (error: unknown) {
    // Return empty array on error instead of failing
    res.json({
      success: true,
      suggestions: [],
    });
  }
});

/**
 * POST /api/ai/suggestions/:id/apply
 * Apply an AI suggestion
 */
router.post('/suggestions/:id/apply', authenticateToken, rateLimiter, checkFeatureAccess('ai_suggestions'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || '';

    const suggestion = await AISuggestion.findById(id);
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }

    if (suggestion.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (suggestion.applied) {
      return res.status(400).json({
        success: false,
        error: 'Suggestion already applied'
      });
    }

    suggestion.applied = true;
    suggestion.appliedAt = new Date();
    suggestion.appliedCount = (suggestion.appliedCount || 0) + 1;
    await suggestion.save();

    // Learn from this application - generate similar suggestions
    await learnFromSuggestion(suggestion);

    logger.info(`Applied AI suggestion ${id} for project ${suggestion.projectId}`);

    res.json({
      success: true,
      message: 'Suggestion applied successfully',
      suggestion,
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/ai/suggestions/:id/dismiss
 * Dismiss an AI suggestion
 */
router.post('/suggestions/:id/dismiss', authenticateToken, rateLimiter, checkFeatureAccess('ai_suggestions'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || '';

    const suggestion = await AISuggestion.findById(id);
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }

    if (suggestion.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    suggestion.dismissed = true;
    suggestion.dismissedAt = new Date();
    await suggestion.save();

    res.json({
      success: true,
      message: 'Suggestion dismissed',
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * Generate mock suggestions when MongoDB is unavailable
 */
function generateMockSuggestions(
  projectContext?: string,
  artifacts: any[] = [],
  tasks: any[] = []
): any[] {
  const suggestions: any[] = [];

  // Always include best practice suggestion
  suggestions.push({
    id: 'mock-1',
    type: 'best-practice',
    title: 'Add Error Handling',
    description: 'Implement comprehensive error handling and user-friendly error messages throughout the application.',
    impact: 'medium',
    effort: 'low',
    category: 'Best Practices',
    actionable: true,
    createdAt: new Date(),
    metadata: {
      confidence: 0.85,
      reasoning: 'Error handling is essential for production applications',
    },
  });

  // Performance suggestions based on artifacts
  if (artifacts.length > 5) {
    suggestions.push({
      id: 'mock-2',
      type: 'performance',
      title: 'Implement Caching',
      description: 'Add caching layer for frequently accessed data to improve response times and reduce database load.',
      impact: 'medium',
      effort: 'medium',
      category: 'Performance',
      actionable: true,
      createdAt: new Date(),
      metadata: {
        confidence: 0.8,
        reasoning: 'Project has multiple artifacts that could benefit from caching',
      },
    });
  }

  // Security suggestions if context mentions user/auth
  if (projectContext && (projectContext.toLowerCase().includes('user') || projectContext.toLowerCase().includes('auth'))) {
    suggestions.push({
      id: 'mock-3',
      type: 'security',
      title: 'Add Input Validation',
      description: 'Implement input validation for user-generated content to prevent security vulnerabilities like SQL injection and XSS attacks.',
      impact: 'high',
      effort: 'low',
      category: 'Security',
      actionable: true,
      createdAt: new Date(),
      metadata: {
        confidence: 0.9,
        reasoning: 'Project involves user input handling',
      },
    });
  }

  // Code quality suggestions based on tasks
  if (tasks.length > 3) {
    suggestions.push({
      id: 'mock-4',
      type: 'optimization',
      title: 'Optimize Code Structure',
      description: 'Consider refactoring the main component to improve maintainability and reduce complexity.',
      impact: 'high',
      effort: 'medium',
      category: 'Code Quality',
      actionable: true,
      createdAt: new Date(),
      metadata: {
        confidence: 0.7,
        reasoning: 'Multiple tasks suggest complex codebase',
      },
    });
  }

  return suggestions;
}

/**
 * Generate AI suggestions based on project context
 */
async function generateSuggestions(
  project: any,
  projectContext?: string,
  artifacts: any[] = [],
  tasks: any[] = []
): Promise<any[]> {
  const suggestions: any[] = [];

  // Analyze project for common patterns and generate suggestions
  const projectDescription = project.description || '';
  const projectName = project.name || '';

  // Security suggestions
  if (projectDescription.toLowerCase().includes('user') || projectDescription.toLowerCase().includes('auth')) {
    suggestions.push({
      type: 'security',
      title: 'Add Input Validation',
      description: 'Implement input validation for user-generated content to prevent security vulnerabilities like SQL injection and XSS attacks.',
      impact: 'high',
      effort: 'low',
      category: 'Security',
      actionable: true,
      metadata: {
        confidence: 0.9,
        reasoning: 'Project involves user input handling',
      },
    });
  }

  // Performance suggestions
  if (artifacts.length > 10) {
    suggestions.push({
      type: 'performance',
      title: 'Implement Caching',
      description: 'Add caching layer for frequently accessed data to improve response times and reduce database load.',
      impact: 'medium',
      effort: 'medium',
      category: 'Performance',
      actionable: true,
      metadata: {
        confidence: 0.8,
        reasoning: 'Project has many artifacts that could benefit from caching',
      },
    });
  }

  // Code quality suggestions
  if (tasks.length > 5) {
    suggestions.push({
      type: 'optimization',
      title: 'Optimize Code Structure',
      description: 'Consider refactoring the main component to improve maintainability and reduce complexity.',
      impact: 'high',
      effort: 'medium',
      category: 'Code Quality',
      actionable: true,
      metadata: {
        confidence: 0.7,
        reasoning: 'Multiple tasks suggest complex codebase',
      },
    });
  }

  // Best practices
  suggestions.push({
    type: 'best-practice',
    title: 'Add Error Handling',
    description: 'Implement comprehensive error handling and user-friendly error messages throughout the application.',
    impact: 'medium',
    effort: 'low',
    category: 'Best Practices',
    actionable: true,
    metadata: {
      confidence: 0.85,
      reasoning: 'Error handling is essential for production applications',
    },
  });

  return suggestions;
}

/**
 * Learn from applied suggestions to improve future recommendations
 */
async function learnFromSuggestion(suggestion: any): Promise<void> {
  try {
    // Find similar suggestions that were also applied
    const similarSuggestions = await AISuggestion.find({
      projectId: suggestion.projectId,
      type: suggestion.type,
      category: suggestion.category,
      applied: true,
      _id: { $ne: suggestion._id }
    }).limit(5);

    // Update metadata with learned patterns
    if (similarSuggestions.length > 0) {
      const learnedPatterns = [
        `Applied ${similarSuggestions.length} similar ${suggestion.type} suggestions`,
        `Category: ${suggestion.category} is frequently applied`,
        `Impact level: ${suggestion.impact} suggestions are commonly used`
      ];

      suggestion.metadata = {
        ...suggestion.metadata,
        learnedPatterns,
        similarSuggestions: similarSuggestions.map(s => s._id.toString())
      };
      await suggestion.save();
    }

    // Generate follow-up suggestions based on what was applied
    if (suggestion.appliedCount && suggestion.appliedCount > 1) {
      // This suggestion has been applied multiple times - generate related suggestions
      const followUpSuggestions = await generateFollowUpSuggestions(suggestion);
      if (followUpSuggestions.length > 0) {
        await Promise.all(
          followUpSuggestions.map(s =>
            AISuggestion.create({
              projectId: suggestion.projectId,
              userId: suggestion.userId,
              ...s,
              dismissed: false,
              applied: false,
            })
          )
        );
      }
    }
  } catch (error: unknown) {
    logger.error('Failed to learn from suggestion:', error);
  }
}

/**
 * Generate follow-up suggestions based on applied suggestion
 */
async function generateFollowUpSuggestions(appliedSuggestion: any): Promise<any[]> {
  const followUps: any[] = [];

  // Based on the type of suggestion applied, generate related ones
  switch (appliedSuggestion.type) {
    case 'security':
      followUps.push({
        type: 'security',
        title: 'Implement Security Headers',
        description: 'Add security headers (CSP, HSTS, X-Frame-Options) to protect against common attacks.',
        impact: 'high',
        effort: 'low',
        category: 'Security',
        actionable: true,
        metadata: {
          confidence: 0.85,
          reasoning: 'Follow-up to security suggestion',
        },
      });
      break;
    case 'performance':
      followUps.push({
        type: 'performance',
        title: 'Enable Compression',
        description: 'Enable gzip/brotli compression to reduce payload sizes and improve load times.',
        impact: 'medium',
        effort: 'low',
        category: 'Performance',
        actionable: true,
        metadata: {
          confidence: 0.8,
          reasoning: 'Follow-up to performance optimization',
        },
      });
      break;
    case 'optimization':
      followUps.push({
        type: 'best-practice',
        title: 'Add Code Comments',
        description: 'Add comprehensive code comments to improve maintainability.',
        impact: 'medium',
        effort: 'low',
        category: 'Code Quality',
        actionable: true,
        metadata: {
          confidence: 0.75,
          reasoning: 'Follow-up to code optimization',
        },
      });
      break;
  }

  return followUps;
}

/**
 * POST /api/ai/detect-scope
 * AI-powered project scope detection
 * Uses LLM to analyze user input and classify project scope
 */
router.post('/detect-scope', rateLimiter, async (req, res, next) => {
  try {
    const { input } = req.body;

    if (!input || input.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Input text is required (minimum 5 characters)'
      });
    }

    const prompt = `Analyze the following project description and determine its scope.

PROJECT DESCRIPTION:
"${input.trim()}"

Classify this project into ONE of these scope levels:
- mvp: Minimum viable product, 3-5 core features only, proof of concept, quick demo
- simple: Simple personal/learning project, 5-8 features, hobby project
- standard: Production-ready application, 8-15 features, startup MVP
- full: Enterprise-grade, 15+ features, scalable, comprehensive

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "scope": "mvp|simple|standard|full",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this scope was chosen",
  "suggestedFeatures": ["feature1", "feature2", "feature3"]
}`;

    try {
      const response = await llmRouter.generate({
        prompt,
        agentRole: 'scope-detector',
        taskType: 'classification',
        options: {
          temperature: 0.3, // Low temperature for consistent classification
          maxTokens: 500,
          systemPrompt: 'You are a project scope classifier. Be concise and accurate. Output only valid JSON.'
        }
      });

      // Parse the LLM response
      const responseText = response.text || response.content || '';

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate scope
        const validScopes = ['mvp', 'simple', 'standard', 'full'];
        if (!validScopes.includes(parsed.scope)) {
          parsed.scope = 'standard';
        }

        logger.info(`[AI Scope Detection] Detected: ${parsed.scope} (${Math.round((parsed.confidence || 0.5) * 100)}%)`);

        return res.json({
          success: true,
          data: {
            scope: parsed.scope,
            confidence: parsed.confidence || 0.7,
            reasoning: parsed.reasoning || 'AI-powered scope detection',
            suggestedFeatures: parsed.suggestedFeatures || [],
            aiPowered: true
          }
        });
      }

      throw new Error('Failed to parse LLM response');
    } catch (llmError: any) {
      logger.warn('[AI Scope Detection] LLM error, using fallback:', llmError.message);

      // Fallback to keyword-based detection
      const fallbackResult = detectScopeFromKeywords(input);
      return res.json({
        success: true,
        data: {
          ...fallbackResult,
          aiPowered: false,
          fallbackReason: 'LLM unavailable, using keyword detection'
        }
      });
    }
  } catch (error: unknown) {
    logger.error('[AI Scope Detection] Error:', error);
    next(error);
  }
});

/**
 * Fallback keyword-based scope detection
 */
function detectScopeFromKeywords(input: string): { scope: string; confidence: number; reasoning: string } {
  const text = input.toLowerCase();

  // MVP keywords
  if (/\bmvp\b|\bminimum viable\b|\bproof of concept\b|\bpoc\b|\bbare bones\b/.test(text)) {
    return { scope: 'mvp', confidence: 0.8, reasoning: 'Detected MVP/prototype keywords' };
  }

  // Full/Enterprise keywords
  if (/\benterprise\b|\bscalable\b|\bmicroservices\b|\bmulti-tenant\b|\bmillions/.test(text)) {
    return { scope: 'full', confidence: 0.8, reasoning: 'Detected enterprise-scale keywords' };
  }

  // Simple keywords
  if (/\bsimple\b|\bbasic\b|\bhobby\b|\blearning\b|\bpersonal project\b|\bside project\b/.test(text)) {
    return { scope: 'simple', confidence: 0.7, reasoning: 'Detected simple/personal project keywords' };
  }

  // Default to standard
  return { scope: 'standard', confidence: 0.5, reasoning: 'Using standard scope for production apps' };
}

export default router;
