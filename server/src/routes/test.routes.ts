import express from 'express';
import { geminiService } from '../services/gemini.service.js';
import { logger } from '../utils/logger.js';
import { apiKeyProvider } from '../services/apiKeyProvider.service.js';

const router = express.Router();

// Test Gemini API connection
router.get('/gemini', async (_req, res, _next): Promise<void> => {
  try {
    // Check if API key is configured (from database)
    const hasKey = await apiKeyProvider.hasApiKey('gemini');
    if (!hasKey) {
      res.status(500).json({
        success: false,
        message: 'Gemini API key is not configured',
        error: {
          message: 'Gemini API key not found. Add it via Admin Console → Settings → API Keys'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info('Testing Gemini API connection...');

    const testPrompt = 'Say "Hello, Gemini API is working!" in one sentence.';

    const startTime = Date.now();
    const result = await geminiService.generateContent(
      testPrompt,
      'gemini-2.5-flash'
    );
    const latency = Date.now() - startTime;

    logger.info(`Gemini API test completed in ${latency}ms`);

    res.json({
      success: true,
      message: 'Gemini API connection successful!',
      test: {
        prompt: testPrompt,
        response: result.text,
        latency: `${latency}ms`,
        usage: result.usage || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('Gemini API test failed:', error);

    res.status(500).json({
      success: false,
      message: 'Gemini API connection failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Test E2B API connection
router.get('/e2b', async (_req, res, _next): Promise<void> => {
  try {
    const { e2bService } = await import('../services/e2b.service.js');

    // Check if API key is configured (checks database first, then env)
    const isConfigured = await e2bService.isConfigured();
    if (!isConfigured) {
      res.status(500).json({
        success: false,
        message: 'E2B API key is not configured',
        error: {
          message: 'E2B_API_KEY is not set. Add it via Admin Console or set E2B_API_KEY environment variable.'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info('Testing E2B API connection...');

    const startTime = Date.now();

    // Test sandbox creation and a simple command
    const sandbox = await e2bService.getSandbox();
    const result = await e2bService.runCommand('echo "E2B Sandbox is working!"');
    const latency = Date.now() - startTime;

    logger.info(`E2B API test completed in ${latency}ms`);

    res.json({
      success: true,
      message: 'E2B API connection successful!',
      test: {
        command: 'echo "E2B Sandbox is working!"',
        output: result.output,
        latency: `${latency}ms`,
        sandboxActive: true
      },
      timestamp: new Date().toISOString()
    });

    // Clean up
    await e2bService.close();
  } catch (error: unknown) {
    logger.error('E2B API test failed:', error);

    res.status(500).json({
      success: false,
      message: 'E2B API connection failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Test MCP tools
router.get('/mcp', async (_req, res, _next): Promise<void> => {
  try {
    const { mcpService } = await import('../services/mcp.service.js');
    const { DEFAULT_MCP_SERVERS } = await import('../../../constants.js');

    logger.info('Testing MCP tool discovery...');

    const activeServers = DEFAULT_MCP_SERVERS.filter(s => s.status === 'active');
    const allTools = await mcpService.getAllTools(activeServers);

    const toolsByServer: Record<string, any[]> = {};
    for (const [serverId, tools] of allTools.entries()) {
      toolsByServer[serverId] = tools;
    }

    res.json({
      success: true,
      message: 'MCP tool discovery successful!',
      test: {
        servers: activeServers.length,
        totalTools: Array.from(allTools.values()).reduce((sum, tools) => sum + tools.length, 0),
        toolsByServer
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('MCP test failed:', error);

    res.status(500).json({
      success: false,
      message: 'MCP test failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Test all API keys and services
router.get('/all', async (_req, res, _next): Promise<void> => {
  try {
    const { config } = await import('../config/env.js');
    const { e2bService } = await import('../services/e2b.service.js');
    const { mcpService } = await import('../services/mcp.service.js');
    const { DEFAULT_MCP_SERVERS } = await import('../../../constants.js');

    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');
    const e2bConfigured = await e2bService.isConfigured();
    const geminiConfigured = await apiKeyProvider.hasApiKey('gemini');

    const results: Record<string, any> = {
      gemini: {
        configured: geminiConfigured,
        status: 'not tested'
      },
      e2b: {
        configured: e2bConfigured,
        status: 'not tested'
      },
      mcp: {
        servers: DEFAULT_MCP_SERVERS.length,
        status: 'not tested'
      }
    };

    // Test Gemini
    if (geminiConfigured) {
      try {
        const geminiTest = await geminiService.generateContent('Say "OK"', 'gemini-2.5-flash');
        results.gemini.status = 'working';
        results.gemini.response = geminiTest.text.substring(0, 50);
      } catch (error: unknown) {
        results.gemini.status = 'error';
        results.gemini.error = error.message;
      }
    } else {
      results.gemini.status = 'not configured';
    }

    // Test E2B
    if (e2bConfigured) {
      try {
        const e2bResult = await e2bService.runCommand('echo "test"');
        results.e2b.status = 'working';
        results.e2b.output = e2bResult.output;
        // Don't close sandbox here - let it persist for reuse, or close safely
        try {
          await e2bService.close();
        } catch (closeError) {
          // Ignore close errors - sandbox may auto-close or not have close method
        }
      } catch (error: unknown) {
        results.e2b.status = 'error';
        results.e2b.error = error.message;
      }
    } else {
      results.e2b.status = 'not configured';
    }

    // Test MCP
    try {
      const activeServers = DEFAULT_MCP_SERVERS.filter(s => s.status === 'active');
      const allTools = await mcpService.getAllTools(activeServers);
      results.mcp.status = 'working';
      results.mcp.tools = Array.from(allTools.values()).reduce((sum, tools) => sum + tools.length, 0);
    } catch (error: unknown) {
      results.mcp.status = 'error';
      results.mcp.error = error.message;
    }

    const allWorking = results.gemini.status === 'working' &&
                      (results.e2b.status === 'working' || results.e2b.status === 'not configured') &&
                      results.mcp.status === 'working';

    res.json({
      success: allWorking,
      message: allWorking ? 'All services operational!' : 'Some services have issues',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('Comprehensive test failed:', error);

    res.status(500).json({
      success: false,
      message: 'Comprehensive test failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Test Gemini API with structured output
router.get('/gemini/structured', async (_req, res, _next): Promise<void> => {
  try {
    const hasKey = await apiKeyProvider.hasApiKey('gemini');
    if (!hasKey) {
      res.status(500).json({
        success: false,
        message: 'Gemini API key is not configured. Add it via Admin Console → Settings → API Keys'
      });
      return;
    }

    logger.info('Testing Gemini API structured output...');

    const prompt = 'Generate a simple project name and description for a todo app.';

    const schema: any = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['name', 'description']
    };

    const startTime = Date.now();
    const result = await geminiService.generateStructuredOutput(prompt, schema);
    const latency = Date.now() - startTime;

    logger.info(`Gemini structured output test completed in ${latency}ms`);

    res.json({
      success: true,
      message: 'Gemini API structured output test successful!',
      test: {
        prompt: prompt,
        response: result,
        latency: `${latency}ms`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('Gemini structured output test failed:', error);

    res.status(500).json({
      success: false,
      message: 'Gemini API structured output test failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Test MCP Google Search
router.get('/mcp/google-search', async (req, res, _next): Promise<void> => {
  try {
    const { mcpService } = await import('../services/mcp.service.js');
    const { config } = await import('../config/env.js');
    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');

    const query = (req.query.q as string) || 'React best practices 2024';

    logger.info(`Testing MCP Google Search with query: "${query}"`);

    // Check configuration (from database)
    const geminiConfigured = await apiKeyProvider.hasApiKey('gemini');
    const engineId = await apiKeyProvider.getGoogleSearchEngineId();
    const customSearchConfigured = await apiKeyProvider.hasApiKey('google_search') && !!engineId;

    const configInfo = {
      geminiApiKey: geminiConfigured ? 'configured' : 'not configured',
      googleCustomSearchApi: customSearchConfigured ? 'configured' : 'not configured',
      note: geminiConfigured
        ? 'For Gemini models, Google Search uses native grounding (useInternet=true). No Custom Search API needed.'
        : 'For non-Gemini models, configure Google Search API key and Engine ID via Admin Console → Settings → API Keys'
    };

    // Test Google Search tool execution
    let searchResult: any = null;
    let error: unknown = null;

    try {
      const startTime = Date.now();
      searchResult = await mcpService.callTool('mcp-sys-3', 'google_search', {
        query,
        num_results: 3
      });
      const latency = Date.now() - startTime;

      logger.info(`MCP Google Search test completed in ${latency}ms`);

      res.json({
        success: true,
        message: 'MCP Google Search test successful!',
        test: {
          query,
          latency: `${latency}ms`,
          config: configInfo,
          result: searchResult,
          source: searchResult?.source || 'unknown'
        },
        timestamp: new Date().toISOString()
      });
    } catch (searchError: any) {
      error = searchError;
      logger.error('MCP Google Search test failed:', searchError);

      res.status(500).json({
        success: false,
        message: 'MCP Google Search test failed',
        test: {
          query,
          config: configInfo,
          error: {
            message: searchError.message || 'Unknown error',
            ...(process.env.NODE_ENV === 'development' && { stack: searchError.stack })
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: unknown) {
    logger.error('MCP Google Search test setup failed:', error);

    res.status(500).json({
      success: false,
      message: 'MCP Google Search test setup failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Test all LLM providers
router.get('/llm-providers', async (_req, res, _next): Promise<void> => {
  try {
    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');
    const results: Record<string, any> = {};

    const testPrompt = 'Say "OK" in one word.';

    // Test Gemini
    const geminiConfigured = await apiKeyProvider.hasApiKey('gemini');
    results.gemini = {
      configured: geminiConfigured,
      status: 'not tested',
      provider: 'Google',
      models: ['gemini-2.5-flash', 'gemini-3-pro-preview']
    };

    if (geminiConfigured) {
      try {
        const startTime = Date.now();
        const result = await geminiService.generateContent(testPrompt, 'gemini-2.5-flash');
        const latency = Date.now() - startTime;
        results.gemini.status = 'working';
        results.gemini.latency = `${latency}ms`;
        results.gemini.response = result.text.substring(0, 50);
        results.gemini.tokensUsed = result.usage?.totalTokenCount || 0;
      } catch (error: unknown) {
        results.gemini.status = 'error';
        results.gemini.error = error.message || 'Unknown error';
      }
    } else {
      results.gemini.status = 'not configured';
    }

    // Test OpenAI
    const openaiConfigured = await apiKeyProvider.hasApiKey('openai');
    results.openai = {
      configured: openaiConfigured,
      status: 'not tested',
      provider: 'OpenAI',
      models: ['gpt-4o', 'gpt-4o-mini']
    };

    if (openaiConfigured) {
      try {
        const { OpenAIService } = await import('../services/llm/providers/OpenAIService.js');
        const openaiService = new OpenAIService();
        const startTime = Date.now();
        const result = await openaiService.generateContent(testPrompt, 'gpt-4o-mini');
        const latency = Date.now() - startTime;
        results.openai.status = 'working';
        results.openai.latency = `${latency}ms`;
        results.openai.response = result.text.substring(0, 50);
        results.openai.tokensUsed = result.usage.totalTokens;
      } catch (error: unknown) {
        results.openai.status = 'error';
        results.openai.error = error.message || 'Unknown error';
      }
    } else {
      results.openai.status = 'not configured';
    }

    // Test Anthropic
    const anthropicConfigured = await apiKeyProvider.hasApiKey('anthropic');
    results.anthropic = {
      configured: anthropicConfigured,
      status: 'not tested',
      provider: 'Anthropic',
      models: ['claude-3-5-sonnet-20241022']
    };

    if (anthropicConfigured) {
      try {
        const { AnthropicService } = await import('../services/llm/providers/AnthropicService.js');
        const anthropicService = new AnthropicService();
        const startTime = Date.now();
        const result = await anthropicService.generateContent(testPrompt, 'claude-3-5-sonnet-20241022');
        const latency = Date.now() - startTime;
        results.anthropic.status = 'working';
        results.anthropic.latency = `${latency}ms`;
        results.anthropic.response = result.text.substring(0, 50);
        results.anthropic.tokensUsed = result.usage.totalTokens;
      } catch (error: unknown) {
        results.anthropic.status = 'error';
        results.anthropic.error = error.message || 'Unknown error';
      }
    } else {
      results.anthropic.status = 'not configured';
    }

    // Test DeepSeek
    const deepseekConfigured = await apiKeyProvider.hasApiKey('deepseek');
    results.deepseek = {
      configured: deepseekConfigured,
      status: 'not tested',
      provider: 'DeepSeek',
      models: ['deepseek-chat', 'deepseek-coder']
    };

    if (deepseekConfigured) {
      try {
        const { DeepSeekService } = await import('../services/llm/providers/DeepSeekService.js');
        const deepseekService = new DeepSeekService();
        const startTime = Date.now();
        const result = await deepseekService.generateContent(testPrompt, 'deepseek-chat');
        const latency = Date.now() - startTime;
        results.deepseek.status = 'working';
        results.deepseek.latency = `${latency}ms`;
        results.deepseek.response = result.text.substring(0, 50);
        results.deepseek.tokensUsed = result.usage.totalTokens;
      } catch (error: unknown) {
        results.deepseek.status = 'error';
        results.deepseek.error = error.message || 'Unknown error';
      }
    } else {
      results.deepseek.status = 'not configured';
    }

    // Test Grok
    const grokConfigured = await apiKeyProvider.hasApiKey('grok');
    results.grok = {
      configured: grokConfigured,
      status: 'not tested',
      provider: 'xAI (Grok)',
      models: ['grok-3']
    };

    if (grokConfigured) {
      try {
        const { GrokService } = await import('../services/llm/providers/GrokService.js');
        const grokService = new GrokService();
        const startTime = Date.now();
        const result = await grokService.generateContent(testPrompt, 'grok-3');
        const latency = Date.now() - startTime;
        results.grok.status = 'working';
        results.grok.latency = `${latency}ms`;
        results.grok.response = result.text.substring(0, 50);
        results.grok.tokensUsed = result.usage.totalTokens;
      } catch (error: unknown) {
        results.grok.status = 'error';
        results.grok.error = error.message || 'Unknown error';
      }
    } else {
      results.grok.status = 'not configured';
    }

    // Calculate summary
    const working = Object.values(results).filter((r: any) => r.status === 'working').length;
    const configured = Object.values(results).filter((r: any) => r.configured).length;
    const errors = Object.values(results).filter((r: any) => r.status === 'error').length;

    res.json({
      success: true,
      message: `Tested ${configured} configured providers: ${working} working, ${errors} errors`,
      summary: {
        total: Object.keys(results).length,
        configured,
        working,
        errors,
        notConfigured: Object.keys(results).length - configured
      },
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    logger.error('LLM providers test failed:', error);

    res.status(500).json({
      success: false,
      message: 'LLM providers test failed',
      error: {
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
