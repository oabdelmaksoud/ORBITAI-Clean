import { Express } from 'express';
import { rateLimiter, adminRateLimiter, featureFlagsCheckRateLimiter } from '../middleware/rateLimiter.js';

import route_0 from '../routes/adminAuth.routes.js';
import route_1 from '../routes/audit.routes.js';
import route_2 from '../routes/featureFlags.routes.js';
import route_3 from '../routes/adminEnhanced.routes.js';
import route_4 from '../routes/adminSystemDetails.routes.js';
import route_5 from '../routes/packages.routes.js';
import route_6 from '../routes/llmManagement.routes.js';
import route_7 from '../routes/llmAnalytics.routes.js';
import route_8 from '../routes/apiKeys.routes.js';
import route_9 from '../routes/financialLive.routes.js';
import route_10 from '../routes/pageContent.routes.js';
import route_11 from '../routes/pageBuilder.routes.js';
import route_12 from '../routes/agentKnowledge.routes.js';
import route_13 from '../routes/agentKnowledgeLearning.routes.js';
import route_14 from '../routes/processImprovement.routes.js';
import route_15 from '../routes/neo4j.routes.js';
import route_16 from '../routes/processMining.routes.js';
import route_17 from '../routes/nlp.routes.js';
import route_18 from '../routes/processAnalytics.routes.js';
import route_19 from '../routes/workflow.routes.js';
import route_20 from '../routes/collaborativeWiki.routes.js';
import route_21 from '../routes/aiOptimization.routes.js';
import route_22 from '../routes/processSimulation.routes.js';
import route_23 from '../routes/complianceAudit.routes.js';
import route_24 from '../routes/communitySharing.routes.js';
import route_25 from '../routes/notifications.routes.js';
import route_26 from '../routes/security.routes.js';
import route_27 from '../routes/backup.routes.js';
import route_28 from '../routes/alerts.routes.js';
import route_29 from '../routes/activity.routes.js';
import route_30 from '../routes/userAnalytics.routes.js';
import route_31 from '../routes/financialAdvanced.routes.js';
import route_32 from '../routes/performance.routes.js';
import route_33 from '../routes/reportBuilder.routes.js';
import route_34 from '../routes/adminDatabase.routes.js';
import route_35 from '../routes/adminSystemControl.routes.js';
import route_36 from '../routes/adminMonitoring.routes.js';
import route_37 from '../routes/adminModeration.routes.js';
import route_38 from '../routes/adminIntegrations.routes.js';
import route_39 from '../routes/adminRateLimiting.routes.js';
import route_40 from '../routes/adminSystemCosts.routes.js';
import route_41 from '../routes/adminLLMRouter.routes.js';
import route_42 from '../routes/adminLLMRouterAI.routes.js';
import route_43 from '../routes/routerABTest.routes.js';
import route_44 from '../routes/modelBenchmark.routes.js';
import route_45 from '../routes/quota.routes.js';
import route_46 from '../routes/adminInternalRouter.routes.js';
import route_47 from '../routes/modelSync.routes.js';
import route_48 from '../routes/internalRouting.routes.js';
import route_49 from '../routes/grapesPages.routes.js';
import route_50 from '../routes/supportTickets.routes.js';
import route_51 from '../routes/supportChat.routes.js';
import route_52 from '../routes/admin.routes.js';
import route_53 from '../routes/publicPackages.routes.js';
import route_54 from '../routes/publicPageContent.routes.js';
import route_55 from '../routes/demo.routes.js';
import route_56 from '../routes/cua.routes.js';
import route_57 from '../routes/auth.routes.js';
import route_58 from '../routes/userSettings.routes.js';
import route_59 from '../routes/project.routes.js';
import route_60 from '../routes/agent.routes.js';
import route_61 from '../routes/task.routes.js';
import route_62 from '../routes/artifact.routes.js';
import route_63 from '../routes/health.routes.js';
import route_64 from '../routes/config.routes.js';
import route_65 from '../routes/test.routes.js';

import route_67 from '../routes/anomalyDetection.routes.js';
import route_68 from '../routes/autoConfiguration.routes.js';
import route_69 from '../routes/codebase.routes.js';
import route_70 from '../routes/auth.routes.js';
import route_71 from '../routes/userSettings.routes.js';
import route_72 from '../routes/project.routes.js';
import route_73 from '../routes/agent.routes.js';
import route_74 from '../routes/task.routes.js';
import route_75 from '../routes/artifact.routes.js';
import route_76 from '../routes/health.routes.js';
import route_77 from '../routes/config.routes.js';
import route_78 from '../routes/test.routes.js';

import route_80 from '../routes/anomalyDetection.routes.js';
import route_81 from '../routes/autoConfiguration.routes.js';
import route_82 from '../routes/codebase.routes.js';
import route_83 from '../routes/projectExport.routes.js';
import route_84 from '../routes/mcp.routes.js';
import route_85 from '../routes/mcpServer.routes.js';
import route_86 from '../routes/sync.routes.js';
import route_87 from '../routes/customAgent.routes.js';
import route_88 from '../routes/backgroundTasks.routes.js';
import route_89 from '../routes/backgroundAutoPilot.routes.js';
import route_90 from '../routes/llamaindex.routes.js';
import route_91 from '../routes/knowledgeGraph.routes.js';
import route_92 from '../routes/langchain.routes.js';
import route_93 from '../routes/crewai.routes.js';
import route_94 from '../routes/langgraph.routes.js';
import route_95 from '../routes/autogen.routes.js';
import route_96 from '../routes/standards.routes.js';
import route_97 from '../routes/standardsResearch.routes.js';
import route_98 from '../routes/sdlc.routes.js';
import route_99 from '../routes/templates.routes.js';
import route_100 from '../routes/terminal.routes.js';
import route_101 from '../routes/chat.routes.js';
import route_102 from '../routes/projectFolder.routes.js';
import route_103 from '../routes/brainstormingRoom.routes.js';
import route_104 from '../routes/brainstormingRoom.routes.js';
import route_105 from '../routes/ideationMap.routes.js';
import route_106 from '../routes/ideationMap.routes.js';
import route_107 from '../routes/transcription.routes.js';
import route_108 from '../routes/requirements.routes.js';
import route_109 from '../routes/compliance.routes.js';
import route_110 from '../routes/technicalDebt.routes.js';
import route_111 from '../routes/issueTaskCreation.routes.js';
import route_112 from '../routes/issueTaskCreation.routes.js';
import route_113 from '../routes/aiSuggestions.routes.js';
import route_114 from '../routes/notebook.routes.js';
import route_115 from '../routes/aiAgentAssignment.routes.js';
import route_116 from '../routes/deployments.routes.js';
import route_117 from '../routes/payment.routes.js';
import route_118 from '../routes/hosting.routes.js';
import route_119 from '../routes/imageGeneration.routes.js';
import route_120 from '../routes/gameAssets.routes.js';
import route_121 from '../routes/gameMechanics.routes.js';
import route_122 from '../routes/dynamicTooling.routes.js';
import route_123 from '../routes/integrations.routes.js';
import route_124 from '../routes/slack.routes.js';
import route_125 from '../routes/googleDrive.routes.js';
import route_126 from '../routes/github.routes.js';
import route_127 from '../routes/msteams.routes.js';
import route_128 from '../routes/collaboration.routes.js';
import route_129 from '../routes/fileUpload.routes.js';
import route_130 from '../routes/speech.routes.js';
import route_131 from '../routes/maturityAssessment.routes.js';
import route_132 from '../routes/company.routes.js';
import { codeGeneratorRoutes } from '../routes/codeGenerator.routes.js';
import { frontendCodeGeneratorRoutes } from '../routes/frontendCodeGenerator.routes.js';
import { codeValidationRoutes } from '../routes/codeValidation.routes.js';
import { mobileDeploymentRoutes } from '../routes/mobileDeployment.routes.js';
import { multiCloudRoutes } from '../routes/multiCloud.routes.js';
import { deploymentRoutes } from '../routes/deploymentOrchestrator.routes.js';
import { userRouter as llmUsageUserRoutes } from '../routes/llmUsage.routes.js';

// Auto-generated route configuration
export interface RouteConfig {
  path: string;
  router: any;
  filename: string;
  middleware?: any;
}

export const routes: RouteConfig[] = [
  {
    path: '/api/admin-auth',
    router: route_0,
    filename: 'adminAuth.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/audit',
    router: route_1,
    filename: 'audit.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/feature-flags',
    router: route_2,
    filename: 'featureFlags.routes',
    middleware: featureFlagsCheckRateLimiter,
  },
  {
    path: '/api/admin',
    router: route_3,
    filename: 'adminEnhanced.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/system',
    router: route_4,
    filename: 'adminSystemDetails.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/packages',
    router: route_5,
    filename: 'packages.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm',
    router: route_6,
    filename: 'llmManagement.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm-analytics',
    router: route_7,
    filename: 'llmAnalytics.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/api-keys',
    router: route_8,
    filename: 'apiKeys.routes',
  },
  {
    path: '/api/admin/financial',
    router: route_9,
    filename: 'financialLive.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/page-content',
    router: route_10,
    filename: 'pageContent.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/page-builder',
    router: route_11,
    filename: 'pageBuilder.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/agent-knowledge',
    router: route_12,
    filename: 'agentKnowledge.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/agent-knowledge',
    router: route_13,
    filename: 'agentKnowledgeLearning.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/process-improvements',
    router: route_14,
    filename: 'processImprovement.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/neo4j',
    router: route_15,
    filename: 'neo4j.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/process-mining',
    router: route_16,
    filename: 'processMining.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/nlp',
    router: route_17,
    filename: 'nlp.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/process-analytics',
    router: route_18,
    filename: 'processAnalytics.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/workflows',
    router: route_19,
    filename: 'workflow.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/collaborative-wiki',
    router: route_20,
    filename: 'collaborativeWiki.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/ai-optimization',
    router: route_21,
    filename: 'aiOptimization.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/process-simulation',
    router: route_22,
    filename: 'processSimulation.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/compliance',
    router: route_23,
    filename: 'complianceAudit.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/community',
    router: route_24,
    filename: 'communitySharing.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/notifications',
    router: route_25,
    filename: 'notifications.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/security',
    router: route_26,
    filename: 'security.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/backups',
    router: route_27,
    filename: 'backup.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/alerts',
    router: route_28,
    filename: 'alerts.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/activity',
    router: route_29,
    filename: 'activity.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/analytics/users',
    router: route_30,
    filename: 'userAnalytics.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/financial',
    router: route_31,
    filename: 'financialAdvanced.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/performance',
    router: route_32,
    filename: 'performance.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/reports',
    router: route_33,
    filename: 'reportBuilder.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/database',
    router: route_34,
    filename: 'adminDatabase.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/system',
    router: route_35,
    filename: 'adminSystemControl.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/monitoring',
    router: route_36,
    filename: 'adminMonitoring.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/moderation',
    router: route_37,
    filename: 'adminModeration.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/integrations',
    router: route_38,
    filename: 'adminIntegrations.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/rate-limits',
    router: route_39,
    filename: 'adminRateLimiting.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/system-costs',
    router: route_40,
    filename: 'adminSystemCosts.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm-router',
    router: route_41,
    filename: 'adminLLMRouter.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm-router/ai',
    router: route_42,
    filename: 'adminLLMRouterAI.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm-router',
    router: route_43,
    filename: 'routerABTest.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm-router',
    router: route_44,
    filename: 'modelBenchmark.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/llm-router/quotas',
    router: route_45,
    filename: 'quota.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/internal-router',
    router: route_46,
    filename: 'adminInternalRouter.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/models',
    router: route_47,
    filename: 'modelSync.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/admin/internal-routing',
    router: route_48,
    filename: 'internalRouting.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/pages',
    router: route_49,
    filename: 'grapesPages.routes',
  },
  {
    path: '/api/support',
    router: route_50,
    filename: 'supportTickets.routes',
  },
  {
    path: '/api/support',
    router: route_51,
    filename: 'supportChat.routes',
  },
  {
    path: '/api/admin',
    router: route_52,
    filename: 'admin.routes',
    middleware: adminRateLimiter,
  },
  {
    path: '/api/packages/public',
    router: route_53,
    filename: 'publicPackages.routes',
  },
  {
    path: '/api/page-content/public',
    router: route_54,
    filename: 'publicPageContent.routes',
  },
  {
    path: '/api/demo',
    router: route_55,
    filename: 'demo.routes',
  },
  {
    path: '/api/cua',
    router: route_56,
    filename: 'cua.routes',
  },
  {
    path: '/api/v1/auth',
    router: route_57,
    filename: 'auth.routes',
  },
  {
    path: '/api/v1/user/settings',
    router: route_58,
    filename: 'userSettings.routes',
  },
  {
    path: '/api/v1/projects',
    router: route_59,
    filename: 'project.routes',
  },
  {
    path: '/api/v1/agents',
    router: route_60,
    filename: 'agent.routes',
  },
  {
    path: '/api/v1/tasks',
    router: route_61,
    filename: 'task.routes',
  },
  {
    path: '/api/v1/artifacts',
    router: route_62,
    filename: 'artifact.routes',
  },
  {
    path: '/api/v1/health',
    router: route_63,
    filename: 'health.routes',
  },
  {
    path: '/api/v1/config',
    router: route_64,
    filename: 'config.routes',
  },
  {
    path: '/api/v1/test',
    router: route_65,
    filename: 'test.routes',
  },

  {
    path: '/api/v1/anomalies',
    router: route_67,
    filename: 'anomalyDetection.routes',
  },
  {
    path: '/api/v1/auto-config',
    router: route_68,
    filename: 'autoConfiguration.routes',
  },
  {
    path: '/api/v1/codebase',
    router: route_69,
    filename: 'codebase.routes',
  },
  {
    path: '/api/auth',
    router: route_70,
    filename: 'auth.routes',
  },
  {
    path: '/api/user/settings',
    router: route_71,
    filename: 'userSettings.routes',
  },
  {
    path: '/api/projects',
    router: route_72,
    filename: 'project.routes',
  },
  {
    path: '/api/agents',
    router: route_73,
    filename: 'agent.routes',
  },
  {
    path: '/api/tasks',
    router: route_74,
    filename: 'task.routes',
  },
  {
    path: '/api/artifacts',
    router: route_75,
    filename: 'artifact.routes',
  },
  {
    path: '/api/health',
    router: route_76,
    filename: 'health.routes',
  },
  {
    path: '/api/config',
    router: route_77,
    filename: 'config.routes',
  },
  {
    path: '/api/test',
    router: route_78,
    filename: 'test.routes',
  },

  {
    path: '/api/anomalies',
    router: route_80,
    filename: 'anomalyDetection.routes',
  },
  {
    path: '/api/auto-config',
    router: route_81,
    filename: 'autoConfiguration.routes',
  },
  {
    path: '/api/codebase',
    router: route_82,
    filename: 'codebase.routes',
  },
  {
    path: '/api/project-export',
    router: route_83,
    filename: 'projectExport.routes',
  },
  {
    path: '/api/mcp',
    router: route_84,
    filename: 'mcp.routes',
  },
  {
    path: '/api/mcp-servers',
    router: route_85,
    filename: 'mcpServer.routes',
  },
  {
    path: '/api/sync',
    router: route_86,
    filename: 'sync.routes',
  },
  {
    path: '/api/custom-agents',
    router: route_87,
    filename: 'customAgent.routes',
  },
  {
    path: '/api/background-tasks',
    router: route_88,
    filename: 'backgroundTasks.routes',
  },
  {
    path: '/api/background-autopilot',
    router: route_89,
    filename: 'backgroundAutoPilot.routes',
  },
  {
    path: '/api/llamaindex',
    router: route_90,
    filename: 'llamaindex.routes',
  },
  {
    path: '/api/knowledge-graph',
    router: route_91,
    filename: 'knowledgeGraph.routes',
  },
  {
    path: '/api/langchain',
    router: route_92,
    filename: 'langchain.routes',
  },
  {
    path: '/api/crewai',
    router: route_93,
    filename: 'crewai.routes',
  },
  {
    path: '/api/langgraph',
    router: route_94,
    filename: 'langgraph.routes',
  },
  {
    path: '/api/autogen',
    router: route_95,
    filename: 'autogen.routes',
  },
  {
    path: '/api/standards',
    router: route_96,
    filename: 'standards.routes',
  },
  {
    path: '/api/standards-research',
    router: route_97,
    filename: 'standardsResearch.routes',
  },
  {
    path: '/api/sdlc',
    router: route_98,
    filename: 'sdlc.routes',
  },
  {
    path: '/api/templates',
    router: route_99,
    filename: 'templates.routes',
  },
  {
    path: '/api/terminal',
    router: route_100,
    filename: 'terminal.routes',
  },
  {
    path: '/api/chat',
    router: route_101,
    filename: 'chat.routes',
  },
  {
    path: '/api/project-folders',
    router: route_102,
    filename: 'projectFolder.routes',
  },
  {
    path: '/api/brainstorming-rooms',
    router: route_103,
    filename: 'brainstormingRoom.routes',
  },
  {
    path: '/api/v1/brainstorming-rooms',
    router: route_104,
    filename: 'brainstormingRoom.routes',
  },
  {
    path: '/api/ideation-map',
    router: route_105,
    filename: 'ideationMap.routes',
  },
  {
    path: '/api/v1/ideation-map',
    router: route_106,
    filename: 'ideationMap.routes',
  },
  {
    path: '/api/transcriptions',
    router: route_107,
    filename: 'transcription.routes',
  },
  {
    path: '/api/v1/requirements',
    router: route_108,
    filename: 'requirements.routes',
  },
  {
    path: '/api/v1/compliance',
    router: route_109,
    filename: 'compliance.routes',
  },
  {
    path: '/api/v1/technical-debt',
    router: route_110,
    filename: 'technicalDebt.routes',
  },
  {
    path: '/api/v1/issues',
    router: route_111,
    filename: 'issueTaskCreation.routes',
  },
  {
    path: '/api/issues',
    router: route_112,
    filename: 'issueTaskCreation.routes',
  },
  {
    path: '/api/ai',
    router: route_113,
    filename: 'aiSuggestions.routes',
  },
  {
    path: '/api/notebook',
    router: route_114,
    filename: 'notebook.routes',
  },
  {
    path: '/api/ai-agents',
    router: route_115,
    filename: 'aiAgentAssignment.routes',
  },
  {
    path: '/api/deployments',
    router: route_116,
    filename: 'deployments.routes',
  },
  {
    path: '/api/payment',
    router: route_117,
    filename: 'payment.routes',
  },
  {
    path: '/api/hosting',
    router: route_118,
    filename: 'hosting.routes',
  },
  {
    path: '/api/images',
    router: route_119,
    filename: 'imageGeneration.routes',
  },
  {
    path: '/api/game-assets',
    router: route_120,
    filename: 'gameAssets.routes',
  },
  {
    path: '/api/game-mechanics',
    router: route_121,
    filename: 'gameMechanics.routes',
  },
  {
    path: '/api/tools',
    router: route_122,
    filename: 'dynamicTooling.routes',
  },
  {
    path: '/api/integrations',
    router: route_123,
    filename: 'integrations.routes',
  },
  {
    path: '/api/integrations/slack',
    router: route_124,
    filename: 'slack.routes',
  },
  {
    path: '/api/integrations/google-drive',
    router: route_125,
    filename: 'googleDrive.routes',
  },
  {
    path: '/api/integrations/github',
    router: route_126,
    filename: 'github.routes',
  },
  {
    path: '/api/integrations/msteams',
    router: route_127,
    filename: 'msteams.routes',
  },
  {
    path: '/api/collaboration',
    router: route_128,
    filename: 'collaboration.routes',
  },
  {
    path: '/api/files',
    router: route_129,
    filename: 'fileUpload.routes',
  },
  {
    path: '/api/speech',
    router: route_130,
    filename: 'speech.routes',
  },
  {
    path: '/api/maturity-assessment',
    router: route_131,
    filename: 'maturityAssessment.routes',
  },
  {
    path: '/api/company',
    router: route_132,
    filename: 'company.routes',
  },
  {
    path: '/api/v1/code-generation',
    router: codeGeneratorRoutes,
    filename: 'codeGenerator.routes',
  },
  {
    path: '/api/code-generation',
    router: codeGeneratorRoutes,
    filename: 'codeGenerator.routes',
  },
  {
    path: '/api/frontend-generation',
    router: frontendCodeGeneratorRoutes,
    filename: 'frontendCodeGenerator.routes',
  },
  {
    path: '/api/code-validation',
    router: codeValidationRoutes,
    filename: 'codeValidation.routes',
  },
  {
    path: '/api/mobile-deployment',
    router: mobileDeploymentRoutes,
    filename: 'mobileDeployment.routes',
  },
  {
    path: '/api/multi-cloud',
    router: multiCloudRoutes,
    filename: 'multiCloud.routes',
  },
  {
    path: '/api/v1/deployments',
    router: deploymentRoutes,
    filename: 'deploymentOrchestrator.routes',
  },
  {
    path: '/api/deployments',
    router: deploymentRoutes,
    filename: 'deploymentOrchestrator.routes',
  },
  {
    path: '/api/v1/llm-usage',
    router: llmUsageUserRoutes,
    filename: 'llmUsage.routes',
  },
  {
    path: '/api/llm-usage',
    router: llmUsageUserRoutes,
    filename: 'llmUsage.routes',
  },
];
