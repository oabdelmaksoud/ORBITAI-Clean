/**
 * Prototype Generation Service
 * Handles background prototype generation job polling and status
 */

const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

export interface PrototypeGenerationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStage?: string;
  result?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<PrototypeGenerationJob | null> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/llm/prototype-generation/${jobId}/status`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result.success && result.job) {
      return result.job;
    }
    
    return null;
  } catch (error) {
    console.error('[PrototypeGeneration] Failed to get job status:', error);
    throw error;
  }
}

/**
 * Get job by conversation ID
 */
export async function getJobByConversation(conversationId: string): Promise<PrototypeGenerationJob | null> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/llm/prototype-generation/conversation/${conversationId}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      // 404 is expected if no job exists - return null silently
      if (response.status === 404) {
        return null;
      }
      // For other errors, log but don't throw - just return null
      if (import.meta.env.DEV) {
        console.warn(`[PrototypeGeneration] Failed to get job (${response.status}):`, response.statusText);
      }
      return null;
    }
    
    const result = await response.json();
    if (result.success && result.job) {
      return result.job;
    }
    
    return null;
  } catch (error) {
    // Silently handle network errors - just return null
    if (import.meta.env.DEV) {
      console.warn('[PrototypeGeneration] Failed to get job by conversation:', error);
    }
    return null;
  }
}

/**
 * Poll job status until completion
 */
export async function pollJobStatus(
  jobId: string,
  onProgress?: (progress: number, stage?: string) => void,
  pollInterval: number = 2000
): Promise<PrototypeGenerationJob> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getJobStatus(jobId);
        
        if (!job) {
          reject(new Error('Job not found'));
          return;
        }
        
        // Call progress callback
        if (onProgress) {
          onProgress(job.progress, job.currentStage);
        }
        
        // Check if job is complete
        if (job.status === 'completed') {
          resolve(job);
          return;
        }
        
        // Check if job failed
        if (job.status === 'failed') {
          reject(new Error(job.error || 'Job failed'));
          return;
        }
        
        // Continue polling
        setTimeout(poll, pollInterval);
      } catch (error) {
        reject(error);
      }
    };
    
    poll();
  });
}

