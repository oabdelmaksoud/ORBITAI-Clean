/**
 * Queue Service
 * Manages background job queues using Bull
 */

import Bull, { Queue, Job } from 'bull';
import { logger } from '../utils/logger.js';

// Queue names
export enum QueueName {
  AGENT_EXECUTION = 'agent-execution',
  BACKGROUND_TASKS = 'background-tasks',
  EMAIL = 'email',
  NOTIFICATIONS = 'notifications',
}

interface QueueConfig {
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: string;
      delay: number;
    };
    removeOnComplete: boolean;
    removeOnFail: boolean;
  };
}

class QueueService {
  private queues: Map<QueueName, Queue> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize queues
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const queueConfig: QueueConfig = {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    };

    try {
      // Create queues
      this.queues.set(
        QueueName.AGENT_EXECUTION,
        new Bull(QueueName.AGENT_EXECUTION, {
          redis: redisUrl,
          ...queueConfig,
        })
      );

      this.queues.set(
        QueueName.BACKGROUND_TASKS,
        new Bull(QueueName.BACKGROUND_TASKS, {
          redis: redisUrl,
          ...queueConfig,
        })
      );

      this.queues.set(
        QueueName.EMAIL,
        new Bull(QueueName.EMAIL, {
          redis: redisUrl,
          ...queueConfig,
        })
      );

      this.queues.set(
        QueueName.NOTIFICATIONS,
        new Bull(QueueName.NOTIFICATIONS, {
          redis: redisUrl,
          ...queueConfig,
        })
      );

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Queue service initialized');
    } catch (error: unknown) {
      logger.warn('Queue service initialization failed, continuing without queues:', (error instanceof Error ? error.message : String(error)));
      this.isInitialized = false;
    }
  }

  /**
   * Set up event listeners for queues
   */
  private setupEventListeners(): void {
    this.queues.forEach((queue, name) => {
      queue.on('completed', (job: Job) => {
        logger.debug(`Job ${job.id} completed in queue ${name}`);
      });

      queue.on('failed', (job: Job | undefined, error: Error) => {
        logger.error(`Job ${job?.id} failed in queue ${name}:`, error);
      });

      queue.on('error', (error: Error) => {
        logger.error(`Queue ${name} error:`, error);
      });
    });
  }

  /**
   * Get a queue by name
   */
  getQueue(name: QueueName): Queue | null {
    if (!this.isInitialized) {
      logger.warn(`Queue ${name} not initialized`);
      return null;
    }
    return this.queues.get(name) || null;
  }

  /**
   * Add job to queue
   */
  async addJob<T = any>(
    queueName: QueueName,
    jobData: T,
    options?: Bull.JobOptions
  ): Promise<Job<T> | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      logger.warn(`Cannot add job to ${queueName}: queue not available`);
      return null;
    }

    try {
      const job = await queue.add(jobData, options);
      logger.debug(`Job ${job.id} added to queue ${queueName}`);
      return job;
    } catch (error: unknown) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Process jobs in a queue
   */
  processQueue<T = any>(
    queueName: QueueName,
    processor: (job: Job<T>) => Promise<any>
  ): void {
    const queue = this.getQueue(queueName);
    if (!queue) {
      logger.warn(`Cannot process queue ${queueName}: queue not available`);
      return;
    }

    queue.process(processor);
    logger.info(`Queue ${queueName} processor registered`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName): Promise<any> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * Close all queues
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(closePromises);
    this.queues.clear();
    this.isInitialized = false;
    logger.info('All queues closed');
  }

  /**
   * Check if queues are available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.queues.size > 0;
  }
}

export const queueService = new QueueService();


