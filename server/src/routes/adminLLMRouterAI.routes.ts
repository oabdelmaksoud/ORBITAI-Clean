/**
 * Admin LLM Router AI Routes
 * API endpoints for AI-powered router features
 */

import express from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { llmRouterAIService } from '../services/llmRouterAI.service.js';
import { llmRouterNLService } from '../services/llmRouterNL.service.js';
import { llmRouterAutoTuneService } from '../services/llmRouterAutoTune.service.js';
import { llmRouterSettingsService } from '../services/llmRouterSettings.service.js';
import { RouterAIInsights } from '../models/RouterAIInsights.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

/**
 * GET /api/admin/llm-router/ai/recommendations
 * Get AI recommendations for router settings
 */
router.post('/recommendations', async (req, res) => {
  try {
    const { timeRange, filters } = req.body;
    
    const currentSettings = await llmRouterSettingsService.getEffectiveSettings();
    const recommendations = await llmRouterAIService.generateRecommendations(currentSettings);

    // Store recommendations in database
    for (const rec of recommendations) {
      await RouterAIInsights.create({
        type: 'recommendation',
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        confidence: rec.confidence,
        status: 'pending',
        recommendationType: rec.type,
        suggestedChanges: rec.suggestedChanges,
        detectedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expire after 7 days
      });
    }

    res.json({ recommendations });
  } catch (error: unknown) {
    logger.error('Failed to get AI recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ai/generate-rule
 * Generate routing rule from natural language
 */
router.post('/generate-rule', async (req, res) => {
  try {
    const { description, context } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Description is required' });
    }

    const result = await llmRouterNLService.generateRuleFromDescription(description, context);

    res.json(result);
  } catch (error: unknown) {
    logger.error('Failed to generate rule from natural language:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ai/insights
 * Get AI insights and analytics
 */
router.get('/insights', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const timeRange = {
      start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    };

    const insights = await llmRouterAIService.getInsights(timeRange);
    const patterns = await llmRouterAIService.analyzeUsagePatterns(timeRange);

    res.json({
      insights,
      patterns: patterns.slice(0, 20) // Top 20 patterns
    });
  } catch (error: unknown) {
    logger.error('Failed to get AI insights:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ai/anomalies
 * Get detected anomalies
 */
router.get('/anomalies', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const timeRange = {
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    };

    const anomalies = await llmRouterAIService.detectAnomalies(timeRange);

    // Store anomalies in database
    for (const anomaly of anomalies) {
      await RouterAIInsights.create({
        type: 'anomaly',
        title: `${anomaly.type}: ${anomaly.description}`,
        description: anomaly.description,
        priority: anomaly.severity === 'critical' ? 'high' : anomaly.severity === 'warning' ? 'medium' : 'low',
        confidence: 0.8,
        status: 'pending',
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        metrics: anomaly.metrics,
        detectedAt: anomaly.detectedAt,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expire after 30 days
      });
    }

    res.json({ anomalies });
  } catch (error: unknown) {
    logger.error('Failed to get anomalies:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ai/auto-tune
 * Trigger auto-tuning
 */
router.post('/auto-tune', async (req, res) => {
  try {
    const { timeRange, options } = req.body;
    
    const defaultTimeRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    };

    const metrics = await llmRouterAutoTuneService.monitorPerformance(timeRange || defaultTimeRange);
    const currentSettings = await llmRouterSettingsService.getEffectiveSettings();
    
    const result = await llmRouterAutoTuneService.autoTune(currentSettings, metrics, options);

    // Store auto-tune result
    if (result.success) {
      await RouterAIInsights.create({
        type: 'auto_tune',
        title: 'Auto-tuning applied',
        description: result.expectedImprovement,
        priority: 'medium',
        confidence: 0.7,
        status: 'applied',
        tuningChanges: result.changesApplied,
        previousMetrics: {
          avgLatency: metrics.avgLatency,
          avgCost: metrics.avgCost,
          successRate: metrics.successRate
        },
        detectedAt: new Date()
      });
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error('Failed to trigger auto-tuning:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ai/predict
 * Predict optimal model for a task
 */
router.get('/predict', async (req, res) => {
  try {
    const { agentRole, taskType, complexity, estimatedTokens, requiredCapabilities, userId, costPreference, maxLatency } = req.query;

    const taskAnalysis = {
      agentRole: agentRole as string | undefined,
      taskType: taskType as string | undefined,
      complexity: complexity as 'simple' | 'moderate' | 'complex' | undefined,
      estimatedTokens: estimatedTokens ? parseInt(estimatedTokens as string) : undefined,
      requiredCapabilities: requiredCapabilities ? (requiredCapabilities as string).split(',') : undefined
    };

    const context = {
      userId: userId as string | undefined,
      costPreference: costPreference as 'low' | 'balanced' | 'quality' | undefined,
      maxLatency: maxLatency ? parseInt(maxLatency as string) : undefined
    };

    const prediction = await llmRouterAIService.predictOptimalModel(taskAnalysis, context);

    // Store prediction
    await RouterAIInsights.create({
      type: 'prediction',
      title: `Predicted model: ${prediction.modelId}`,
      description: prediction.reasoning,
      priority: 'low',
      confidence: prediction.confidence,
      status: 'pending',
      predictedModel: prediction.modelId,
      predictedCost: prediction.estimatedCost,
      predictedLatency: prediction.estimatedLatency,
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expire after 24 hours
    });

    res.json({ prediction });
  } catch (error: unknown) {
    logger.error('Failed to predict optimal model:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ai/apply-recommendations
 * Apply AI recommendations
 */
router.post('/apply-recommendations', async (req, res) => {
  try {
    const { recommendationIds } = req.body;

    if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return res.status(400).json({ error: 'recommendationIds array is required' });
    }

    const recommendations = await RouterAIInsights.find({
      _id: { $in: recommendationIds },
      type: 'recommendation',
      status: 'pending'
    });

    const currentSettings = await llmRouterSettingsService.getEffectiveSettings();
    const appliedChanges: any[] = [];

    for (const rec of recommendations) {
      if (rec.suggestedChanges) {
        // Apply suggested changes
        // This is a simplified version - in production, you'd need more sophisticated merging logic
        const updatedSettings = {
          ...currentSettings,
          ...rec.suggestedChanges
        };

        // Update global settings
        await llmRouterSettingsService.updateGlobalSettings(updatedSettings as any);

        // Mark recommendation as applied
        rec.status = 'applied';
        rec.appliedAt = new Date();
        await rec.save();

        appliedChanges.push({
          recommendationId: rec._id,
          title: rec.title,
          changes: rec.suggestedChanges
        });
      }
    }

    res.json({
      success: true,
      applied: appliedChanges.length,
      changes: appliedChanges
    });
  } catch (error: unknown) {
    logger.error('Failed to apply recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ai/explain-rule
 * Explain a routing rule in natural language
 */
router.get('/explain-rule/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const { RoutingRule } = await import('../models/RoutingRule.model.js');
    const rule = await RoutingRule.findById(ruleId);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const explanation = await llmRouterNLService.explainRule(rule);

    res.json({ explanation });
  } catch (error: unknown) {
    logger.error('Failed to explain rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ai/auto-tune/history
 * Get auto-tuning history
 */
router.get('/auto-tune/history', async (req, res) => {
  try {
    const history = llmRouterAutoTuneService.getTuningHistory();
    res.json({ history });
  } catch (error: unknown) {
    logger.error('Failed to get auto-tuning history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/llm-router/ai/ab-tests
 * Get active A/B tests
 */
router.get('/ab-tests', async (req, res) => {
  try {
    const tests = llmRouterAutoTuneService.getActiveABTests();
    res.json({ tests });
  } catch (error: unknown) {
    logger.error('Failed to get A/B tests:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/llm-router/ai/ab-tests
 * Start a new A/B test
 */
router.post('/ab-tests', async (req, res) => {
  try {
    const { config, durationHours, name } = req.body;

    if (!config) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    const test = await llmRouterAutoTuneService.testConfiguration(
      config,
      durationHours || 24,
      name
    );

    res.json({ test });
  } catch (error: unknown) {
    logger.error('Failed to start A/B test:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;




