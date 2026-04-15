/**
 * Google Drive Integration Routes
 * OAuth and API integration with Google Drive
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/integrations/google-drive/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Google Drive integration service is running' });
});

/**
 * GET /api/integrations/google-drive/auth
 * Initiate Google Drive OAuth flow
 */
router.get('/auth', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/google-drive/callback`;
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(400).json({
        success: false,
        message: 'Google Drive integration not configured. Please set GOOGLE_CLIENT_ID environment variable.'
      });
      return;
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly'
    ];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scopes.join(' ')}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`;

    res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to initiate Google Drive OAuth:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to initiate Google Drive OAuth'
    });
  }
});

/**
 * GET /api/integrations/google-drive/callback
 * Handle Google Drive OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // @ts-ignore TS6133
    const { code, _state } = req.query;

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/google-drive/callback`;

    if (!clientId || !clientSecret) {
      res.status(400).json({
        success: false,
        message: 'Google Drive integration not configured'
      });
      return;
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if ((tokenData as any).error) {
      throw new Error((tokenData as any).error_description || 'Failed to exchange code for token');
    }

    // Store token (in production, save to database)
    logger.info(`Google Drive OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'Google Drive integration connected successfully',
      data: {
        accessToken: (tokenData as any).access_token ? '***' : undefined, // Don't expose token
        refreshToken: (tokenData as any).refresh_token ? '***' : undefined
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to handle Google Drive OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to complete Google Drive OAuth'
    });
  }
});

/**
 * GET /api/integrations/google-drive/files
 * List files from Google Drive
 */
router.get('/files', authenticateToken, async (_req: AuthRequest, res) => {
  try {
    // In production, retrieve stored token from database
    const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;

    if (!accessToken) {
      res.status(400).json({
        success: false,
        message: 'Google Drive not connected. Please authenticate first.'
      });
      return;
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if ((data as any).error) {
      throw new Error((data as any).error.message || 'Failed to list files');
    }

    res.json({
      success: true,
      data: {
        files: (data as any).files || []
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to list Google Drive files:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to list files'
    });
  }
});

/**
 * POST /api/integrations/google-drive/upload
 * Upload file to Google Drive
 */
router.post('/upload', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { fileName, fileContent, mimeType } = req.body;

    if (!fileName || !fileContent) {
      res.status(400).json({
        success: false,
        message: 'fileName and fileContent are required'
      });
      return;
    }

    // In production, retrieve stored token from database
    const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;

    if (!accessToken) {
      res.status(400).json({
        success: false,
        message: 'Google Drive not connected'
      });
      return;
    }

    // Upload file metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType || 'text/plain'
    };

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="boundary"`
      },
      body: `--boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--boundary\r\nContent-Type: ${mimeType || 'text/plain'}\r\n\r\n${fileContent}\r\n--boundary--`
    });

    const data = await response.json();

    if ((data as any).error) {
      throw new Error((data as any).error.message || 'Failed to upload file');
    }

    res.json({
      success: true,
      data: {
        fileId: (data as any).id,
        fileName: (data as any).name
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to upload file to Google Drive:', error);
    res.status(500).json({
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || 'Failed to upload file'
    });
  }
});

export default router;
