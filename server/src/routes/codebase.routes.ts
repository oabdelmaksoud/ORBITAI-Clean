import express from 'express';
import { geminiService } from '../services/gemini.service.js';
import { logger } from '../utils/logger.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, requireFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';

const router = express.Router();

// Optional authentication
router.use((req: AuthRequest, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authenticateToken(req, res, () => next());
  } else {
    next();
  }
});

// Codebase search endpoint
router.post('/search', async (req: AuthRequest & FeatureRequest, res, _next) => {
  try {
    if (req.user) {
      await requireFeatureAccess(req, 'ai_chat');
    }
    
    const { query, artifacts } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required'
      });
      return;
    }

    logger.info('Searching codebase:', query);

    // Simple text-based search for now
    // Can be enhanced with semantic search using embeddings
    const results: any[] = [];

    if (artifacts && Array.isArray(artifacts)) {
      for (const artifact of artifacts) {
        if (artifact.type === 'code' && artifact.content) {
          const content = artifact.content.toLowerCase();
          const title = (artifact.title || '').toLowerCase();
          const queryLower = query.toLowerCase();

          if (content.includes(queryLower) || title.includes(queryLower)) {
            // Find matching lines
            const lines = artifact.content.split('\n');
            const matchingLines: number[] = [];
            
            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(queryLower)) {
                matchingLines.push(index + 1);
              }
            });

            if (matchingLines.length > 0) {
              results.push({
                file: {
                  path: artifact.title,
                  content: artifact.content,
                  language: getLanguageFromPath(artifact.title),
                  symbols: [],
                  lastIndexed: Date.now()
                },
                symbols: [],
                relevance: title.includes(queryLower) ? 0.9 : 0.7,
                matchType: 'partial',
                matchingLines
              });
            }
          }
        }
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    res.json({
      success: true,
      data: results.slice(0, 20) // Limit to 20 results
    });
  } catch (error: any) {
    logger.error('Codebase search failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search codebase',
      error: { message: error.message || 'Unknown error' }
    });
  }
});

function getLanguageFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.cs')) return 'csharp';
  if (lower.endsWith('.cpp') || lower.endsWith('.c')) return 'cpp';
  return 'text';
}

export default router;
















