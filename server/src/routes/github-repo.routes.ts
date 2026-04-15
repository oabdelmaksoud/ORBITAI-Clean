import { Router } from 'express';
import { githubService } from '../services/github.service';
import { authenticateToken } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// All GitHub routes require authentication
router.use(authenticateToken);

/**
 * GET /api/integrations/github/repos
 * List user's GitHub repositories
 */
router.get('/repos', async (req, res) => {
  try {
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const { type, sort, direction, per_page, page } = req.query;

    const repos = await githubService.getRepositories(accessToken, {
      type: type as any,
      sort: sort as any,
      direction: direction as any,
      per_page: parseInt(per_page as string) || 100,
      page: parseInt(page as string) || 1
    });

    res.json(repos);
  } catch (error: any) {
    console.error('List GitHub repos error:', error);
    res.status(500).json({ error: error.message || 'Failed to list repositories' });
  }
});

/**
 * GET /api/integrations/github/repos/:owner/:repo
 * Get repository details
 */
router.get('/repos/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const repository = await githubService.getRepository(accessToken, owner, repo);

    res.json(repository);
  } catch (error: any) {
    console.error('Get GitHub repo error:', error);
    res.status(500).json({ error: error.message || 'Failed to get repository' });
  }
});

/**
 * GET /api/integrations/github/repos/:owner/:repo/branches
 * List repository branches
 */
router.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('List branches error:', error);
    res.status(500).json({ error: error.message || 'Failed to list branches' });
  }
});

/**
 * GET /api/integrations/github/repos/:owner/:repo/contents
 * List repository contents (files/directories)
 */
router.get('/repos/:owner/:repo/contents', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { path, ref } = req.query;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path || ''}`;
    const params = new URLSearchParams();
    if (ref) params.append('ref', ref as string);

    const response = await axios.get(
      `${url}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Get contents error:', error);
    res.status(500).json({ error: error.message || 'Failed to get contents' });
  }
});

/**
 * GET /api/integrations/github/repos/:owner/:repo/contents/:path
 * Get file content
 */
router.get('/repos/:owner/:repo/contents/*', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const path = req.params[0];
    const { ref } = req.query;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const params = new URLSearchParams();
    if (ref) params.append('ref', ref as string);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3.raw'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Get file error:', error);
    res.status(500).json({ error: error.message || 'Failed to get file' });
  }
});

/**
 * PUT /api/integrations/github/repos/:owner/:repo/contents/:path
 * Create or update file
 */
router.put('/repos/:owner/:repo/contents/*', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const path = req.params[0];
    const { message, content, branch, sha } = req.body;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const body: any = {
      message,
      content: Buffer.from(content).toString('base64')
    };

    if (branch) body.branch = branch;
    if (sha) body.sha = sha; // Required for updating existing file

    const response = await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Create/update file error:', error);
    res.status(500).json({
      error: error.response?.data?.message || 'Failed to create/update file'
    });
  }
});

/**
 * DELETE /api/integrations/github/repos/:owner/:repo/contents/:path
 * Delete file
 */
router.delete('/repos/:owner/:repo/contents/*', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const path = req.params[0];
    const { message, sha, branch } = req.body;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const response = await axios.delete(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        data: {
          message,
          sha,
          branch
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Delete file error:', error);
    res.status(500).json({
      error: error.response?.data?.message || 'Failed to delete file'
    });
  }
});

/**
 * GET /api/integrations/github/repos/:owner/:repo/commits
 * List commits
 */
router.get('/repos/:owner/:repo/commits', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { sha, path, per_page, page } = req.query;
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const params = new URLSearchParams();
    if (sha) params.append('sha', sha as string);
    if (path) params.append('path', path as string);
    params.append('per_page', (per_page || 30) as string);
    if (page) params.append('page', page as string);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('List commits error:', error);
    res.status(500).json({ error: error.message || 'Failed to list commits' });
  }
});

/**
 * GET /api/integrations/github/rate-limit
 * Check API rate limit
 */
router.get('/rate-limit', async (req, res) => {
  try {
    const accessToken = req.user.githubAccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const rateLimit = await githubService.getRateLimit(accessToken);

    res.json(rateLimit);
  } catch (error: any) {
    console.error('Get rate limit error:', error);
    res.status(500).json({ error: error.message || 'Failed to get rate limit' });
  }
});

export default router;
