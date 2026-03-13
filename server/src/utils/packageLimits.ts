/**
 * Package Limits Utility
 * Helper functions for checking package limits
 */

import { User } from '../models/User.model.js';
import { Package } from '../models/Package.model.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from './logger.js';

/**
 * Get user's package based on their plan
 */
export async function getUserPackage(userId: string): Promise<typeof Package.prototype | null> {
  try {
    const user = await User.findById(userId).select('plan').lean();
    if (!user) {
      return null;
    }

    // Map plan names to package display names
    const planToPackageMap: Record<string, string> = {
      'Free': 'Starter',
      'Pro': 'Pro',
      'Enterprise': 'Enterprise'
    };

    const packageName = planToPackageMap[user.plan] || 'Starter';
    
    const userPackage = await Package.findOne({ 
      displayName: packageName,
      isActive: true 
    }).lean();

    return userPackage as any;
  } catch (error: any) {
    logger.error('Failed to get user package:', error);
    return null;
  }
}

/**
 * Calculate storage used by artifacts in MB
 */
export function calculateArtifactStorage(artifacts: any[]): number {
  let totalSizeMB = 0;

  for (const artifact of artifacts) {
    if (artifact.content) {
      // If content is base64 encoded, calculate actual size
      if (typeof artifact.content === 'string' && artifact.content.startsWith('data:')) {
        // Base64 data URI: data:type;base64,content
        const base64Content = artifact.content.split(',')[1] || artifact.content;
        const sizeBytes = (base64Content.length * 3) / 4;
        totalSizeMB += sizeBytes / (1024 * 1024);
      } else if (typeof artifact.content === 'string') {
        // Plain text or base64 string
        // Estimate: base64 is ~33% larger than original
        const estimatedBytes = artifact.content.length * 0.75;
        totalSizeMB += estimatedBytes / (1024 * 1024);
      }
    }
  }

  return totalSizeMB;
}

/**
 * Check if user can add more artifacts to a project
 */
export async function checkArtifactLimit(
  userId: string,
  projectId: string,
  additionalArtifacts: number = 1
): Promise<void> {
  const userPackage = await getUserPackage(userId);
  if (!userPackage) {
    throw new AppError('Unable to determine user package', 500);
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const maxArtifacts = userPackage.limits.maxArtifactsPerProject;
  
  // -1 means unlimited
  if (maxArtifacts === -1) {
    return;
  }

  const currentCount = project.artifacts?.length || 0;
  const newCount = currentCount + additionalArtifacts;

  if (newCount > maxArtifacts) {
    throw new AppError(
      `Artifact limit reached. Maximum ${maxArtifacts} artifacts per project. Current: ${currentCount}.`,
      403
    );
  }
}

/**
 * Check if user can add artifact with given file size
 */
export async function checkStorageLimit(
  userId: string,
  projectId: string,
  fileSizeMB: number
): Promise<void> {
  const userPackage = await getUserPackage(userId);
  if (!userPackage) {
    throw new AppError('Unable to determine user package', 500);
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const maxStorageGB = userPackage.limits.maxStorageGB;
  
  // -1 means unlimited
  if (maxStorageGB === -1) {
    return;
  }

  const maxStorageMB = maxStorageGB * 1024;
  const currentStorageMB = calculateArtifactStorage(project.artifacts || []);
  const newStorageMB = currentStorageMB + fileSizeMB;

  if (newStorageMB > maxStorageMB) {
    const remainingMB = Math.max(0, maxStorageMB - currentStorageMB);
    throw new AppError(
      `Storage limit exceeded. Maximum ${maxStorageGB} GB (${maxStorageMB} MB) per project. ` +
      `Current usage: ${currentStorageMB.toFixed(2)} MB. ` +
      `Remaining: ${remainingMB.toFixed(2)} MB. ` +
      `File size: ${fileSizeMB.toFixed(2)} MB.`,
      403
    );
  }
}

/**
 * Get maximum file size allowed for user in bytes
 */
export async function getMaxFileSizeBytes(userId: string): Promise<number | undefined> {
  const userPackage = await getUserPackage(userId);
  if (!userPackage) {
    return undefined; // Fallback to default
  }

  const maxFileSizeMB = userPackage.limits.maxFileSizeMB;
  
  // -1 means unlimited
  if (maxFileSizeMB === -1) {
    return undefined;
  }

  return maxFileSizeMB * 1024 * 1024; // Convert MB to bytes
}

/**
 * Check both artifact count and storage limits
 */
export async function validateArtifactCreation(
  userId: string,
  projectId: string,
  fileSizeMB: number = 0,
  additionalArtifacts: number = 1
): Promise<void> {
  await checkArtifactLimit(userId, projectId, additionalArtifacts);
  if (fileSizeMB > 0) {
    await checkStorageLimit(userId, projectId, fileSizeMB);
  }
}

/**
 * Validate artifacts array before adding to project
 * Used when artifacts are created programmatically (e.g., by agents)
 */
export async function validateArtifactsArray(
  userId: string,
  projectId: string,
  newArtifacts: any[]
): Promise<void> {
  if (!newArtifacts || newArtifacts.length === 0) {
    return;
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const userPackage = await getUserPackage(userId);
  if (!userPackage) {
    throw new AppError('Unable to determine user package', 500);
  }

  const currentArtifacts = project.artifacts || [];
  const additionalCount = newArtifacts.length;
  
  // Check artifact count limit
  const maxArtifacts = userPackage.limits.maxArtifactsPerProject;
  if (maxArtifacts !== -1) {
    const newTotal = currentArtifacts.length + additionalCount;
    if (newTotal > maxArtifacts) {
      throw new AppError(
        `Artifact limit reached. Maximum ${maxArtifacts} artifacts per project. Current: ${currentArtifacts.length}. Trying to add: ${additionalCount}.`,
        403
      );
    }
  }

  // Check storage limit
  const maxStorageGB = userPackage.limits.maxStorageGB;
  if (maxStorageGB !== -1) {
    const currentStorageMB = calculateArtifactStorage(currentArtifacts);
    const newArtifactsStorageMB = calculateArtifactStorage(newArtifacts);
    const maxStorageMB = maxStorageGB * 1024;
    const newTotalStorageMB = currentStorageMB + newArtifactsStorageMB;

    if (newTotalStorageMB > maxStorageMB) {
      const remainingMB = Math.max(0, maxStorageMB - currentStorageMB);
      throw new AppError(
        `Storage limit exceeded. Maximum ${maxStorageGB} GB (${maxStorageMB} MB) per project. ` +
        `Current usage: ${currentStorageMB.toFixed(2)} MB. ` +
        `New artifacts size: ${newArtifactsStorageMB.toFixed(2)} MB. ` +
        `Remaining: ${remainingMB.toFixed(2)} MB.`,
        403
      );
    }
  }
}

