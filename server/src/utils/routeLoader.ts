/**
 * Route Loader - Automatically loads and registers all API routes
 * 
 * This file should be imported in server/src/index.ts
 * 
 * Usage:
 *   import { loadRoutes } from './utils/routeLoader';
 *   loadRoutes(app);
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Auto-load all route files from the routes directory
 */
export async function loadRoutes(app: express.Application) {
  console.log('📦 Loading API routes...');
  
  const routesDir = path.join(__dirname, '../routes');
  const routeFiles = fs.readdirSync(routesDir).filter(file => 
    file.endsWith('.routes.ts') || file.endsWith('.routes.js')
  );
  
  let loadedCount = 0;
  
  for (const file of routeFiles) {
    try {
      const routePath = path.join(routesDir, file);
      const routeModule = await import(routePath);
      const router = routeModule.default;
      
      if (router) {
        // Extract route name from filename (e.g., 'auth.routes.ts' -> '/api/auth')
        const routeName = file.replace('.routes.ts', '').replace('.routes.js', '');
        const apiPath = `/api/${routeName}`;
        
        app.use(apiPath, router);
        console.log(`✅ Loaded: ${apiPath}`);
        
        // Debug exactly what routes are in the router:
        if (routeName === 'llm' && router.stack) {
           const endpoints = router.stack.map((layer: any) => {
              return layer.route ? `${Object.keys(layer.route.methods)} ${layer.route.path}` : `Middleware: ${layer.name}`;
           });
           console.log(`   LLM Routes in router object:`, endpoints);
        }

        loadedCount++;
      }
    } catch (error: any) {
      console.error(`❌ Failed to load route ${file}:`, error.message);
    }
  }
  
  console.log(`🎉 Successfully loaded ${loadedCount} route files`);
  
  // Also load new collaboration features
  await loadNewFeatures(app);
  
  return loadedCount;
}

/**
 * Load new collaboration features (workspaces, comments, notifications, time tracking, GitHub)
 */
async function loadNewFeatures(app: express.Application) {
  console.log('📦 Loading new collaboration features...');
  
  try {
    // Import new route files
    const workspaceRoutes = (await import('../routes/workspace.routes')).default;
    const invitationRoutes = (await import('../routes/invitation.routes')).default;
    const commentRoutes = (await import('../routes/comment.routes')).default;
    const notificationRoutes = (await import('../routes/notification.routes')).default;
    const timeTrackingRoutes = (await import('../routes/time-tracking.routes')).default;
    const githubRepoRoutes = (await import('../routes/github-repo.routes')).default;
    
    // Register routes
    app.use('/api/workspaces', workspaceRoutes);
    app.use('/api/invitations', invitationRoutes);
    app.use('/api/comments', commentRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/time-tracking', timeTrackingRoutes);
    app.use('/api/integrations/github', githubRepoRoutes);
    
    console.log('✅ Collaboration features loaded:');
    console.log('   - /api/workspaces');
    console.log('   - /api/invitations');
    console.log('   - /api/comments');
    console.log('   - /api/notifications');
    console.log('   - /api/time-tracking');
    console.log('   - /api/integrations/github');
  } catch (error: any) {
    console.error('❌ Failed to load collaboration features:', error.message);
  }
}

/**
 * Alternative: Load only new features (if using separate loader)
 */
export function loadNewRoutes(app: express.Application) {
  console.log('📦 Loading new routes...');

  return loadNewFeatures(app);
}

/**
 * Get list of all new endpoints
 */
export function getNewEndpoints() {
  return {
    workspaces: {
      base: '/api/workspaces',
      endpoints: [
        'POST /api/workspaces - Create workspace',
        'GET /api/workspaces - List workspaces',
        'GET /api/workspaces/:id - Get workspace',
        'PUT /api/workspaces/:id - Update workspace',
        'DELETE /api/workspaces/:id - Delete workspace',
        'POST /api/workspaces/:id/members - Invite member',
        'DELETE /api/workspaces/:id/members/:memberId - Remove member',
        'PUT /api/workspaces/:id/members/:memberId - Update member role'
      ]
    },
    invitations: {
      base: '/api/invitations',
      endpoints: [
        'POST /api/invitations - Create invitation',
        'GET /api/invitations - List invitations',
        'GET /api/invitations/:token - Get invitation details',
        'POST /api/invitations/:token/accept - Accept invitation',
        'POST /api/invitations/:token/decline - Decline invitation',
        'DELETE /api/invitations/:id - Revoke invitation',
        'POST /api/invitations/:id/resend - Resend invitation'
      ]
    },
    comments: {
      base: '/api/comments',
      endpoints: [
        'POST /api/comments - Create comment',
        'GET /api/comments - List comments',
        'GET /api/comments/:id - Get comment',
        'PUT /api/comments/:id - Update comment',
        'DELETE /api/comments/:id - Delete comment',
        'POST /api/comments/:id/reply - Reply to comment',
        'POST /api/comments/:id/reactions - Add reaction',
        'DELETE /api/comments/:id/reactions - Remove reaction',
        'PUT /api/comments/:id/resolve - Resolve comment',
        'GET /api/comments/:id/thread - Get thread replies'
      ]
    },
    notifications: {
      base: '/api/notifications',
      endpoints: [
        'GET /api/notifications - Get notifications',
        'GET /api/notifications/unread - Get unread count',
        'GET /api/notifications/:id - Get notification',
        'PUT /api/notifications/:id/read - Mark as read',
        'PUT /api/notifications/read-all - Mark all as read',
        'DELETE /api/notifications/:id - Delete notification',
        'DELETE /api/notifications - Delete all read',
        'POST /api/notifications/test - Test notification'
      ]
    },
    timeTracking: {
      base: '/api/time-tracking',
      endpoints: [
        'POST /api/time-tracking/start - Start timer',
        'POST /api/time-tracking/stop/:id - Stop timer',
        'POST /api/time-tracking/manual - Create manual entry',
        'GET /api/time-tracking/entries - List entries',
        'GET /api/time-tracking/active - Get active timer',
        'PUT /api/time-tracking/entries/:id - Update entry',
        'DELETE /api/time-tracking/entries/:id - Delete entry',
        'GET /api/time-tracking/summary - Get time summary',
        'POST /api/time-tracking/pause/:id - Pause timer',
        'POST /api/time-tracking/resume/:id - Resume timer'
      ]
    },
    github: {
      base: '/api/integrations/github',
      endpoints: [
        'GET /api/integrations/github/repos - List repositories',
        'GET /api/integrations/github/repos/:owner/:repo - Get repository',
        'GET /api/integrations/github/repos/:owner/:repo/branches - List branches',
        'GET /api/integrations/github/repos/:owner/:repo/contents - List files',
        'GET /api/integrations/github/repos/:owner/:repo/contents/:path - Get file',
        'PUT /api/integrations/github/repos/:owner/:repo/contents/:path - Create/update file',
        'DELETE /api/integrations/github/repos/:owner/:repo/contents/:path - Delete file',
        'GET /api/integrations/github/repos/:owner/:repo/commits - List commits',
        'GET /api/integrations/github/rate-limit - Get rate limit'
      ]
    }
  };
}

/**
 * Print all new endpoints to console
 */
export function printEndpoints() {
  const endpoints = getNewEndpoints();
  
  console.log('\n📚 Available API Endpoints:\n');
  
  Object.entries(endpoints).forEach(([category, data]) => {
    console.log(`\n${category.toUpperCase()}`);
    console.log(`Base: ${data.base}`);
    console.log('Endpoints:');
    data.endpoints.forEach(endpoint => {
      console.log(`  - ${endpoint}`);
    });
  });
  
  console.log('\n');
}
