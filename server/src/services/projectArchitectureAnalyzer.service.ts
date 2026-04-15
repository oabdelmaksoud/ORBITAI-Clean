/**
 * Project Architecture Analyzer Service
 * Analyzes project requirements to determine if backend and admin panel are needed
 * This service helps automatically configure projects for complete software development
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { enhancePrompt } from './promptEngineering.service.js';

export interface ArchitectureRequirements {
  needsBackend: boolean;
  needsAdminPanel: boolean;
  needsMobileApp: boolean; // New: Detects if project needs a mobile app
  backendType?: 'REST' | 'GraphQL' | 'gRPC' | 'Microservices' | 'Serverless';
  adminPanelType?: 'Web Dashboard' | 'Mobile App' | 'Desktop App' | 'CLI Tool';
  mobileAppType?: 'react-native' | 'flutter' | 'native-ios' | 'native-android'; // New: Recommended mobile framework
  reasoning: string;
  confidence: number; // 0-1
  detectedFeatures: {
    dataStorage: boolean;
    userManagement: boolean;
    authentication: boolean;
    apiEndpoints: boolean;
    realTimeFeatures: boolean;
    fileUploads: boolean;
    reporting: boolean;
    analytics: boolean;
    contentManagement: boolean;
    ecommerce: boolean;
    multiTenancy: boolean;
    mobileAccess: boolean; // New: Mobile access needed
    offlineSupport: boolean; // New: Offline functionality needed
    pushNotifications: boolean; // New: Push notifications needed
  };
  recommendations: {
    backend: {
      framework?: string;
      database?: string;
      authentication?: string;
      deployment?: string;
    };
    adminPanel: {
      framework?: string;
      features?: string[];
    };
    mobileApp: {
      // New: Mobile app recommendations
      framework?: 'react-native' | 'flutter' | 'native-ios' | 'native-android';
      platform?: 'ios' | 'android' | 'both';
      reasoning?: string;
    };
  };
}

export interface ProjectAnalysisInput {
  name: string;
  description: string;
  category?: string;
  projectType?: string;
  industry?: string;
  requirements?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
}

class ProjectArchitectureAnalyzerService {
  private initialized: boolean = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('✅ Project Architecture Analyzer service initialized');
  }

  /**
   * Analyze project to determine architecture requirements
   */
  async analyzeArchitecture(input: ProjectAnalysisInput): Promise<ArchitectureRequirements> {
    try {
      await this.initialize();

      const prompt = this.buildAnalysisPrompt(input);
      const context: any = {
        taskType: 'analysis',
        agentRole: 'Architecture Agent',
        projectContext: input.description,
        standards: [],
        complexity: input.complexity || 'moderate',
      };

      const enhancedPrompt = enhancePrompt(prompt, context);

      // Use LLM Router to get best model for analysis
      const response = await (llmRouter as any).routeAndExecute({
        prompt: enhancedPrompt,
        taskType: 'analysis',
        agentRole: 'Architecture Agent',
        context: {
          agentRole: 'Architecture Agent',
          tools: [],
        },
        requiredOutputFormat: 'json',
      });

      // Parse LLM response
      const analysis = this.parseAnalysisResponse(response.content, input);

      logger.info(`Architecture analysis complete for project: ${input.name}`, {
        needsBackend: analysis.needsBackend,
        needsAdminPanel: analysis.needsAdminPanel,
        confidence: analysis.confidence,
      });

      return analysis;
    } catch (error: unknown) {
      logger.error(
        'Architecture analysis failed, using defaults:',
        error instanceof Error ? error.message : String(error)
      );
      // Return safe defaults
      return this.getDefaultArchitecture(input);
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(input: ProjectAnalysisInput): string {
    return `Analyze the following software project and determine if it needs a backend API, admin control panel, and/or a mobile app.

Project Name: ${input.name}
Description: ${input.description}
Category: ${input.category || 'Not specified'}
Project Type: ${input.projectType || 'Not specified'}
Industry: ${input.industry || 'Not specified'}
Complexity: ${input.complexity || 'moderate'}
Requirements: ${input.requirements?.join(', ') || 'Not specified'}

Determine:
1. Does this project need a backend API? (Consider: data storage, user management, API endpoints, server-side processing)
2. Does this project need an admin control panel? (Consider: content management, user administration, analytics, reporting, system configuration)
3. Does this project need a mobile app? (Consider: mobile access, on-the-go usage, native mobile features, app store distribution, offline functionality, push notifications, location services, camera access, mobile-first user experience)

For backend, determine type: REST API, GraphQL API, gRPC, Microservices, or Serverless.
For admin panel, determine type: Web Dashboard, Mobile App, Desktop App, or CLI Tool.
For mobile app, determine framework: React Native (cross-platform), Flutter (cross-platform), Native iOS (Swift/Objective-C), or Native Android (Kotlin/Java).

Mobile app framework selection criteria:
- React Native: Best for projects that need cross-platform support, share codebase with web app, or use JavaScript/TypeScript
- Flutter: Best for projects needing high performance, custom UI, or Dart language preference
- Native iOS: Best for iOS-only apps requiring platform-specific features or maximum performance
- Native Android: Best for Android-only apps requiring platform-specific features or maximum performance

Detect specific features:
- Data storage needs
- User management needs
- Authentication needs
- API endpoints needed
- Real-time features
- File uploads
- Reporting/analytics
- Content management
- E-commerce features
- Multi-tenancy
- Mobile access (users need mobile app)
- Offline support (app works without internet)
- Push notifications (real-time alerts to users)

Provide recommendations for:
- Backend framework (Node.js/Express, Python/Django, Java/Spring, etc.)
- Database (MongoDB, PostgreSQL, MySQL, etc.)
- Authentication method (JWT, OAuth, etc.)
- Deployment (Docker, Kubernetes, Serverless, etc.)
- Admin panel framework (React, Vue, Angular, etc.)
- Admin panel features
- Mobile app framework (react-native, flutter, native-ios, native-android)
- Mobile app platform (ios, android, both)

Respond in JSON format:
{
  "needsBackend": boolean,
  "needsAdminPanel": boolean,
  "needsMobileApp": boolean,
  "backendType": "REST" | "GraphQL" | "gRPC" | "Microservices" | "Serverless",
  "adminPanelType": "Web Dashboard" | "Mobile App" | "Desktop App" | "CLI Tool",
  "mobileAppType": "react-native" | "flutter" | "native-ios" | "native-android",
  "reasoning": "Detailed explanation",
  "confidence": 0.0-1.0,
  "detectedFeatures": {
    "dataStorage": boolean,
    "userManagement": boolean,
    "authentication": boolean,
    "apiEndpoints": boolean,
    "realTimeFeatures": boolean,
    "fileUploads": boolean,
    "reporting": boolean,
    "analytics": boolean,
    "contentManagement": boolean,
    "ecommerce": boolean,
    "multiTenancy": boolean,
    "mobileAccess": boolean,
    "offlineSupport": boolean,
    "pushNotifications": boolean
  },
  "recommendations": {
    "backend": {
      "framework": "string",
      "database": "string",
      "authentication": "string",
      "deployment": "string"
    },
    "adminPanel": {
      "framework": "string",
      "features": ["array of features"]
    },
    "mobileApp": {
      "framework": "react-native" | "flutter" | "native-ios" | "native-android",
      "platform": "ios" | "android" | "both",
      "reasoning": "Why this framework was chosen"
    }
  }
}`;
  }

  /**
   * Parse LLM response into ArchitectureRequirements
   */
  private parseAnalysisResponse(
    response: string,
    input: ProjectAnalysisInput
  ): ArchitectureRequirements {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);

      return {
        needsBackend: parsed.needsBackend === true || parsed.needsBackend === 'true',
        needsAdminPanel: parsed.needsAdminPanel === true || parsed.needsAdminPanel === 'true',
        needsMobileApp: parsed.needsMobileApp === true || parsed.needsMobileApp === 'true',
        backendType: parsed.backendType || 'REST',
        adminPanelType: parsed.adminPanelType || 'Web Dashboard',
        mobileAppType: parsed.mobileAppType || 'react-native',
        reasoning: parsed.reasoning || 'Analysis completed',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        detectedFeatures: {
          dataStorage: parsed.detectedFeatures?.dataStorage || false,
          userManagement: parsed.detectedFeatures?.userManagement || false,
          authentication: parsed.detectedFeatures?.authentication || false,
          apiEndpoints: parsed.detectedFeatures?.apiEndpoints || false,
          realTimeFeatures: parsed.detectedFeatures?.realTimeFeatures || false,
          fileUploads: parsed.detectedFeatures?.fileUploads || false,
          reporting: parsed.detectedFeatures?.reporting || false,
          analytics: parsed.detectedFeatures?.analytics || false,
          contentManagement: parsed.detectedFeatures?.contentManagement || false,
          ecommerce: parsed.detectedFeatures?.ecommerce || false,
          multiTenancy: parsed.detectedFeatures?.multiTenancy || false,
          mobileAccess: parsed.detectedFeatures?.mobileAccess || false,
          offlineSupport: parsed.detectedFeatures?.offlineSupport || false,
          pushNotifications: parsed.detectedFeatures?.pushNotifications || false,
        },
        recommendations: {
          backend: {
            framework: parsed.recommendations?.backend?.framework || 'Node.js/Express',
            database: parsed.recommendations?.backend?.database || 'MongoDB',
            authentication: parsed.recommendations?.backend?.authentication || 'JWT',
            deployment: parsed.recommendations?.backend?.deployment || 'Docker',
          },
          adminPanel: {
            framework: parsed.recommendations?.adminPanel?.framework || 'React',
            features: parsed.recommendations?.adminPanel?.features || [],
          },
          mobileApp: {
            framework: parsed.recommendations?.mobileApp?.framework || 'react-native',
            platform: parsed.recommendations?.mobileApp?.platform || 'both',
            reasoning:
              parsed.recommendations?.mobileApp?.reasoning || 'Cross-platform support recommended',
          },
        },
      };
    } catch (error: unknown) {
      logger.warn(
        'Failed to parse LLM response, using rule-based analysis:',
        error instanceof Error ? error.message : String(error)
      );
      return this.ruleBasedAnalysis(input);
    }
  }

  /**
   * Rule-based fallback analysis
   */
  private ruleBasedAnalysis(input: ProjectAnalysisInput): ArchitectureRequirements {
    const description = (input.description || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const combined = `${name} ${description}`;

    // Keywords that indicate backend needs
    const backendKeywords = [
      'api',
      'backend',
      'server',
      'database',
      'storage',
      'user',
      'authentication',
      'login',
      'register',
      'account',
      'profile',
      'data',
      'crud',
      'rest',
      'graphql',
      'endpoint',
      'service',
      'microservice',
      'ecommerce',
      'payment',
      'order',
      'cart',
      'checkout',
      'admin',
      'dashboard',
      'analytics',
      'report',
      'upload',
      'file',
      'real-time',
      'websocket',
      'socket',
      'notification',
      'email',
    ];

    // Keywords that indicate admin panel needs
    const adminKeywords = [
      'admin',
      'dashboard',
      'control panel',
      'management',
      'cms',
      'content management',
      'user management',
      'analytics',
      'reporting',
      'settings',
      'configuration',
      'monitoring',
      'logs',
      'audit',
      'permissions',
      'roles',
      'multi-tenant',
    ];

    // Keywords that indicate mobile app needs
    const mobileKeywords = [
      'mobile',
      'app',
      'ios',
      'android',
      'iphone',
      'smartphone',
      'tablet',
      'app store',
      'play store',
      'mobile app',
      'native app',
      'react native',
      'flutter',
      'on-the-go',
      'offline',
      'push notification',
      'location',
      'camera',
      'mobile-first',
      'responsive mobile',
      'mobile experience',
    ];

    const needsBackend = backendKeywords.some(keyword => combined.includes(keyword));
    const needsAdminPanel =
      adminKeywords.some(keyword => combined.includes(keyword)) || needsBackend;
    const needsMobileApp = mobileKeywords.some(keyword => combined.includes(keyword));

    // Determine backend type
    let backendType: 'REST' | 'GraphQL' | 'gRPC' | 'Microservices' | 'Serverless' = 'REST';
    if (combined.includes('graphql')) backendType = 'GraphQL';
    else if (combined.includes('grpc') || combined.includes('microservice'))
      backendType = 'Microservices';
    else if (combined.includes('serverless') || combined.includes('lambda'))
      backendType = 'Serverless';

    // Determine mobile app framework
    let mobileAppType: 'react-native' | 'flutter' | 'native-ios' | 'native-android' =
      'react-native';
    if (combined.includes('flutter')) mobileAppType = 'flutter';
    else if (
      combined.includes('native ios') ||
      combined.includes('swift') ||
      combined.includes('objective-c')
    )
      mobileAppType = 'native-ios';
    else if (
      combined.includes('native android') ||
      combined.includes('kotlin') ||
      combined.includes('java android')
    )
      mobileAppType = 'native-android';
    else if (combined.includes('react native')) mobileAppType = 'react-native';

    // Determine mobile platform
    let mobilePlatform: 'ios' | 'android' | 'both' = 'both';
    if (combined.includes('ios only') || combined.includes('iphone only')) mobilePlatform = 'ios';
    else if (combined.includes('android only')) mobilePlatform = 'android';

    return {
      needsBackend,
      needsAdminPanel,
      needsMobileApp,
      backendType,
      adminPanelType: 'Web Dashboard',
      mobileAppType,
      reasoning: needsBackend
        ? 'Project requires backend for data management and API endpoints'
        : needsMobileApp
          ? 'Project requires mobile app for mobile access'
          : 'Project appears to be frontend-only',
      confidence: 0.6,
      detectedFeatures: {
        dataStorage: needsBackend,
        userManagement: combined.includes('user') || combined.includes('account'),
        authentication: combined.includes('login') || combined.includes('auth'),
        apiEndpoints: needsBackend,
        realTimeFeatures: combined.includes('real-time') || combined.includes('websocket'),
        fileUploads: combined.includes('upload') || combined.includes('file'),
        reporting: combined.includes('report') || combined.includes('analytics'),
        analytics: combined.includes('analytics') || combined.includes('statistics'),
        contentManagement: combined.includes('cms') || combined.includes('content'),
        ecommerce: combined.includes('ecommerce') || combined.includes('payment'),
        multiTenancy: combined.includes('multi-tenant') || combined.includes('tenant'),
        mobileAccess: needsMobileApp,
        offlineSupport: combined.includes('offline') || combined.includes('sync'),
        pushNotifications: combined.includes('push') || combined.includes('notification'),
      },
      recommendations: {
        backend: {
          framework: 'Node.js/Express',
          database: 'MongoDB',
          authentication: 'JWT',
          deployment: 'Docker',
        },
        adminPanel: {
          framework: 'React',
          features: needsAdminPanel ? ['User Management', 'Dashboard', 'Analytics'] : [],
        },
        mobileApp: {
          framework: mobileAppType,
          platform: mobilePlatform,
          reasoning: needsMobileApp
            ? `Recommended ${mobileAppType} for ${mobilePlatform === 'both' ? 'cross-platform' : mobilePlatform} support`
            : 'No mobile app needed',
        },
      },
    };
  }

  /**
   * Get default architecture (when analysis fails)
   */
  private getDefaultArchitecture(_input: ProjectAnalysisInput): ArchitectureRequirements {
    return {
      needsBackend: false,
      needsAdminPanel: false,
      needsMobileApp: false,
      backendType: 'REST',
      adminPanelType: 'Web Dashboard',
      mobileAppType: 'react-native',
      reasoning: 'Default configuration - analysis unavailable',
      confidence: 0.5,
      detectedFeatures: {
        dataStorage: false,
        userManagement: false,
        authentication: false,
        apiEndpoints: false,
        realTimeFeatures: false,
        fileUploads: false,
        reporting: false,
        analytics: false,
        contentManagement: false,
        ecommerce: false,
        multiTenancy: false,
        mobileAccess: false,
        offlineSupport: false,
        pushNotifications: false,
      },
      recommendations: {
        backend: {
          framework: 'Node.js/Express',
          database: 'MongoDB',
          authentication: 'JWT',
          deployment: 'Docker',
        },
        adminPanel: {
          framework: 'React',
          features: [],
        },
        mobileApp: {
          framework: 'react-native',
          platform: 'both',
          reasoning: 'No mobile app needed',
        },
      },
    };
  }
}

export const projectArchitectureAnalyzer = new ProjectArchitectureAnalyzerService();
