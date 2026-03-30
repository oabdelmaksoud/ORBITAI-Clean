/**
 * API Key Management Routes
 * Secure endpoints for managing API keys
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { apiKeyManagement } from '../services/apiKeyManagement.service.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logger } from '../utils/logger.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/api-keys
 * Get all API keys (masked)
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const keys = await apiKeyManagement.getAllApiKeys(req.admin?.id);
    
    res.json({
      success: true,
      data: {
        keys,
        count: keys.length
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/api-keys/:id
 * Get specific API key (masked)
 */
router.get('/:id', async (req: AdminRequest, res, next) => {
  try {
    const key = await apiKeyManagement.getApiKeyById(req.params.id);
    
    if (!key) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      data: { key }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/api-keys
 * Create a new API key
 */
router.post('/', strictRateLimiter, async (req: AdminRequest, res, next) => {
  try {
    const { provider, keyName, value, metadata } = req.body;

    if (!provider || !value) {
      return res.status(400).json({
        success: false,
        message: 'Provider and value are required'
      });
    }

    // Auto-generate keyName from provider if not provided
    const providerLabels: Record<string, string> = {
      'gemini': 'Google Gemini',
      'openai': 'OpenAI',
      'anthropic': 'Anthropic (Claude)',
      'deepseek': 'DeepSeek',
      'grok': 'Grok (xAI)',
      'mistral': 'Mistral AI',
      'qwen': 'Qwen (Alibaba)',
      'huggingface': 'Hugging Face',
      'e2b': 'E2B Sandbox',
      'google_search': 'Google Search',
      'openrouter': 'OpenRouter',
      'groq': 'Groq',
      'vertex': 'Vertex AI (Google Cloud)',
      'azure': 'Azure OpenAI',
      'custom': 'Custom'
    };
    
    const finalKeyName = keyName || providerLabels[provider] || provider;

    const key = await apiKeyManagement.createApiKey(
      { provider, keyName: finalKeyName, value, metadata },
      req.admin!.id
    );

    await logAudit(req, {
      action: 'api_key.created',
      entityType: 'API Key',
      entityId: key.id,
      details: {
        provider,
        keyName
      }
    });

    logger.info(`Admin ${req.admin?.email} created API key for ${provider} with ID: ${key.id}, isActive: ${key.isActive}`);

    // Clear API key provider cache so the new key is immediately available
    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');
    apiKeyProvider.clearCache(provider as any);

    res.status(201).json({
      success: true,
      data: { key },
      message: 'API key created successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/admin/api-keys/:id
 * Update API key
 */
router.put('/:id', strictRateLimiter, async (req: AdminRequest, res, next) => {
  try {
    const { keyName, value, metadata } = req.body;

    // Get the key to determine provider for auto-naming
    const existingKey = await apiKeyManagement.getApiKeyById(req.params.id);
    if (!existingKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    const updates: any = {};
    // Auto-generate keyName from provider if not provided
    if (keyName) {
      updates.keyName = keyName;
    } else if (!keyName && existingKey.provider) {
      const providerLabels: Record<string, string> = {
        'gemini': 'Google Gemini',
        'openai': 'OpenAI',
        'anthropic': 'Anthropic (Claude)',
        'deepseek': 'DeepSeek',
        'grok': 'Grok (xAI)',
        'mistral': 'Mistral AI',
        'qwen': 'Qwen (Alibaba)',
        'huggingface': 'Hugging Face',
        'e2b': 'E2B Sandbox',
        'google_search': 'Google Search',
        'openrouter': 'OpenRouter',
        'groq': 'Groq',
        'vertex': 'Vertex AI (Google Cloud)',
        'azure': 'Azure OpenAI',
        'custom': 'Custom'
      };
      updates.keyName = providerLabels[existingKey.provider] || existingKey.provider;
    }
    if (value) updates.value = value;
    if (metadata) updates.metadata = metadata;

    const key = await apiKeyManagement.updateApiKey(
      req.params.id,
      updates,
      req.admin!.id
    );

    await logAudit(req, {
      action: 'api_key.updated',
      entityType: 'API Key',
      entityId: req.params.id,
      details: {
        updatedFields: Object.keys(updates)
      }
    });

    logger.info(`Admin ${req.admin?.email} updated API key ${req.params.id}`);

    // Clear API key provider cache so the updated key is immediately available
    const { apiKeyProvider } = await import('../services/apiKeyProvider.service.js');
    apiKeyProvider.clearCache(key.provider as any);

    res.json({
      success: true,
      data: { key },
      message: 'API key updated successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/admin/api-keys/:id
 * Permanently delete API key (hard delete)
 */
router.delete('/:id', strictRateLimiter, async (req: AdminRequest, res, next) => {
  try {
    await apiKeyManagement.deleteApiKey(req.params.id, req.admin!.id);

    await logAudit(req, {
      action: 'api_key.deleted',
      entityType: 'API Key',
      entityId: req.params.id
    });

    logger.info(`Admin ${req.admin?.email} permanently deleted API key ${req.params.id}`);

    res.json({
      success: true,
      message: 'API key deleted permanently'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/api-keys/:id/deactivate
 * Deactivate API key (soft delete - can be reactivated)
 */
router.post('/:id/deactivate', strictRateLimiter, async (req: AdminRequest, res, next) => {
  try {
    await apiKeyManagement.deactivateApiKey(req.params.id, req.admin!.id);

    await logAudit(req, {
      action: 'api_key.deactivated',
      entityType: 'API Key',
      entityId: req.params.id
    });

    logger.info(`Admin ${req.admin?.email} deactivated API key ${req.params.id}`);

    res.json({
      success: true,
      message: 'API key deactivated successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/api-keys/:id/activate
 * Reactivate a deactivated API key
 */
router.post('/:id/activate', strictRateLimiter, async (req: AdminRequest, res, next) => {
  try {
    const { ApiKey } = await import('../models/ApiKey.model.js');
    const key = await ApiKey.findById(req.params.id);
    
    if (!key) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    key.isActive = true;
    key.updatedBy = req.admin!.id as any;
    await key.save();

    await logAudit(req, {
      action: 'api_key.activated',
      entityType: 'API Key',
      entityId: req.params.id
    });

    logger.info(`Admin ${req.admin?.email} activated API key ${req.params.id}`);

    res.json({
      success: true,
      message: 'API key activated successfully'
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/api-keys/:id/test
 * Test API key (without exposing the value)
 */
router.post('/:id/test', strictRateLimiter, async (req: AdminRequest, res, next) => {
  try {
    const keyId = req.params.id;
    
    // Validate ObjectId format
    const mongoose = await import('mongoose');
    if (!mongoose.default.Types.ObjectId.isValid(keyId)) {
      logger.warn(`API key test failed: Invalid ObjectId format: ${keyId}`);
      return res.status(400).json({
        success: false,
        message: `Invalid API key ID format: ${keyId}`
      });
    }
    
    // First, check if the key exists and get its status
    const { ApiKey } = await import('../models/ApiKey.model.js');
    const keyDoc = await ApiKey.findById(keyId);
    
    if (!keyDoc) {
      logger.warn(`API key test failed: Key not found with ID: ${keyId} (Admin: ${req.admin?.email})`);
      return res.status(404).json({
        success: false,
        message: `API key not found with ID: ${keyId}. Please verify the key exists and try again.`
      });
    }
    
    if (!keyDoc.isActive) {
      logger.warn(`API key test failed: Key is inactive with ID: ${keyId}`);
      return res.status(400).json({
        success: false,
        message: 'API key is inactive. Please activate it first before testing.',
        keyId: keyId,
        isActive: false
      });
    }

    // Get decrypted key (internal use only)
    const decryptedKey = await apiKeyManagement.getDecryptedKey(keyId);
    
    if (!decryptedKey) {
      logger.error(`API key test failed: Failed to decrypt key with ID: ${keyId}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt API key. The key may be corrupted or encryption key may have changed.',
        keyId: keyId
      });
    }

    // Test the key based on provider
    const key = await apiKeyManagement.getApiKeyById(keyId);
    if (!key) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Perform provider-specific test
    let testResult = { valid: false, message: '' };
    
    try {
      switch (key.provider) {
        case 'openai': {
          const { default: OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: decryptedKey });
          await openai.models.list();
          testResult = { valid: true, message: 'OpenAI API key is valid and working' };
          break;
        }
        
        case 'mistral': {
          const { default: OpenAI } = await import('openai');
          const mistral = new OpenAI({
            apiKey: decryptedKey,
            baseURL: 'https://api.mistral.ai/v1'
          });
          await mistral.models.list();
          testResult = { valid: true, message: 'Mistral API key is valid and working' };
          break;
        }
        
        case 'gemini': {
          // Test Gemini key using the same API pattern as the actual service
          // This ensures compatibility with the service implementation
          try {
            const { GoogleGenAI } = await import('@google/genai');
            const testAI = new GoogleGenAI({ apiKey: decryptedKey });
            
            // Use the same API pattern as gemini.service.ts: ai.models.generateContent()
            const result = await testAI.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: 'test'
            });
            
            // Check if we got a valid response with text
            if (result && result.text) {
              testResult = { valid: true, message: 'Gemini API key is valid and working' };
            } else {
              testResult = { valid: false, message: 'Gemini API key test failed: Invalid response' };
            }
          } catch (error: any) {
            // Parse error message for better user feedback
            let errorMessage = error.message || 'Unknown error';
            if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('API key')) {
              errorMessage = 'Gemini API key is invalid or does not have permission. Please verify the key is correct and active in Google Cloud Console.';
            } else if (errorMessage.includes('401') || errorMessage.includes('UNAUTHENTICATED')) {
              errorMessage = 'Gemini API key authentication failed. Please check that the key is valid.';
            } else if (errorMessage.includes('404') || errorMessage.includes('NOT_FOUND')) {
              errorMessage = 'Gemini API endpoint not found. Please check your API key and ensure the Gemini API is enabled.';
            } else if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
              errorMessage = 'Gemini API quota exceeded. Please check your usage limits in Google Cloud Console.';
            }
            testResult = { valid: false, message: `Gemini API key test failed: ${errorMessage}` };
          }
          break;
        }
        
        case 'anthropic': {
          const Anthropic = await import('@anthropic-ai/sdk');
          const anthropic = new Anthropic.default({ apiKey: decryptedKey });
          // Test with a minimal message
          await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'test' }]
          });
          testResult = { valid: true, message: 'Anthropic API key is valid and working' };
          break;
        }
        
        case 'deepseek': {
          const { default: OpenAI } = await import('openai');
          const deepseek = new OpenAI({
            apiKey: decryptedKey,
            baseURL: 'https://api.deepseek.com/v1'
          });
          await deepseek.models.list();
          testResult = { valid: true, message: 'DeepSeek API key is valid and working' };
          break;
        }
        
        case 'grok': {
          const { default: OpenAI } = await import('openai');
          const grok = new OpenAI({
            apiKey: decryptedKey,
            baseURL: 'https://api.x.ai/v1'
          });
          await grok.models.list();
          testResult = { valid: true, message: 'Grok (xAI) API key is valid and working' };
          break;
        }
        
        case 'qwen':
        case 'huggingface': {
          // Test Hugging Face API key (used for Qwen)
          const testUrl = 'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-0.5B-Instruct';
          const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${decryptedKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: 'test' })
          });
          if (response.ok || response.status === 503) { // 503 means model is loading, but auth worked
            testResult = { valid: true, message: 'Qwen/Hugging Face API key is valid and working' };
          } else if (response.status === 401 || response.status === 403) {
            testResult = { valid: false, message: 'Qwen/Hugging Face API key is invalid or unauthorized' };
          } else {
            // Try alternative: check if key format is valid
            if (decryptedKey.startsWith('hf_') || decryptedKey.length > 20) {
              testResult = { valid: true, message: 'Qwen/Hugging Face API key format appears valid (model may be loading)' };
            } else {
              testResult = { valid: false, message: 'Qwen/Hugging Face API key format is invalid' };
            }
          }
          break;
        }
        
        case 'openrouter': {
          // Test OpenRouter API key
          const testUrl = 'https://openrouter.ai/api/v1/models';
          const response = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${decryptedKey}`,
              'HTTP-Referer': 'https://orbitai.app',
              'X-Title': 'ORBIT AI'
            }
          });
          if (response.ok) {
            testResult = { valid: true, message: 'OpenRouter API key is valid and working' };
          } else {
            const errorData = await response.json().catch(() => ({}));
            testResult = { valid: false, message: `OpenRouter API key test failed: ${errorData.error?.message || response.statusText}` };
          }
          break;
        }
        
        case 'groq': {
          const { default: OpenAI } = await import('openai');
          const groq = new OpenAI({
            apiKey: decryptedKey,
            baseURL: 'https://api.groq.com/openai/v1'
          });
          await groq.models.list();
          testResult = { valid: true, message: 'Groq API key is valid and working' };
          break;
        }
        
        case 'e2b': {
          // Test E2B API key by checking sandbox creation
          const testUrl = 'https://api.e2b.dev/v2/sandbox';
          const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${decryptedKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ template: 'base' })
          });
          if (response.ok) {
            const data = await response.json();
            // Clean up: close the sandbox
            if (data.sandboxID) {
              await fetch(`https://api.e2b.dev/v2/sandbox/${data.sandboxID}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${decryptedKey}` }
              }).catch(() => {}); // Ignore cleanup errors
            }
            testResult = { valid: true, message: 'E2B API key is valid and working' };
          } else {
            const errorData = await response.json().catch(() => ({}));
            testResult = { valid: false, message: `E2B API key test failed: ${errorData.error?.message || response.statusText}` };
          }
          break;
        }
        
        case 'google_search': {
          // Test Google Custom Search API key
          // Note: This requires a search engine ID, but we can at least validate the key format
          const testUrl = `https://www.googleapis.com/customsearch/v1?key=${decryptedKey}&cx=test&q=test&num=1`;
          const response = await fetch(testUrl);
          // 400 with "Invalid cx" means key is valid but search engine ID is missing
          // 401/403 means key is invalid
          if (response.status === 400) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error?.message?.includes('cx') || errorData.error?.message?.includes('Custom Search')) {
              testResult = { valid: true, message: 'Google Search API key format is valid (search engine ID required for full test)' };
            } else {
              testResult = { valid: false, message: `Google Search API key test failed: ${errorData.error?.message}` };
            }
          } else if (response.status === 401 || response.status === 403) {
            testResult = { valid: false, message: 'Google Search API key is invalid or unauthorized' };
          } else {
            testResult = { valid: true, message: 'Google Search API key appears valid' };
          }
          break;
        }
        
        case 'vertex': {
          // Test Vertex AI (uses Gemini API with different endpoint)
          // Vertex requires project ID and region, but we can test the API key format
          const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${decryptedKey}`;
          const response = await fetch(testUrl);
          if (response.ok) {
            testResult = { valid: true, message: 'Vertex AI API key format is valid (project ID and region required for full setup)' };
          } else {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error?.message?.includes('API key')) {
              testResult = { valid: false, message: `Vertex AI API key test failed: ${errorData.error.message}` };
            } else {
              testResult = { valid: true, message: 'Vertex AI API key format appears valid (full setup requires project configuration)' };
            }
          }
          break;
        }
        
        case 'azure': {
          // Azure OpenAI requires both API key and endpoint
          // We can only validate the key format here
          if (decryptedKey && decryptedKey.length > 20) {
            testResult = { valid: true, message: 'Azure OpenAI API key format appears valid (endpoint URL also required for full setup)' };
          } else {
            testResult = { valid: false, message: 'Azure OpenAI API key format is invalid (too short)' };
          }
          break;
        }
        
        case 'custom': {
          // For custom providers, we can only validate format
          if (decryptedKey && decryptedKey.length > 10) {
            testResult = { valid: true, message: 'Custom API key format appears valid (custom provider test not implemented)' };
          } else {
            testResult = { valid: false, message: 'Custom API key format is invalid (too short)' };
          }
          break;
        }
        
        default:
          // For unknown providers, validate basic format
          if (decryptedKey && decryptedKey.length > 10) {
            testResult = { valid: true, message: `Key format appears valid (${key.provider} provider test not implemented)` };
          } else {
            testResult = { valid: false, message: `Key format is invalid for ${key.provider}` };
          }
      }
    } catch (error: any) {
      // Provide more detailed error messages
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        testResult = { valid: false, message: `API key is invalid or unauthorized: ${errorMessage}` };
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        testResult = { valid: false, message: `API key access is forbidden: ${errorMessage}` };
      } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        testResult = { valid: true, message: `API key appears valid but rate limited: ${errorMessage}` };
      } else {
        testResult = { valid: false, message: `Test failed: ${errorMessage}` };
      }
    }

    res.json({
      success: true,
      data: {
        testResult,
        provider: key.provider,
        keyName: key.keyName
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

