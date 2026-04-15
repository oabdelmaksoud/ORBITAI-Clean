
import express from 'express';
import { llmRouter } from '../../services/llm/LLMRouter.js';
import { logger } from '../../utils/logger.js';

import { authenticateToken, AuthRequest } from '../../middleware/auth.js';
import { sdlcMatchingService } from '../../services/sdlcMatching.service.js';
import { standardsMatchingService } from '../../services/standardsMatching.service.js';
import { Type, Schema } from '@google/genai';
import { responseCache } from '../../services/llm/ResponseCache.js';

import { EnhancedPreviewGenerator } from '../../services/enhancedPreviewGenerator.service.js';

import crypto from 'crypto';
import { mapToSupportedMethodology, getFallbackStandards, detectProjectType } from '../../utils/llmRouteHelpers.js';
import { geminiService } from '../../services/gemini.service.js';

const router = express.Router();
export const path = '/api/llm';

// Optional authentication
router.use((req: AuthRequest, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        authenticateToken(req, res, () => next());
    } else {
        next();
    }
});

/**
 * Generate project preview (for wizard)
 * Uses LLM router to select best model for this task
 * Note: Uses structured output which requires specific model support
 */
router.post('/generate-preview', async (req: AuthRequest, res, _next) => {
    try {
        const { userGoal, conversationHistory, useInternet = false, useEnhanced = true, isRegeneration = false, conversationId, runInBackground = true, brainstormingContext } = req.body;

        if (!userGoal) {
            res.status(400).json({
                success: false,
                message: 'userGoal is required'
            });
            return;
        }

        // Allow guest users with a generated guest ID
        const userId = req.user?.id || `guest-${crypto.randomUUID()}`;

        // ------------------------------------------------------------------
        // PARSE STRUCTURED GOAL (Move to top to be available for all paths)
        // ------------------------------------------------------------------
        const structuredSections = userGoal.match(/^(PROJECT TOPIC|INITIAL REQUEST|ADDITIONAL REQUIREMENTS|PROJECT IDEAS|UPDATED PROJECT IDEAS|KEY INSIGHTS|NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT):/m);
        const isStructured = !!structuredSections;

        let projectTopic = '';
        let initialRequest = '';
        let additionalRequirements = '';
        let projectIdeas = '';
        let keyInsights = '';
        let nextSteps = '';
        let selectedStandards = '';
        let currentContext = '';

        if (isStructured) {
            const topicMatch = userGoal.match(/PROJECT TOPIC:\s*([\s\S]+?)(?=\n\n|$)/);
            const initialMatch = userGoal.match(/INITIAL REQUEST:\s*([\s\S]+?)(?=\n\nADDITIONAL|$)/);
            const additionalMatch = userGoal.match(/ADDITIONAL REQUIREMENTS:\s*([\s\S]+?)(?=\n\n(?:PROJECT IDEAS|UPDATED PROJECT IDEAS|KEY INSIGHTS|NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/);
            const ideasMatch = userGoal.match(/(?:PROJECT IDEAS|UPDATED PROJECT IDEAS) & REQUIREMENTS[^:]*:\s*([\s\S]+?)(?=\n\n(?:KEY INSIGHTS|NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/);
            const insightsMatch = userGoal.match(/KEY INSIGHTS:\s*([\s\S]+?)(?=\n\n(?:NEXT STEPS|SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/);
            const stepsMatch = userGoal.match(/NEXT STEPS:\s*([\s\S]+?)(?=\n\n(?:SELECTED STANDARDS|CURRENT PROJECT CONTEXT)|$)/);
            const standardsMatch = userGoal.match(/SELECTED STANDARDS:\s*([\s\S]+?)(?=\n\nCURRENT PROJECT CONTEXT|$)/);
            const contextMatch = userGoal.match(/CURRENT PROJECT CONTEXT[^:]*:\s*([\s\S]+?)$/);

            if (topicMatch) projectTopic = topicMatch[1].trim();
            if (initialMatch) initialRequest = initialMatch[1].trim();
            if (additionalMatch) additionalRequirements = additionalMatch[1].trim();
            if (ideasMatch) projectIdeas = ideasMatch[1].trim();
            if (insightsMatch) keyInsights = insightsMatch[1].trim();
            if (stepsMatch) nextSteps = stepsMatch[1].trim();
            if (standardsMatch) selectedStandards = standardsMatch[1].trim();
            if (contextMatch) currentContext = contextMatch[1].trim();
        }
        // ------------------------------------------------------------------

        // Project Name inference
        const projectName = (req.body.projectName || (isStructured ? projectTopic : null) || userGoal.split(' ').slice(0, 3).join(' ')).trim().substring(0, 50);

        // If conversationId is provided and runInBackground is true, start background job
        if (conversationId && runInBackground) {
            const { backgroundPrototypeGenerationService } = await import('../../services/backgroundPrototypeGeneration.service.js');

            const jobId = await backgroundPrototypeGenerationService.startGeneration(
                conversationId,
                userId,
                userGoal,
                conversationHistory || [],
                useInternet || false,
                useEnhanced !== false,
                isRegeneration || false,
                brainstormingContext || null
            );

            return res.json({
                success: true,
                jobId,
                message: 'Prototype generation started in background'
            });
            return;
        }

        // Determine Project Type for template selection
        // Using simple keyword matching on goal + ideas + requirements
        const fullDescription = `${userGoal} ${projectIdeas} ${additionalRequirements} ${initialRequest}`.toLowerCase();

        // Use imported helper
        const detectedType = detectProjectType(fullDescription);


        // ------------------------------------------------------------------
        // ENHANCED PREVIEW GENERATION PATH
        // ------------------------------------------------------------------
        if (useEnhanced) {
            const generator = new EnhancedPreviewGenerator();
            logger.info(`[Preview] Using ENHANCED generator via generatePreview orchestration`);

            try {
                const result = await generator.generatePreview(
                    userGoal,
                    conversationHistory || [],
                    useInternet,
                    (stage, progress, message) => logger.info(`[EnhancedPreview] ${stage}: ${progress}% - ${message}`),
                    userId,
                    undefined, // projectId
                    isRegeneration,
                    brainstormingContext
                );

                res.json({
                    success: true,
                    data: result,
                    latency: 0
                });
                return;

            } catch (enhancedError: any) {
                logger.error('[Preview] Enhanced generation failed, falling back to legacy:', enhancedError);
                // Fall through to legacy path
            }
        }

        // ------------------------------------------------------------------
        // LEGACY GENERATION PATH (Fallback)
        // ------------------------------------------------------------------

        // Conversation history context
        const conversationText = conversationHistory && conversationHistory.length > 0
            ? conversationHistory.map((m: any) => `${m.sender}: ${m.text}`).join('\n')
            : '';

        // Methodology matching
        let recommendedMethodology = 'Agile';
        let sdlcReasoning = '';

        try {
            const methodologyResult = await sdlcMatchingService.recommendMethodology({
                name: userGoal.substring(0, 50),
                description: fullDescription,
                teamSize: 50,
                complexity: 'moderate'
            });
            recommendedMethodology = mapToSupportedMethodology(methodologyResult.methodology);
            sdlcReasoning = methodologyResult.reasoning;
        } catch (sdlcError) {
            logger.warn('SDLC matching failed, using default Agile:', sdlcError);
        }

        // Standards matching
        let recommendedStandards: string[] = [];

        const standardsResult = await standardsMatchingService.findMatchingStandards({
            name: userGoal.substring(0, 50),
            description: fullDescription
        });

        if (standardsResult && standardsResult.recommended.length > 0) {
            recommendedStandards = standardsResult.recommended.map(s => s.standard.id || 'ISO9001');
        } else {
            try {
                const fallbackStandards = getFallbackStandards(fullDescription, userGoal);
                if (fallbackStandards.length > 0) {
                    recommendedStandards = fallbackStandards;
                }
            } catch (fallbackError) {
                logger.error('Fallback standards matching failed:', fallbackError);
            }
        }

        const limitedConversationText = conversationHistory && conversationHistory.length > 15
            ? conversationHistory.slice(-15).map((m: any) => `${m.sender}: ${m.text}`).join('\n').substring(0, 1500)
            : conversationText.substring(0, 1500);

        // If internet is enabled, perform research first to enhance the prompt
        let researchContext = '';
        if (useInternet) {
            try {
                logger.info(`[Preview] Performing internet research for project: ${userGoal.substring(0, 100)}...`);

                const researchPrompt = `Research the latest information about building a project like: "${userGoal}"

Focus on:
1. Current industry best practices
2. Recommended technologies and frameworks (latest versions)
3. Common implementation patterns
4. Important considerations and potential challenges
5. Relevant standards or compliance requirements

Keep the research concise and focused on actionable insights.`;

                const researchResult = await llmRouter.executeWithFallback({
                    prompt: researchPrompt,
                    context: {
                        agentRole: 'Research Agent',
                        taskType: 'research'
                    },
                    routingContext: {
                        userId: (req as any).user?.id
                    },
                    requestType: 'research',
                    contextType: 'wizard',
                    useInternet: true // Enable internet search
                });

                researchContext = researchResult.text || '';
                if (researchContext) {
                    researchContext = researchContext.substring(0, 2000); // Limit research context
                    logger.info(`[Preview] Internet research completed (${researchContext.length} chars)`);
                }
            } catch (researchError: any) {
                logger.warn('[Preview] Internet research failed, continuing without it:', researchError.message);
                // Continue without research if it fails
            }
        }

        // Perform full architecture analysis
        let architectureAnalysis: any = null;
        try {
            logger.info(`[Preview] Performing full architecture analysis for project: ${userGoal.substring(0, 100)}...`);
            const { fullProjectArchitectureAnalyzer } = await import('../../services/fullProjectArchitectureAnalyzer.service.js');

            const projectTypeMap: Record<string, 'web' | 'mobile' | 'api' | 'desktop' | 'hybrid' | undefined> = {
                'website': 'web',
                'mobile-app': 'mobile',
                'api': 'api',
                'game': 'web', // Games are typically web-based
                'unknown': undefined
            };

            architectureAnalysis = await fullProjectArchitectureAnalyzer.analyzeArchitecture({
                projectDescription: userGoal,
                researchFindings: researchContext,
                userRequirements: limitedConversationText,
                projectType: projectTypeMap[detectedType] || undefined
            });

            logger.info('[Preview] Full architecture analysis completed');
        } catch (archError: any) {
            logger.warn('[Preview] Architecture analysis failed, continuing without it:', archError.message);
            // Continue without architecture analysis if it fails
        }


        // Build comprehensive prompt (full version from gemini.routes.ts)
        const researchSection = researchContext
            ? `\n\n**INTERNET RESEARCH RESULTS** (Latest information and best practices):\n${researchContext}\n\nUse this research to inform your recommendations, especially for tech stack selection and best practices.`
            : '';

        const architectureSection = architectureAnalysis
            ? `\n\n**FULL PROJECT ARCHITECTURE ANALYSIS** (Complete component breakdown):
      
**Backend Architecture**: ${architectureAnalysis.backendArchitecture.description}
- API Server: ${architectureAnalysis.backendArchitecture.apiServer}
- Architecture Pattern: ${architectureAnalysis.backendArchitecture.architecture}
- Framework: ${architectureAnalysis.backendArchitecture.framework}

**Admin Console**: ${architectureAnalysis.adminConsole.required ? 'Required' : 'Not Required'}
${architectureAnalysis.adminConsole.required ? `- Features: ${architectureAnalysis.adminConsole.features.join(', ')}` : ''}
${architectureAnalysis.adminConsole.description}

**Infrastructure**: ${architectureAnalysis.infrastructure.description}
- Application Servers: ${architectureAnalysis.infrastructure.applicationServers}
- Database: ${architectureAnalysis.infrastructure.databaseServers}
- Caching: ${architectureAnalysis.infrastructure.caching}
- Deployment: ${architectureAnalysis.infrastructure.deployment}

**Security**: ${architectureAnalysis.securityArchitecture.description}
- Authentication: ${architectureAnalysis.securityArchitecture.authentication}
- Authorization: ${architectureAnalysis.securityArchitecture.authorization}

**Database**: ${architectureAnalysis.databaseArchitecture.description}
- Primary Database: ${architectureAnalysis.databaseArchitecture.primaryDatabase}
- Type: ${architectureAnalysis.databaseArchitecture.databaseType}

**API Design**: ${architectureAnalysis.apiDesign.description}
- Style: ${architectureAnalysis.apiDesign.apiStyle}
- Key Endpoints: ${architectureAnalysis.apiDesign.endpoints.join(', ') || 'To be determined'}

Use this architecture analysis to inform your project preview generation, ensuring all identified components are considered.`
            : '';

        const prompt = `
    ROLE: Elite Solutions Architect & Creative Technologist.
    
    MISSION: 
    Analyze the user's request and perform two key actions:
    1. **Deep Analysis**: Infer specific domain requirements, user flows, and technical needs based on your knowledge${useInternet ? ' and the latest internet research' : ''} and the provided context.
    2. **Generate Assets**: Create a structured project brief AND a **FULLY FUNCTIONAL** interactive prototype.

    ${isStructured ? `PROJECT INFORMATION (Structured):
    
    ${projectTopic ? `**PROJECT TOPIC**: ${projectTopic}` : ''}
    
    ${initialRequest ? `**INITIAL REQUEST**:\n${initialRequest}` : `**USER GOAL**: "${userGoal.substring(0, 500)}"`}
    
    ${additionalRequirements ? `**ADDITIONAL REQUIREMENTS**:\n${additionalRequirements}` : ''}
    
    ${projectIdeas ? `**PROJECT IDEAS & REQUIREMENTS**:\n${projectIdeas}` : ''}
    
    ${keyInsights ? `**KEY INSIGHTS**:\n${keyInsights}` : ''}
    
    ${nextSteps ? `**NEXT STEPS**:\n${nextSteps}` : ''}
    
    ${selectedStandards ? `**SELECTED STANDARDS**:\n${selectedStandards}` : ''}
    
    ${currentContext ? `**CURRENT PROJECT CONTEXT** (for reference during regeneration):\n${currentContext}` : ''}
    
    ` : `**USER GOAL**: "${userGoal}"`}
    
    **CONVERSATION HISTORY** (CRITICAL - This conversation refines and enhances the project requirements. All refinements, clarifications, and new ideas from this conversation MUST be incorporated into the Blueprint, Architecture, Prototype, and Code):
    ${limitedConversationText}
    
    ${limitedConversationText.length > 0 ? `**IMPORTANT**: The conversation above contains user refinements, clarifications, and enhancements to the project. These MUST be reflected in:
    - Blueprint: Update project structure, features, and requirements based on conversation
    - Architecture: Adjust system design based on conversation insights
    - Prototype: Incorporate all discussed features and refinements
    - Code: Implement all requirements mentioned in the conversation
    
    Pay special attention to:
    - Any new features or requirements mentioned
    - Changes to existing requirements
    - User preferences and constraints discussed
    - Technical decisions made during the conversation
    - Any clarifications or corrections provided` : ''}
    
    ${researchSection}${architectureSection}
    
    **SELECTED SDLC METHODOLOGY**: ${recommendedMethodology}
    ${sdlcReasoning ? `**REASONING**: ${sdlcReasoning}` : ''}
    
    OBJECTIVES & FORMAT:
    
    1. **Project Name**: Generate a concise, descriptive project name (max 50 characters)
    2. **Executive Summary**: A strategic, professional summary of the project${useInternet ? ' (incorporate latest best practices from research)' : ''}.
    3. **Tech Stack**: Best modern stack based on project type${useInternet ? ' and latest research' : ''}. Return as list of strings.
    4. **Architecture**: A MermaidJS "C4 Container" diagram code string (raw mermaid code, no markdown blocks)
    5. **Prototype (PRODUCTION-LEVEL CODE)**:
       **CRITICAL**: Generate enterprise-grade, production-ready code that follows industry best practices:
       - Use React 18+ with modern hooks.
       - Use Tailwind CSS.
       - Use React.createElement() instead of JSX.
       - Include high-quality assets (Unsplash, etc), NO placeholders.
       - Return a SINGLE HTML file string.
       
    6. **Risks**: Top 3 technical risks.
    7. **Methodology**: Use the methodology "${recommendedMethodology}"
    
    **IMPORTANT**: This is an agentic AI system that works autonomously. DO NOT include human effort estimates.
    
    Return a valid JSON object.`;

        const responseSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
                wireframeCode: { type: Type.STRING },
                architectureDiagram: { type: Type.STRING },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendedMethodology: { type: Type.STRING },
                recommendedStandards: { type: Type.ARRAY, items: { type: Type.STRING } },
                projectName: { type: Type.STRING },
                mobileCode: {
                    type: Type.OBJECT,
                    properties: {
                        reactNative: { type: Type.STRING },
                        flutter: { type: Type.STRING },
                        iosSwift: { type: Type.STRING },
                        androidKotlin: { type: Type.STRING }
                    }
                }
            },
            required: ["summary", "techStack", "wireframeCode", "architectureDiagram", "risks", "recommendedMethodology", "projectName"]
        };

        // Check cache
        const cachedPreview = responseCache.get(
            `${userGoal}\n\n${limitedConversationText.substring(0, 500)}`,
            'preview-generation',
            undefined,
            { type: 'preview', projectName }
        );

        let result: any;
        const startTime = Date.now();

        if (cachedPreview) {
            try {
                result = JSON.parse(cachedPreview.response);
                result = JSON.parse(cachedPreview.response);
                logger.info(`[Preview Cache] Cache HIT - saved $${cachedPreview.cost.toFixed(6)}`);
            } catch (parseError) {
                logger.warn('[Preview Cache] Failed to parse cached response, generating new preview');
            }
        }

        // Generate new preview if not cached
        if (!result) {
            try {
                // Use LLM router to select best model, then use structured output

                // Model selection logic (simplified for refactor)
                const selectedModel = { modelIdentifier: 'gemini-2.5-pro' }; // Default fallback

                // Use Gemini's structured output with selected model
                result = await geminiService.generateStructuredOutput(prompt, responseSchema, selectedModel.modelIdentifier);

                // Cache the result (omitted details for brevity)

            } catch (error: unknown) {
                logger.error('Preview generation failed:', error);
                throw new Error(`Preview generation failed: ${error instanceof Error ? error.message : 'Model unavailable'}`);
            }
        }

        const latency = Date.now() - startTime;

        // Validate result
        if (!result || typeof result !== 'object') {
            throw new Error('Preview generation failed: Invalid response format');
        }

        // Ensure arrays
        if (!Array.isArray(result.techStack)) {
            result.techStack = result.techStack ? [result.techStack] : [];
        }
        if (!Array.isArray(result.risks)) {
            result.risks = result.risks ? [result.risks] : [];
        }

        // Override with SDLC service recommendations
        result.recommendedMethodology = recommendedMethodology;

        if (recommendedStandards.length > 0) {
            result.recommendedStandards = recommendedStandards;
        } else if (!Array.isArray(result.recommendedStandards)) {
            result.recommendedStandards = getFallbackStandards(fullDescription, userGoal);
        }

        // Add architecture analysis to result if available
        if (architectureAnalysis) {
            result.backendArchitecture = architectureAnalysis.backendArchitecture;
            result.adminConsole = architectureAnalysis.adminConsole;
            result.infrastructure = architectureAnalysis.infrastructure;
            result.securityArchitecture = architectureAnalysis.securityArchitecture;
            result.databaseArchitecture = architectureAnalysis.databaseArchitecture;
            result.apiDesign = architectureAnalysis.apiDesign;
        }

        res.json({
            success: true,
            data: result,
            latency: latency
        });
        return;
    } catch (error: unknown) {
        logger.error('[LLMRouter] Generate preview failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate project preview',
            error: {
                message: error instanceof Error ? error.message : 'Unknown error'
            }
        });
        return;
    }
});

/**
 * GET /api/llm/prototype-generation/:jobId/status
 * Get status of a prototype generation job
 */
router.get('/prototype-generation/:jobId/status', authenticateToken, async (req: AuthRequest, res, next) => {
    try {
        const { jobId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const { backgroundPrototypeGenerationService } = await import('../../services/backgroundPrototypeGeneration.service.js');
        const job = await backgroundPrototypeGenerationService.getJobStatus(jobId);

        if (!job) {
            res.status(404).json({
                success: false,
                message: 'Job not found'
            });
            return;
        }

        // Verify user owns this job
        if (job.userId !== userId) {
            res.status(403).json({
                success: false,
                message: 'Access denied'
            });
            return;
        }

        res.json({
            success: true,
            job: {
                id: job._id.toString(),
                status: job.status,
                progress: job.progress,
                currentStage: job.currentStage,
                result: job.result,
                error: job.error,
                startedAt: job.startedAt,
                completedAt: job.completedAt
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/llm/prototype-generation/conversation/:conversationId
 * Get the latest prototype generation job for a conversation
 */
router.get('/prototype-generation/conversation/:conversationId', authenticateToken, async (req: AuthRequest, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const { backgroundPrototypeGenerationService } = await import('../../services/backgroundPrototypeGeneration.service.js');
        const job = await backgroundPrototypeGenerationService.getJobByConversation(conversationId);

        if (!job) {
            res.status(404).json({
                success: false,
                message: 'No job found for this conversation'
            });
            return;
        }

        if (job.userId !== userId) {
            res.status(403).json({
                success: false,
                message: 'Access denied'
            });
            return;
        }

        res.json({
            success: true,
            job: {
                id: job._id.toString(),
                status: job.status,
                progress: job.progress,
                currentStage: job.currentStage,
                result: job.result,
                error: job.error,
                startedAt: job.startedAt,
                completedAt: job.completedAt
            }
        });

    } catch (error) {
        next(error);
    }
});

export default router;
