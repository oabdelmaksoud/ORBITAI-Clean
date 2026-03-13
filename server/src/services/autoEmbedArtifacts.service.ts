/**
 * Auto-Embed Artifacts Service
 * Automatically generates embeddings for artifacts on save
 */

import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { embeddingService } from './embedding.service.js';
import { logger } from '../utils/logger.js';

/**
 * Generate and save embedding for an artifact
 */
export async function embedArtifact(artifact: IArtifact): Promise<void> {
  try {
    // Skip if already has embedding and content hasn't changed
    if (artifact.embedding && artifact.embedding.length > 0) {
      return; // Already embedded
    }

    // Generate text to embed (title + content preview)
    const textToEmbed = `${artifact.title}\n\n${artifact.content.substring(0, 8000)}`;
    
    // Generate embedding
    const embedding = await embeddingService.generateEmbedding(textToEmbed);
    
    // Update artifact
    artifact.embedding = embedding;
    await artifact.save();
    
    logger.debug(`Generated embedding for artifact: ${artifact.id}`);
  } catch (error: unknown) {
    logger.warn(`Failed to generate embedding for artifact ${artifact.id}:`, error);
    // Don't fail artifact save - embedding is optional
  }
}

/**
 * Batch embed all artifacts without embeddings
 */
export async function embedAllArtifacts(limit: number = 100): Promise<number> {
  try {
    const artifacts = await Artifact.find({ embedding: { $exists: false } })
      .limit(limit)
      .lean();

    let embedded = 0;
    for (const artifact of artifacts) {
      try {
        const textToEmbed = `${artifact.title}\n\n${artifact.content?.substring(0, 8000) || ''}`;
        const embedding = await embeddingService.generateEmbedding(textToEmbed);
        
        await Artifact.updateOne(
          { _id: artifact._id },
          { $set: { embedding } }
        );
        
        embedded++;
        logger.debug(`Embedded artifact: ${artifact._id}`);
      } catch (error: unknown) {
        logger.warn(`Failed to embed artifact ${artifact._id}:`, error);
      }
    }

    logger.info(`Embedded ${embedded}/${artifacts.length} artifacts`);
    return embedded;
  } catch (error: unknown) {
    logger.error('Failed to batch embed artifacts:', error);
    return 0;
  }
}

/**
 * Search artifacts by semantic similarity
 */
export async function searchArtifacts(
  query: string,
  options: {
    limit?: number;
    type?: string;
    projectId?: string;
  } = {}
): Promise<Array<{ artifact: IArtifact; score: number }>> {
  try {
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    
    // Build filter
    const filter: any = { embedding: { $exists: true } };
    if (options.type) {
      filter.type = options.type;
    }
    if (options.projectId) {
      filter.projectId = options.projectId;
    }

    // Find similar artifacts using cosine similarity
    const artifacts = await Artifact.find(filter)
      .limit(options.limit || 10)
      .lean();

    // Calculate similarity scores
    const scored = artifacts.map(artifact => ({
      artifact,
      score: cosineSimilarity(queryEmbedding, artifact.embedding || [])
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  } catch (error: unknown) {
    logger.error('Artifact search failed:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

export const autoEmbedArtifacts = {
  embedArtifact,
  embedAllArtifacts,
  searchArtifacts
};
