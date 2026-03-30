
import express from 'express';
import { llmRouter } from '../../services/llm/LLMRouter.js';
import { logger } from '../../utils/logger.js';
import { authenticateToken, AuthRequest } from '../../middleware/auth.js';
import { routeTimeout } from '../../middleware/timeout.js';
import { usageTracker } from '../../services/llm/UsageTracker.js';

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
 * Generate project research (Feasibility, Market, Business Analysis)
 */
router.post('/generate-research', async (req: AuthRequest, res) => {
    try {
        const { topic, ideas } = req.body;

        if (!topic) {
            res.status(400).json({ success: false, message: 'Topic is required' });
            return;
        }

        logger.info(`[Research] Generating research for topic: ${topic}`);

        const prompt = `
      You are a senior market research analyst. Create a comprehensive, professional research report for the following project idea.
      Be specific with numbers, percentages, and market data. Provide realistic estimates based on industry standards.
      Include citations and data sources where applicable.
      
      TOPIC: "${topic}"
      
      KEY IDEAS:
      ${ideas?.map((i: any) => `- ${i.text} (${i.category})`).join('\n') || 'No specific ideas provided yet.'}
      
      Generate a JSON response with this comprehensive structure:
      {
        "executiveSummary": {
          "overview": "2-3 sentence overview of the opportunity",
          "keyPoints": ["Point 1: opportunity insight", "Point 2: market potential", "Point 3: key risk", "Point 4: main conclusion", "Point 5: recommended action"]
        },
        "overallScore": 75,
        "objectivesAndScope": {
          "researchQuestions": ["Is there market demand?", "Who is the target user?", "Who are the main competitors?", "What is the pricing strategy?"],
          "geography": "Global with focus on North America and Europe",
          "segments": "B2B SaaS, SMB to Enterprise",
          "timeframe": "Current market with 3-5 year projections"
        },
        "methodology": {
          "dataSources": ["Industry reports (Gartner, Forrester)", "Competitor analysis", "Market trend data", "User behavior patterns"],
          "timeWindow": "2023-2024 data",
          "limitations": "Based on publicly available data and AI analysis"
        },
        "marketOverview": {
          "definition": "Clear definition of the market category",
          "size": "$X billion",
          "sizeValue": 5000000000,
          "growthStage": "Growth/Mature/Emerging",
          "growthRate": "15% CAGR",
          "macroTrends": ["Macro trend 1 shaping the market", "Macro trend 2", "Macro trend 3"]
        },
        "targetAudience": {
          "description": "Overall target customer description",
          "segments": [
            {"name": "Segment 1", "size": "40%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"},
            {"name": "Segment 2", "size": "35%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"},
            {"name": "Segment 3", "size": "25%", "needs": "Primary needs", "pains": "Key pain points", "willingnessToPay": "High/Medium/Low"}
          ]
        },
        "demandAndBehavior": {
          "demandEvidence": ["Evidence 1: search trends", "Evidence 2: review volume", "Evidence 3: community activity"],
          "searchInterest": "Growing/Stable/Declining with X% change",
          "buyingJourney": "Typical customer journey description",
          "adoptionBarriers": ["Barrier 1", "Barrier 2", "Barrier 3"]
        },
        "competitorLandscape": [
          {"name": "Competitor 1", "offering": "Product description", "pricing": "$X/month", "marketShare": "35%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"},
          {"name": "Competitor 2", "offering": "Product description", "pricing": "$X/month", "marketShare": "25%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"},
          {"name": "Competitor 3", "offering": "Product description", "pricing": "$X/month", "marketShare": "15%", "strengths": "Key strengths", "weaknesses": "Key weaknesses", "differentiation": "How your idea differs"}
        ],
        "pricingSnapshot": {
          "typicalRange": "$X - $Y per month",
          "models": ["Subscription", "Freemium", "Usage-based"],
          "priceSensitivity": "Description of price sensitivity in the market",
          "recommendedStrategy": "Recommended pricing approach"
        },
        "swotAnalysis": {
          "strengths": ["Strength 1", "Strength 2", "Strength 3"],
          "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
          "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
          "threats": ["Threat 1", "Threat 2", "Threat 3"]
        },
        "keyInsights": {
          "topPains": ["Pain 1 from reviews/research", "Pain 2", "Pain 3"],
          "desiredFeatures": ["Feature 1 users want", "Feature 2", "Feature 3"],
          "commonObjections": ["Objection 1", "Objection 2"],
          "trendingUp": ["Rising trend 1", "Rising trend 2"],
          "trendingDown": ["Declining pattern 1"],
          "surprisingFindings": ["Unexpected insight 1", "Unexpected insight 2"]
        },
        "validationChecklist": {
          "targetMarketClarity": {"status": "pass", "notes": "Clear target market identified"},
          "realProblem": {"status": "pass", "notes": "Evidence of genuine pain point"},
          "demandEvidence": {"status": "caution", "notes": "Moderate evidence of demand"},
          "competitionIntensity": {"status": "pass", "notes": "Manageable competition level"},
          "feasibleDifferentiation": {"status": "pass", "notes": "Clear differentiation possible"}
        },
        "feasibility": {
          "technical": "Technical feasibility assessment...",
          "technicalScore": 80,
          "financial": "Financial viability assessment...",
          "financialScore": 70,
          "estimatedCosts": {"development": 50000, "marketing": 25000, "operationsPerYear": 15000},
          "operational": "Operational requirements...",
          "operationalScore": 75,
          "timeToMarket": "6-12 months"
        },
        "keyMetrics": {
          "breakEvenMonths": 18,
          "projectedROI": "150%",
          "customerAcquisitionCost": 50,
          "lifetimeValue": 500
        },
        "recommendations": ["Strategic recommendation 1", "Strategic recommendation 2", "Strategic recommendation 3"]
      }
      
      Be realistic and professional. Use actual market data patterns for similar projects.
      All numeric values should be realistic estimates. Do not include markdown formatting in JSON values.
    `;

        const result = await llmRouter.executeWithFallback({
            prompt,
            context: {
                agentRole: 'Business Analyst',
                taskType: 'analysis'
            },
            routingContext: { userId: req.user?.id },
            requestType: 'research',
            contextType: 'analysis'
        });

        let researchData;
        try {
            // Clean up potential markdown formatting in response
            const cleanJson = result.text.replace(/```json\n?|\n?```/g, '').trim();
            researchData = JSON.parse(cleanJson);
        } catch (parseError) {
            logger.warn('[Research] Failed to parse JSON, returning structure with text content', parseError);
            // Fallback structure
            researchData = {
                executiveSummary: result.text.substring(0, 500) + '...',
                feasibility: { technical: 'Analysis included in full report.', financial: 'Analysis included in full report.', operational: 'Analysis included in full report.' },
                marketAnalysis: { targetAudience: 'Analysis included in full report.', marketSize: 'Analysis included in full report.', trends: [] },
                competitors: [],
                challenges: []
            };
        }

        res.json({
            success: true,
            data: researchData
        });

    } catch (error: any) {
        logger.error('Error generating research:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate research',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

router.post('/deep-research', async (req: AuthRequest, res, _next) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            res.status(400).json({
                success: false,
                message: 'query is required and must be a string'
            });
            return;
        }

        logger.info('[LLMRouter] Performing deep research using best practices...');

        // Build comprehensive research prompt (simplified - full version is very long)
        const researchPrompt = `You are a senior software architect and technical researcher with 20+ years of experience. Conduct thorough, evidence-based research on the provided project topic using online sources and deliver a comprehensive technical specification document.

Research Topic: ${query}

Follow a structured chain-of-thought research process:
1. Topic Decomposition & Analysis
2. Information Gathering & Validation (using online sources)
3. Critical Analysis & Evaluation
4. Synthesis & Recommendation

Provide comprehensive technical specifications covering:
- Core Features & Functionality
- Technical Architecture (including full-stack considerations)
- Backend Architecture Requirements (API design, server architecture, microservices vs monolith)
- Admin Console & Management Interfaces (if needed)
- Infrastructure Needs (deployment, containerization, CI/CD, monitoring, logging)
- Security & Compliance Requirements (authentication, authorization, data protection)
- Database Architecture (SQL/NoSQL selection, schema design, caching)
- API Design & Integrations (REST/GraphQL, external APIs, third-party services)
- Frontend Architecture (client-side architecture, state management, routing)
- DevOps & Deployment Strategy
- Testing Strategy (unit, integration, E2E, performance)
- Technical Requirements
- Implementation Details
- Best Practices & Industry Standards
- Recommendations & Next Steps

**IMPORTANT**: Consider the complete project scope, not just the frontend. Think about what backend services, admin panels, infrastructure, security measures, and other components are needed to create a production-ready, full-stack application.

Use clear, professional technical language. Include specific technologies with versions, concrete examples, measurable metrics, and industry standards. Structure content for easy scanning and implementation. This research will be used for subsequent full architecture analysis, so be thorough and comprehensive.`;

        const startTime = Date.now();

        // Use LLM router with internet search enabled for deep research
        const result = await llmRouter.executeWithFallback({
            prompt: researchPrompt,
            context: {
                agentRole: 'Research Agent',
                taskType: 'research'
            },
            routingContext: {
                userId: (req as any).user?.id
            },
            requestType: 'deep-research',
            contextType: 'other',
            useInternet: true // Enable internet search for comprehensive research
        });

        const latency = Date.now() - startTime;
        logger.info(`[LLMRouter] Deep research completed in ${latency}ms`);

        // Track usage
        try {
            await usageTracker.trackUsage({
                userId: (req as any).user?.userId,
                modelId: result.modelUsed,
                provider: result.provider,
                modelIdentifier: result.modelUsed,
                inputTokens: result.usage?.promptTokens || result.usage?.promptTokenCount || 0,
                outputTokens: result.usage?.candidatesTokens || result.usage?.candidatesTokenCount || 0,
                requestType: 'deep-research',
                success: true,
                latencyMs: latency
            });
        } catch (trackError) {
            logger.error('Failed to track usage for deep-research:', trackError);
        }

        res.json({
            success: true,
            data: {
                research: result.text || ''
            },
            latency: latency
        });
    } catch (error: any) {
        logger.error('[LLMRouter] Deep research failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform deep research',
            error: {
                message: error instanceof Error ? error.message : String(error)
            }
        });
    }
});

/**
 * Full Project Architecture Analysis
 * Analyzes project requirements and identifies all necessary components for a complete project
 */
router.post('/full-architecture-analysis', routeTimeout(120000), async (req: AuthRequest, res, _next) => {
    try {
        const { projectDescription, researchFindings, userRequirements, projectType } = req.body;

        if (!projectDescription || typeof projectDescription !== 'string') {
            res.status(400).json({
                success: false,
                message: 'projectDescription is required and must be a string'
            });
            return;
        }

        logger.info('[LLMRouter] Performing full project architecture analysis...');

        const { fullProjectArchitectureAnalyzer } = await import('../../services/fullProjectArchitectureAnalyzer.service.js');

        const startTime = Date.now();

        const analysis = await fullProjectArchitectureAnalyzer.analyzeArchitecture({
            projectDescription,
            researchFindings,
            userRequirements,
            projectType
        });

        const latency = Date.now() - startTime;
        logger.info(`[LLMRouter] Full architecture analysis completed in ${latency}ms`);

        res.json({
            success: true,
            data: {
                analysis
            },
            latency: latency
        });
    } catch (error: any) {
        logger.error('[LLMRouter] Full architecture analysis failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform full architecture analysis',
            error: {
                message: error instanceof Error ? error.message : String(error)
            }
        });
    }
});

export default router;
