import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

class GitHubService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  
  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID || '';
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    this.redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/integrations/github/callback';
    
    if (!this.clientId || !this.clientSecret) {
      logger.warn('GitHub OAuth credentials not configured');
    }
  }
  
  /**
   * Generate GitHub OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo user:email',
      state,
      response_type: 'code'
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri
        },
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );
      
      if (response.data.error) {
        throw new Error(response.data.error_description || response.data.error);
      }
      
      return response.data;
    } catch (error: any) {
      logger.error('GitHub token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for token');
    }
  }
  
  /**
   * Get GitHub user information
   */
  async getUser(accessToken: string): Promise<GitHubUser> {
    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      
      return response.data;
    } catch (error: any) {
      logger.error('GitHub get user error:', error.response?.data || error.message);
      throw new Error('Failed to get GitHub user');
    }
  }
  
  /**
   * Get user's email addresses
   */
  async getUserEmails(accessToken: string): Promise<Array<{ email: string; primary: boolean; verified: boolean }>> {
    try {
      const response = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      
      return response.data;
    } catch (error: any) {
      logger.error('GitHub get emails error:', error.response?.data || error.message);
      throw new Error('Failed to get GitHub emails');
    }
  }
  
  /**
   * Get user's repositories
   */
  async getRepositories(accessToken: string, options?: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<GitHubRepository[]> {
    try {
      const params = new URLSearchParams();
      
      if (options?.type) params.append('type', options.type);
      if (options?.sort) params.append('sort', options.sort);
      if (options?.direction) params.append('direction', options.direction);
      if (options?.per_page) params.append('per_page', options.per_page.toString());
      if (options?.page) params.append('page', options.page.toString());
      
      const response = await axios.get(
        `https://api.github.com/user/repos?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('GitHub get repositories error:', error.response?.data || error.message);
      throw new Error('Failed to get GitHub repositories');
    }
  }
  
  /**
   * Get repository details
   */
  async getRepository(accessToken: string, owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('GitHub get repository error:', error.response?.data || error.message);
      throw new Error('Failed to get GitHub repository');
    }
  }
  
  /**
   * Check rate limit
   */
  async getRateLimit(accessToken: string): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    try {
      const response = await axios.get('https://api.github.com/rate_limit', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      
      return {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: new Date(response.data.rate.reset * 1000)
      };
    } catch (error: any) {
      logger.error('GitHub rate limit error:', error.response?.data || error.message);
      throw new Error('Failed to get rate limit');
    }
  }
  
  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      // @ts-ignore TS6133
      const _response = await axios.delete(
        `https://api.github.com/applications/${this.clientId}/grant`,
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret
          },
          data: {
            access_token: accessToken
          }
        }
      );
      
      logger.info('GitHub token revoked successfully');
    } catch (error: any) {
      logger.error('GitHub revoke token error:', error.response?.data || error.message);
      // Don't throw error, just log it
    }
  }
}

export const githubService = new GitHubService();
