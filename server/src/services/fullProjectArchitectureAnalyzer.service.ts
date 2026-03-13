/**
 * Full Project Architecture Analyzer Service
 * Analyzes project requirements and identifies all necessary components for a complete, production-ready project
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';

export interface FullArchitectureAnalysis {
  backendArchitecture: {
    apiServer: string;
    architecture: 'monolith' | 'microservices' | 'serverless' | 'hybrid';
    framework: string;
    businessLogic: string;
    dataAccess: string;
    backgroundJobs: string;
    realTimeServices: string;
    description: string;
  };
  adminConsole: {
    required: boolean;
    features: string[];
    userManagement: boolean;
    contentManagement: boolean;
    analytics: boolean;
    systemConfiguration: boolean;
    monitoring: boolean;
    description: string;
  };
  infrastructure: {
    applicationServers: string;
    databaseServers: string;
    caching: string;
    messageQueues: string;
    cdn: string;
    monitoring: string;
    logging: string;
    deployment: string;
    description: string;
  };
  securityArchitecture: {
    authentication: string;
    authorization: string;
    dataEncryption: string;
    apiSecurity: string;
    rateLimiting: boolean;
    securityMonitoring: boolean;
    compliance: string[];
    description: string;
  };
  databaseArchitecture: {
    primaryDatabase: string;
    databaseType: 'sql' | 'nosql' | 'hybrid';
    schemaDesign: string;
    cachingStrategy: string;
    backupRecovery: string;
    migrations: string;
    description: string;
  };
  apiDesign: {
    apiStyle: 'REST' | 'GraphQL' | 'gRPC' | 'hybrid';
    endpoints: string[];
    externalIntegrations: string[];
    thirdPartyServices: string[];
    webhooks: string[];
    documentation: string;
    description: string;
  };
  frontendArchitecture: {
    framework: string;
    stateManagement: string;
    routing: string;
    uiFramework: string;
    description: string;
  };
  devOps: {
    deploymentStrategy: string;
    environmentManagement: string;
    backupRecovery: string;
    cicd: string;
    description: string;
  };
  testingStrategy: {
    unitTests: string;
    integrationTests: string;
    e2eTests: string;
    performanceTests: string;
    description: string;
  };
}

export interface ArchitectureAnalysisInput {
  projectDescription: string;
  researchFindings?: string;
  userRequirements?: string;
  projectType?: 'web' | 'mobile' | 'api' | 'desktop' | 'hybrid';
}

class FullProjectArchitectureAnalyzerService {
  /**
   * Analyze project requirements and generate comprehensive architecture analysis
   */
  async analyzeArchitecture(input: ArchitectureAnalysisInput): Promise<FullArchitectureAnalysis> {
    const { projectDescription, researchFindings, userRequirements, projectType } = input;

    logger.info('[ArchitectureAnalyzer] Starting full project architecture analysis...');

    const analysisPrompt = this.buildAnalysisPrompt(input);

    try {
      const result = await llmRouter.executeWithFallback({
        prompt: analysisPrompt,
        context: {
          agentRole: 'Architecture Agent',
          taskType: 'architecture-analysis'
        },
        routingContext: {},
        requestType: 'architecture-analysis',
        contextType: 'wizard',
        useInternet: true // Enable internet research for latest best practices
      });

      // Parse the structured response
      const analysis = this.parseAnalysisResponse(result.text || '', input);

      logger.info('[ArchitectureAnalyzer] Architecture analysis completed successfully');
      return analysis;
    } catch (error: unknown) {
      logger.error('[ArchitectureAnalyzer] Failed to analyze architecture:', error);
      // Return default structure with error indication
      return this.getDefaultAnalysis(input);
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(input: ArchitectureAnalysisInput): string {
    const { projectDescription, researchFindings, userRequirements, projectType } = input;

    return `You are an elite enterprise solutions architect with 20+ years of experience designing production-ready, scalable systems. Analyze the following project requirements and provide a comprehensive architecture analysis covering ALL components needed for a complete, production-ready project.

PROJECT DESCRIPTION:
${projectDescription}

${researchFindings ? `\nINITIAL RESEARCH FINDINGS:\n${researchFindings}` : ''}

${userRequirements ? `\nUSER REQUIREMENTS:\n${userRequirements}` : ''}

${projectType ? `\nPROJECT TYPE: ${projectType}` : ''}

Provide a comprehensive architecture analysis covering the following components:

1. **BACKEND ARCHITECTURE**:
   - API server technology and framework (Express, FastAPI, NestJS, etc.)
   - Architecture pattern (monolith, microservices, serverless, hybrid)
   - Business logic layer design
   - Data access layer design
   - Background jobs/workers requirements
   - WebSocket/real-time services if needed
   - Detailed description of backend components

2. **ADMIN CONSOLE**:
   - Whether an admin console is required
   - Required features (user management, content management, analytics, system configuration, monitoring)
   - User management capabilities needed
   - Content management features
   - Analytics and reporting requirements
   - System configuration needs
   - Monitoring dashboards
   - Detailed description of admin console requirements

3. **INFRASTRUCTURE**:
   - Application server requirements
   - Database server requirements
   - Caching layer (Redis, Memcached, etc.)
   - Message queues (RabbitMQ, Kafka, AWS SQS, etc.)
   - CDN and static hosting needs
   - Monitoring solutions (Prometheus, Datadog, etc.)
   - Logging solutions (ELK, CloudWatch, etc.)
   - Deployment architecture
   - Detailed description of infrastructure components

4. **SECURITY ARCHITECTURE**:
   - Authentication system (JWT, OAuth, SAML, etc.)
   - Authorization and RBAC requirements
   - Data encryption strategies
   - API security measures
   - Rate limiting requirements
   - Security monitoring needs
   - Compliance requirements (GDPR, HIPAA, SOC2, etc.)
   - Detailed description of security measures

5. **DATABASE ARCHITECTURE**:
   - Primary database selection (PostgreSQL, MongoDB, MySQL, etc.)
   - Database type (SQL, NoSQL, hybrid)
   - Schema design approach
   - Caching strategy
   - Backup and recovery plan
   - Database migration strategy
   - Detailed description of database architecture

6. **API DESIGN**:
   - API style (REST, GraphQL, gRPC, hybrid)
   - Key API endpoints needed
   - External API integrations required
   - Third-party services needed
   - Webhook endpoints
   - API documentation requirements
   - Detailed description of API design

7. **FRONTEND ARCHITECTURE**:
   - Frontend framework (React, Vue, Angular, etc.)
   - State management solution
   - Routing solution
   - UI framework/library
   - Detailed description of frontend architecture

8. **DEVOPS**:
   - Deployment strategy (Docker, Kubernetes, serverless, etc.)
   - Environment management (dev, staging, production)
   - Backup and recovery procedures
   - CI/CD pipeline requirements
   - Detailed description of DevOps setup

9. **TESTING STRATEGY**:
   - Unit testing approach
   - Integration testing requirements
   - End-to-end testing needs
   - Performance testing requirements
   - Detailed description of testing strategy

**OUTPUT FORMAT**:
Provide your analysis in a structured JSON format with the following structure:
{
  "backendArchitecture": {
    "apiServer": "technology and framework",
    "architecture": "monolith|microservices|serverless|hybrid",
    "framework": "specific framework name",
    "businessLogic": "description",
    "dataAccess": "description",
    "backgroundJobs": "description",
    "realTimeServices": "description if needed",
    "description": "comprehensive description"
  },
  "adminConsole": {
    "required": true/false,
    "features": ["feature1", "feature2"],
    "userManagement": true/false,
    "contentManagement": true/false,
    "analytics": true/false,
    "systemConfiguration": true/false,
    "monitoring": true/false,
    "description": "comprehensive description"
  },
  "infrastructure": {
    "applicationServers": "description",
    "databaseServers": "description",
    "caching": "solution and description",
    "messageQueues": "solution and description",
    "cdn": "description",
    "monitoring": "solution and description",
    "logging": "solution and description",
    "deployment": "strategy and description",
    "description": "comprehensive description"
  },
  "securityArchitecture": {
    "authentication": "method and description",
    "authorization": "method and description",
    "dataEncryption": "strategy and description",
    "apiSecurity": "measures and description",
    "rateLimiting": true/false,
    "securityMonitoring": true/false,
    "compliance": ["compliance1", "compliance2"],
    "description": "comprehensive description"
  },
  "databaseArchitecture": {
    "primaryDatabase": "database name",
    "databaseType": "sql|nosql|hybrid",
    "schemaDesign": "approach and description",
    "cachingStrategy": "strategy and description",
    "backupRecovery": "plan and description",
    "migrations": "strategy and description",
    "description": "comprehensive description"
  },
  "apiDesign": {
    "apiStyle": "REST|GraphQL|gRPC|hybrid",
    "endpoints": ["endpoint1", "endpoint2"],
    "externalIntegrations": ["integration1", "integration2"],
    "thirdPartyServices": ["service1", "service2"],
    "webhooks": ["webhook1", "webhook2"],
    "documentation": "requirements",
    "description": "comprehensive description"
  },
  "frontendArchitecture": {
    "framework": "framework name",
    "stateManagement": "solution name",
    "routing": "solution name",
    "uiFramework": "framework/library name",
    "description": "comprehensive description"
  },
  "devOps": {
    "deploymentStrategy": "strategy and description",
    "environmentManagement": "description",
    "backupRecovery": "description",
    "cicd": "pipeline description",
    "description": "comprehensive description"
  },
  "testingStrategy": {
    "unitTests": "approach and tools",
    "integrationTests": "approach and tools",
    "e2eTests": "approach and tools",
    "performanceTests": "approach and tools",
    "description": "comprehensive description"
  }
}

**IMPORTANT**: 
- Be specific with technology choices and versions when possible
- Consider scalability, maintainability, and production-readiness
- Include all components necessary for a complete project
- Provide actionable recommendations
- Return ONLY valid JSON, no markdown formatting or code blocks`;
  }

  /**
   * Parse LLM response into structured analysis
   */
  private parseAnalysisResponse(response: string, input: ArchitectureAnalysisInput): FullArchitectureAnalysis {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);
      
      // Validate and normalize the structure
      return this.normalizeAnalysis(parsed);
    } catch (error) {
      logger.warn('[ArchitectureAnalyzer] Failed to parse JSON response, using default structure:', error);
      return this.getDefaultAnalysis(input);
    }
  }

  /**
   * Normalize analysis structure to ensure all fields are present
   */
  private normalizeAnalysis(analysis: any): FullArchitectureAnalysis {
    return {
      backendArchitecture: {
        apiServer: analysis.backendArchitecture?.apiServer || 'Express.js / FastAPI',
        architecture: analysis.backendArchitecture?.architecture || 'monolith',
        framework: analysis.backendArchitecture?.framework || 'Express.js',
        businessLogic: analysis.backendArchitecture?.businessLogic || 'Service layer pattern',
        dataAccess: analysis.backendArchitecture?.dataAccess || 'Repository pattern',
        backgroundJobs: analysis.backendArchitecture?.backgroundJobs || 'Bull queue with Redis',
        realTimeServices: analysis.backendArchitecture?.realTimeServices || 'Socket.io for real-time features',
        description: analysis.backendArchitecture?.description || 'Standard backend architecture'
      },
      adminConsole: {
        required: analysis.adminConsole?.required ?? true,
        features: Array.isArray(analysis.adminConsole?.features) ? analysis.adminConsole.features : ['User Management', 'Content Management'],
        userManagement: analysis.adminConsole?.userManagement ?? true,
        contentManagement: analysis.adminConsole?.contentManagement ?? true,
        analytics: analysis.adminConsole?.analytics ?? true,
        systemConfiguration: analysis.adminConsole?.systemConfiguration ?? true,
        monitoring: analysis.adminConsole?.monitoring ?? true,
        description: analysis.adminConsole?.description || 'Admin console for system management'
      },
      infrastructure: {
        applicationServers: analysis.infrastructure?.applicationServers || 'Node.js / Python application servers',
        databaseServers: analysis.infrastructure?.databaseServers || 'PostgreSQL / MongoDB',
        caching: analysis.infrastructure?.caching || 'Redis for caching',
        messageQueues: analysis.infrastructure?.messageQueues || 'Bull queue with Redis',
        cdn: analysis.infrastructure?.cdn || 'CloudFlare / AWS CloudFront',
        monitoring: analysis.infrastructure?.monitoring || 'Prometheus + Grafana',
        logging: analysis.infrastructure?.logging || 'Winston + ELK stack',
        deployment: analysis.infrastructure?.deployment || 'Docker containers with Kubernetes',
        description: analysis.infrastructure?.description || 'Standard infrastructure setup'
      },
      securityArchitecture: {
        authentication: analysis.securityArchitecture?.authentication || 'JWT-based authentication',
        authorization: analysis.securityArchitecture?.authorization || 'Role-based access control (RBAC)',
        dataEncryption: analysis.securityArchitecture?.dataEncryption || 'AES-256 encryption at rest, TLS in transit',
        apiSecurity: analysis.securityArchitecture?.apiSecurity || 'API key validation, request signing',
        rateLimiting: analysis.securityArchitecture?.rateLimiting ?? true,
        securityMonitoring: analysis.securityArchitecture?.securityMonitoring ?? true,
        compliance: Array.isArray(analysis.securityArchitecture?.compliance) ? analysis.securityArchitecture.compliance : [],
        description: analysis.securityArchitecture?.description || 'Comprehensive security measures'
      },
      databaseArchitecture: {
        primaryDatabase: analysis.databaseArchitecture?.primaryDatabase || 'PostgreSQL',
        databaseType: analysis.databaseArchitecture?.databaseType || 'sql',
        schemaDesign: analysis.databaseArchitecture?.schemaDesign || 'Normalized relational schema',
        cachingStrategy: analysis.databaseArchitecture?.cachingStrategy || 'Redis for frequently accessed data',
        backupRecovery: analysis.databaseArchitecture?.backupRecovery || 'Daily automated backups with point-in-time recovery',
        migrations: analysis.databaseArchitecture?.migrations || 'Version-controlled migrations with rollback support',
        description: analysis.databaseArchitecture?.description || 'Robust database architecture'
      },
      apiDesign: {
        apiStyle: analysis.apiDesign?.apiStyle || 'REST',
        endpoints: Array.isArray(analysis.apiDesign?.endpoints) ? analysis.apiDesign.endpoints : [],
        externalIntegrations: Array.isArray(analysis.apiDesign?.externalIntegrations) ? analysis.apiDesign.externalIntegrations : [],
        thirdPartyServices: Array.isArray(analysis.apiDesign?.thirdPartyServices) ? analysis.apiDesign.thirdPartyServices : [],
        webhooks: Array.isArray(analysis.apiDesign?.webhooks) ? analysis.apiDesign.webhooks : [],
        documentation: analysis.apiDesign?.documentation || 'OpenAPI/Swagger documentation',
        description: analysis.apiDesign?.description || 'Well-designed API architecture'
      },
      frontendArchitecture: {
        framework: analysis.frontendArchitecture?.framework || 'React',
        stateManagement: analysis.frontendArchitecture?.stateManagement || 'React Context / Redux',
        routing: analysis.frontendArchitecture?.routing || 'React Router',
        uiFramework: analysis.frontendArchitecture?.uiFramework || 'Tailwind CSS',
        description: analysis.frontendArchitecture?.description || 'Modern frontend architecture'
      },
      devOps: {
        deploymentStrategy: analysis.devOps?.deploymentStrategy || 'Docker containers with CI/CD',
        environmentManagement: analysis.devOps?.environmentManagement || 'Separate dev, staging, production environments',
        backupRecovery: analysis.devOps?.backupRecovery || 'Automated daily backups',
        cicd: analysis.devOps?.cicd || 'GitHub Actions / GitLab CI',
        description: analysis.devOps?.description || 'Comprehensive DevOps setup'
      },
      testingStrategy: {
        unitTests: analysis.testingStrategy?.unitTests || 'Jest / Vitest for unit testing',
        integrationTests: analysis.testingStrategy?.integrationTests || 'Supertest for API integration tests',
        e2eTests: analysis.testingStrategy?.e2eTests || 'Playwright / Cypress for end-to-end tests',
        performanceTests: analysis.testingStrategy?.performanceTests || 'k6 / Artillery for load testing',
        description: analysis.testingStrategy?.description || 'Comprehensive testing strategy'
      }
    };
  }

  /**
   * Get default analysis structure when parsing fails
   */
  private getDefaultAnalysis(input: ArchitectureAnalysisInput): FullArchitectureAnalysis {
    return this.normalizeAnalysis({});
  }
}

export const fullProjectArchitectureAnalyzer = new FullProjectArchitectureAnalyzerService();


