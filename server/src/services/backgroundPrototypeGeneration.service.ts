/**
 * Background Prototype Generation Service
 * Handles prototype generation in the background, independent of user connection
 */

import { logger } from '../utils/logger.js';
import { PrototypeGenerationJob, IPrototypeGenerationJob } from '../models/PrototypeGenerationJob.model.js';
import { ChatConversation } from '../models/ChatConversation.model.js';
import { EnhancedPreviewGenerator } from './enhancedPreviewGenerator.service.js';
import { responseCache } from './llm/ResponseCache.js';
import { coverageAnalyzer, CoverageReport } from './coverageAnalyzer.service.js';

class BackgroundPrototypeGenerationService {
  private activeJobs: Map<string, Promise<void>> = new Map();

  /**
   * Start a background prototype generation job
   */
  async startGeneration(
    conversationId: string,
    userId: string,
    userGoal: string,
    conversationHistory: any[],
    useInternet: boolean = false,
    useEnhanced: boolean = true,
    isRegeneration: boolean = false,

    brainstormingContext: any = null, // Added brainstorming context
    generationSessionId?: string // Added for real-time updates
  ): Promise<string> {
    // Check if there's already a running job for this conversation
    const existingJob = await PrototypeGenerationJob.findOne({
      conversationId,
      status: { $in: ['pending', 'running'] }
    });

    if (existingJob) {
      logger.info(`[BackgroundPrototype] Job already exists for conversation ${conversationId}: ${existingJob._id}`);
      return existingJob._id.toString();
    }

    // Create new job
    const job = new PrototypeGenerationJob({
      conversationId,
      userId,
      status: 'pending',
      progress: 0,
      userGoal,
      conversationHistory,
      useInternet,
      useEnhanced,
      isRegeneration,

      brainstormingContext, // Save context to job
      generationSessionId
    });

    await job.save();
    const jobId = job._id.toString();

    logger.info(`[BackgroundPrototype] Created job ${jobId} for conversation ${conversationId}`);

    // Start execution in background (don't await)
    const executionPromise = this.executeGeneration(jobId).catch(error => {
      logger.error(`[BackgroundPrototype] Job ${jobId} execution failed:`, error);
      this.activeJobs.delete(jobId);
    });

    this.activeJobs.set(jobId, executionPromise);

    return jobId;
  }

  /**
   * Execute prototype generation
   */
  private async executeGeneration(jobId: string): Promise<void> {
    const job = await PrototypeGenerationJob.findById(jobId);
    if (!job) {
      logger.warn(`[BackgroundPrototype] Job ${jobId} not found`);
      return;
    }

    try {
      // Update status to running
      job.status = 'running';
      job.progress = 5;
      job.currentStage = 'starting';
      await job.save();

      logger.info(`[BackgroundPrototype] Starting generation for job ${jobId}`);

      // Check semantic cache first (for similar projects) - but skip if regenerating
      let semanticCache = null;
      if (!job.isRegeneration) {
        const cacheKey = `${job.userGoal.substring(0, 200)}|${(job.conversationHistory || []).length}`;
        semanticCache = responseCache.findSimilar(
          cacheKey,
          'gemini-3-pro-preview',
          0.85 // 85% similarity threshold for previews
        );
      }

      if (semanticCache) {
        try {
          const cachedPreview = JSON.parse(semanticCache.response);
          logger.info(`[BackgroundPrototype] Semantic cache HIT for job ${jobId}`);

          // Validate cached preview
          if (cachedPreview.summary && cachedPreview.techStack &&
            cachedPreview.architectureDiagram && cachedPreview.wireframeCode) {

            job.progress = 100;
            job.currentStage = 'completed';
            job.status = 'completed';
            job.result = cachedPreview;
            job.completedAt = new Date();
            await job.save();

            // Update conversation
            await this.updateConversation(job.conversationId, cachedPreview);

            logger.info(`[BackgroundPrototype] Job ${jobId} completed using cache`);
            return;
          }
        } catch (cacheError) {
          logger.warn(`[BackgroundPrototype] Failed to use cache for job ${jobId}:`, cacheError);
        }
      }

      // Use enhanced preview generator
      if (job.useEnhanced !== false) {
        const enhancedGenerator = new EnhancedPreviewGenerator();

        // Progress callback
        const progressCallback = (stage: string, progress: number, message: string) => {
          job.progress = Math.min(progress, 95); // Cap at 95% until final save
          job.currentStage = stage;
          job.save().catch(err => logger.warn(`[BackgroundPrototype] Failed to update progress:`, err));
          logger.info(`[BackgroundPrototype] Job ${jobId} - ${stage}: ${progress}% - ${message}`);
        };

        const preview = await enhancedGenerator.generatePreview(
          job.userGoal,
          job.conversationHistory,
          job.useInternet,
          progressCallback,
          job.userId,
          undefined, // projectId
          job.isRegeneration,
          job.brainstormingContext, // Pass context to generator
          job.generationSessionId // Pass session ID
        );

        // Analyze feature coverage with AI if we have brainstorming context
        let coverageReport: CoverageReport | undefined;
        if (job.brainstormingContext?.ideas && preview.wireframeCode) {
          logger.info(`[BackgroundPrototype] Analyzing feature coverage with AI for job ${jobId}...`);
          coverageReport = await coverageAnalyzer.analyzePrototypeCoverageWithAI(
            preview.wireframeCode,
            job.brainstormingContext.ideas
          );
          logger.info(`[BackgroundPrototype] AI Coverage: ${coverageReport.coveragePercentage}% (${coverageReport.coveredFeatures}/${coverageReport.totalFeatures} features, method: ${coverageReport.analysisMethod})`);
        }

        // Update job with result including coverage
        job.progress = 100;
        job.currentStage = 'completed';
        job.status = 'completed';
        job.result = {
          ...preview,
          featureCoverage: coverageReport
        };
        job.completedAt = new Date();
        await job.save();

        // Update conversation with preview and coverage
        await this.updateConversation(job.conversationId, preview, coverageReport);

        logger.info(`[BackgroundPrototype] Job ${jobId} completed successfully`);
      } else {
        throw new Error('Non-enhanced generation not supported in background mode');
      }

    } catch (error: unknown) {
      logger.error(`[BackgroundPrototype] Job ${jobId} failed:`, error);

      job.status = 'failed';
      job.error = (error instanceof Error ? error.message : String(error)) || 'Unknown error';
      job.completedAt = new Date();
      await job.save();
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Update conversation with generated preview and coverage report
   */
  private async updateConversation(conversationId: string, preview: any, coverageReport?: CoverageReport): Promise<void> {
    try {
      const conversation = await ChatConversation.findById(conversationId);
      if (!conversation) {
        logger.warn(`[BackgroundPrototype] Conversation ${conversationId} not found`);
        return;
      }

      // Update conversation metadata with preview (including coverage inside preview)
      // IMPORTANT: featureCoverage must be INSIDE projectPreview for frontend to access it
      const projectPreviewWithCoverage = {
        ...preview,
        featureCoverage: coverageReport
      };

      conversation.metadata = {
        ...conversation.metadata,
        projectPreview: projectPreviewWithCoverage,
        prototypingStage: 'prototyping',
        currentStage: 'prototyping'
      };

      await conversation.save();
      logger.info(`[BackgroundPrototype] Updated conversation ${conversationId} with preview`);
    } catch (error: unknown) {
      logger.error(`[BackgroundPrototype] Failed to update conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<IPrototypeGenerationJob | null> {
    return await PrototypeGenerationJob.findById(jobId);
  }

  /**
   * Get job by conversation ID
   */
  async getJobByConversation(conversationId: string): Promise<IPrototypeGenerationJob | null> {
    return await PrototypeGenerationJob.findOne({
      conversationId,
      status: { $in: ['pending', 'running', 'completed'] }
    }).sort({ createdAt: -1 });
  }

  /**
   * Cancel a job (if pending or running)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await PrototypeGenerationJob.findById(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'pending' || job.status === 'running') {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.completedAt = new Date();
      await job.save();
      return true;
    }

    return false;
  }
}

export const backgroundPrototypeGenerationService = new BackgroundPrototypeGenerationService();


