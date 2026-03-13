/**
 * Mobile Deployment Routes
 * Endpoints for deploying to iOS and Android app stores
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { mobileDeploymentService } from '../services/mobileDeployment.service.js';
import { Project } from '../models/Project.model.js';
import { Deployment } from '../models/Deployment.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { webSocketService } from '../services/websocket.service.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * POST /api/mobile-deployment/deploy
 * Deploy mobile app to stores
 */
router.post(
  '/deploy',
  checkFeatureAccess('deployment'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const {
        projectId,
        platform,
        appType,
        appStoreConfig,
        credentials,
        environment
      } = req.body;

      // Validate input
      if (!projectId) throw new AppError('Project ID is required', 400);
      if (!platform || !['ios', 'android', 'both'].includes(platform)) {
        throw new AppError('Platform must be ios, android, or both', 400);
      }
      if (!appType || !['react-native', 'flutter', 'native-ios', 'native-android'].includes(appType)) {
        throw new AppError('App type must be react-native, flutter, native-ios, or native-android', 400);
      }

      // Fetch project
      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      logger.info(`📱 Deploying mobile app: ${project.name} (${appType}) to ${platform}`);

      // Emit progress update via WebSocket
      webSocketService.broadcast(userId, {
        type: 'mobile_deployment_started',
        projectId,
        platform,
        appType,
        message: 'Mobile deployment started...'
      });

      // Deploy based on app type
      let result;
      const config = {
        platform,
        appType,
        appStoreConfig,
        credentials,
        environment: environment || 'production'
      };

      if (appType === 'react-native') {
        result = await mobileDeploymentService.deployReactNative(projectId, config);
      } else if (appType === 'flutter') {
        result = await mobileDeploymentService.deployFlutter(projectId, config);
      } else if (appType === 'native-ios') {
        result = await mobileDeploymentService.deployNativeIOS(projectId, config);
      } else if (appType === 'native-android') {
        result = await mobileDeploymentService.deployNativeAndroid(projectId, config);
      }

      if (!result || !result.success) {
        webSocketService.broadcast(userId, {
          type: 'mobile_deployment_failed',
          projectId,
          error: result?.error || 'Unknown error'
        });

        throw new AppError(`Mobile deployment failed: ${result?.error}`, 400);
      }

      // Save deployment record
      const deployment = new Deployment({
        projectId,
        userId,
        platform: `mobile-${platform}`,
        status: 'pending',
        deploymentId: result.deploymentId,
        url: result.ios?.testflightUrl || result.android?.playConsoleUrl,
        metadata: {
          appType,
          ios: result.ios,
          android: result.android
        },
        logs: result.logs
      });

      await deployment.save();

      // Emit success event
      webSocketService.broadcast(userId, {
        type: 'mobile_deployment_completed',
        projectId,
        deploymentId: result.deploymentId,
        ios: result.ios,
        android: result.android
      });

      logger.info(`✅ Mobile deployment initiated: ${result.deploymentId}`);

      res.json({
        success: true,
        data: {
          deploymentId: result.deploymentId,
          ios: result.ios,
          android: result.android,
          logs: result.logs
        }
      });
    } catch (error: unknown) {
      logger.error('Mobile deployment route error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/mobile-deployment/status/:deploymentId
 * Get mobile deployment status
 */
router.get(
  '/status/:deploymentId',
  checkFeatureAccess('deployment'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { deploymentId } = req.params;
      const userId = req.user!.id;

      const deployment = await Deployment.findOne({
        deploymentId,
        userId
      });

      if (!deployment) {
        throw new AppError('Deployment not found', 404);
      }

      // Get real-time status from deployment service
      const status = await mobileDeploymentService.getDeploymentStatus(deploymentId);

      res.json({
        success: true,
        data: {
          deploymentId,
          status: status.status,
          ios: status.ios,
          android: status.android,
          logs: status.logs,
          createdAt: deployment.createdAt,
          updatedAt: deployment.updatedAt
        }
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/mobile-deployment/requirements
 * Get requirements for mobile deployment
 */
router.get('/requirements', async (_req, res) => {
  res.json({
    success: true,
    data: {
      ios: {
        required: [
          'Apple Developer Account ($99/year)',
          'Apple App Store Connect access',
          'Expo EAS token or Xcode Cloud credentials',
          'Bundle ID (e.g., com.company.appname)'
        ],
        optional: [
          'TestFlight for beta testing',
          'App Store listing metadata',
          'Screenshots and app preview videos'
        ],
        credentials: {
          expoEAS: {
            token: 'EXPO_EAS_API_TOKEN',
            description: 'Token for Expo Application Services'
          },
          appStoreConnect: {
            issuerId: 'APP_STORE_CONNECT_ISSUER_ID',
            keyId: 'APP_STORE_CONNECT_KEY_ID',
            privateKey: 'APP_STORE_CONNECT_PRIVATE_KEY'
          }
        }
      },
      android: {
        required: [
          'Google Play Developer Account ($25 one-time)',
          'Google Play Console access',
          'Package name (e.g., com.company.appname)',
          'Keystore for signing'
        ],
        optional: [
          'Internal testing track',
          'Play Store listing metadata',
          'Screenshots and feature graphics'
        ],
        credentials: {
          playConsole: {
            serviceAccountJson: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
            description: 'Service account JSON for Google Play API'
          }
        }
      }
    }
  });
});

/**
 * POST /api/mobile-deployment/validate-config
 * Validate mobile deployment configuration
 */
router.post(
  '/validate-config',
  checkFeatureAccess('deployment'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { platform, appType, appStoreConfig, credentials } = req.body;

      const validationResults = {
        ios: { valid: false, missing: [] as string[], warnings: [] as string[] },
        android: { valid: false, missing: [] as string[], warnings: [] as string[] }
      };

      if (platform === 'ios' || platform === 'both') {
        // Check iOS requirements
        if (!process.env.EXPO_EAS_API_TOKEN && !credentials?.ios?.appleId) {
          validationResults.ios.missing.push('Expo EAS token or Apple credentials required');
        }
        if (!appStoreConfig?.bundleId) {
          validationResults.ios.missing.push('Bundle ID required');
        }
        validationResults.ios.valid = validationResults.ios.missing.length === 0;
      }

      if (platform === 'android' || platform === 'both') {
        // Check Android requirements
        if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && !credentials?.android?.keystore) {
          validationResults.android.missing.push('Google Play service account or keystore required');
        }
        if (!appStoreConfig?.bundleId) {
          validationResults.android.missing.push('Package name required');
        }
        validationResults.android.valid = validationResults.android.missing.length === 0;
      }

      const allValid = 
        (platform === 'ios' && validationResults.ios.valid) ||
        (platform === 'android' && validationResults.android.valid) ||
        (platform === 'both' && validationResults.ios.valid && validationResults.android.valid);

      res.json({
        success: true,
        data: {
          valid: allValid,
          ios: platform === 'ios' || platform === 'both' ? validationResults.ios : undefined,
          android: platform === 'android' || platform === 'both' ? validationResults.android : undefined
        }
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/mobile-deployment/platforms
 * Get supported mobile platforms and frameworks
 */
router.get('/platforms', (_req, res) => {
  res.json({
    success: true,
    data: {
      platforms: [
        {
          id: 'ios',
          name: 'iOS',
          appStores: ['App Store', 'TestFlight'],
          minVersion: 'iOS 13.0'
        },
        {
          id: 'android',
          name: 'Android',
          appStores: ['Google Play', 'Internal Testing'],
          minVersion: 'Android 5.0 (API 21)'
        }
      ],
      frameworks: [
        {
          id: 'react-native',
          name: 'React Native',
          platforms: ['ios', 'android'],
          buildTools: ['Expo EAS', 'Xcode', 'Android Studio']
        },
        {
          id: 'flutter',
          name: 'Flutter',
          platforms: ['ios', 'android'],
          buildTools: ['Flutter CLI', 'Codemagic']
        },
        {
          id: 'native-ios',
          name: 'Native iOS (Swift/Obj-C)',
          platforms: ['ios'],
          buildTools: ['Xcode Cloud', 'Fastlane']
        },
        {
          id: 'native-android',
          name: 'Native Android (Kotlin/Java)',
          platforms: ['android'],
          buildTools: ['Gradle', 'Fastlane']
        }
      ]
    }
  });
});

export const mobileDeploymentRoutes = router;
