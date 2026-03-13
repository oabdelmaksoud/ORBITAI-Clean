import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const offlineModeMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Check if Mongoose is connected (readyState 1 = connected)
    if (mongoose.connection.readyState === 1) {
        return next();
    }

    // Define critical paths to intercept
    const path = req.path;
    const method = req.method;

    // Mock Admin User
    const mockUser = {
        _id: 'offline-admin-id',
        email: 'admin@orbitai.com',
        name: 'Offline Admin',
        role: 'superadmin',
        avatar: null,
        preferences: {
            theme: 'system',
            notifications: true
        }
    };

    // Mock Settings
    const mockSettings = {
        userId: 'offline-admin-id',
        theme: 'system',
        notifications: {
            email: true,
            push: true
        },
        dashboardLayout: []
    };

    // Intercept Auth - Get Current User
    if (method === 'GET' && (path === '/api/auth/me' || path === '/api/v1/auth/me')) {
        logger.warn(`[OfflineMode] Serving mock data for ${path}`);
        return res.json({
            success: true,
            data: mockUser,
            user: mockUser // Support both structures if legacy exists
        });
    }

    // Intercept settings
    if (method === 'GET' && (path === '/api/user/settings' || path === '/api/v1/user/settings')) {
        logger.warn(`[OfflineMode] Serving mock settings for ${path}`);
        return res.json({
            success: true,
            data: mockSettings
        });
    }

    // Intercept Projects - List
    if (method === 'GET' && (path === '/api/projects' || path === '/api/v1/projects')) {
        logger.warn(`[OfflineMode] Serving mock projects for ${path}`);
        return res.json({
            success: true,
            data: [], // Return empty list for now to allow dashboard to load empty state
            pagination: {
                page: 1,
                limit: 10,
                total: 0,
                pages: 0
            }
        });
    }

    // Intercept Chat
    if (method === 'POST' && (path === '/api/llm/chat' || path === '/api/v1/llm/chat')) {
        logger.warn(`[OfflineMode] Serving mock chat response for ${path}`);
        return res.json({
            response: "I am currently running in Offline Mode because the database is unavailable. I cannot process real AI requests, but I am here to verify the interface works!",
            conversationId: "mock-conversation-id"
        });
    }

    // Intercept Sample Projects
    if (method === 'GET' && (path === '/api/projects/samples' || path === '/api/v1/projects/samples')) {
        logger.warn(`[OfflineMode] Serving mock sample projects for ${path}`);
        return res.json({
            success: true,
            data: [
                {
                    _id: "mock-sample-1",
                    name: "Offline Sample Project",
                    description: "This is a sample project visible in offline mode.",
                    tags: ["offline", "sample"]
                }
            ]
        });
    }

    // Log warning for other requests but let them pass (might fail if they need DB)
    if (path.startsWith('/api')) {
        logger.warn(`[OfflineMode] Database disconnected. Request to ${path} might fail.`);
    }

    next();
};
