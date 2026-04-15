import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai',
  mongoUsername: (() => {
    const v = process.env.MONGO_USERNAME;
    if (!v) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRITICAL: MONGO_USERNAME must be set in production.');
        process.exit(1);
      }
      console.warn(
        '⚠️  WARNING: MONGO_USERNAME is not set. Using unauthenticated MongoDB connection.'
      );
      return '';
    }
    return v;
  })(),
  mongoPassword: (() => {
    const v = process.env.MONGO_PASSWORD;
    if (!v) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRITICAL: MONGO_PASSWORD must be set in production.');
        process.exit(1);
      }
      console.warn(
        '⚠️  WARNING: MONGO_PASSWORD is not set. Using unauthenticated MongoDB connection.'
      );
      return '';
    }
    return v;
  })(),

  // JWT
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRITICAL: JWT_SECRET must be set in production environment.');
        process.exit(1);
      }
      // In development, warn but allow empty (will fail at runtime if used)
      console.warn('⚠️  WARNING: JWT_SECRET is not set. Authentication will not work properly.');
      return '';
    }
    // Reject default/placeholder secrets in production
    if (process.env.NODE_ENV === 'production' && secret.includes('change-this-in-production')) {
      console.error(
        '❌ CRITICAL: JWT_SECRET must not use default/placeholder value in production.'
      );
      process.exit(1);
    }
    return secret;
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // API Keys (DEPRECATED - DO NOT USE)
  // ⚠️ SECURITY WARNING: These environment variables are DEPRECATED and should NOT be used.
  // API keys stored in environment variables are a security risk and can expose your system to breaches.
  //
  // ✅ CORRECT APPROACH: Store all API keys in the database via Admin Console → Settings → API Keys
  // Database keys are encrypted and secure. Environment variables are plain text and can be exposed.
  //
  // These are kept only for backward compatibility with legacy services that haven't been migrated yet.
  // All new code MUST use apiKeyProvider.service.ts which only reads from the database.
  //
  // Migration status:
  // ✅ Migrated: gemini.service.ts, e2b.service.ts, all LLM providers, embedding.service.ts
  // ⚠️ Pending: sdlcMatching.service.ts, standardsResearch.service.ts, langgraph.service.ts,
  //              autogen.service.ts, crewai.service.ts, langchain.service.ts, llamaindex.service.ts
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  e2bApiKey: process.env.E2B_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  grokApiKey: process.env.GROK_API_KEY || '',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  qwenApiKey: process.env.QWEN_API_KEY || '',
  huggingFaceApiKey: process.env.HUGGING_FACE_API_KEY || '', // Alternative for Qwen via Hugging Face
  qwenApiBaseUrl: process.env.QWEN_API_BASE_URL || '', // Optional: Alibaba Cloud API URL

  // OpenRouter (unified API for 300+ models)
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',

  // Groq (ultra-fast inference)
  groqApiKey: process.env.GROQ_API_KEY || '',

  // Vertex AI (Google Cloud)
  vertexApiKey: process.env.VERTEX_API_KEY || '',
  vertexProjectId: process.env.VERTEX_PROJECT_ID || '',
  vertexLocation: process.env.VERTEX_LOCATION || 'us-central1',

  // Azure OpenAI
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY || '',
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
  azureOpenAIDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',

  // Google Custom Search API (for non-Gemini providers)
  googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
  googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || '',

  // LLM Configuration
  enableMultiLLM: process.env.ENABLE_MULTI_LLM === 'true' || false,
  defaultLLMProvider: process.env.DEFAULT_LLM_PROVIDER || 'gemini',
  llmRoutingStrategy: process.env.LLM_ROUTING_STRATEGY || 'intelligent',

  // Weaviate Vector Database (optional)
  weaviateUrl: process.env.WEAVIATE_URL || '',
  weaviateApiKey: process.env.WEAVIATE_API_KEY || '',
  weaviateClassName: process.env.WEAVIATE_CLASS_NAME || 'OrbitAIArtifact',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Third-Party Integrations
  // Slack
  slackClientId: process.env.SLACK_CLIENT_ID || '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
  slackRedirectUri:
    process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/integrations/slack/callback',

  // Google Drive
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:3001/api/integrations/google-drive/callback',

  // GitHub
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  githubRedirectUri:
    process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/integrations/github/callback',

  // Share Links
  shareLinkSecret: (() => {
    const secret = process.env.SHARE_LINK_SECRET || process.env.JWT_SECRET;
    if (
      (!secret || secret.includes('change-this-in-production')) &&
      process.env.NODE_ENV === 'production'
    ) {
      console.error('❌ CRITICAL: SHARE_LINK_SECRET (or JWT_SECRET) must be set in production.');
      process.exit(1);
    }
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        console.error(
          '❌ CRITICAL: SHARE_LINK_SECRET or JWT_SECRET must be set in production.'
        );
        process.exit(1);
      }
      console.warn(
        '⚠️  WARNING: SHARE_LINK_SECRET and JWT_SECRET are not set. Using dev-only fallback — do NOT use in production.'
      );
      return 'dev-secret-do-not-use-in-production';
    }
    return secret;
  })(),

  // Pipecat Voice Service Configuration
  pipecatHost: process.env.PIPECAT_HOST || 'localhost',
  pipecatPort: parseInt(process.env.PIPECAT_PORT || '8000', 10),
  pipecatEnabled: process.env.PIPECAT_ENABLED !== 'false',

  // CORS Configuration
  corsOrigins: (() => {
    const origins = process.env.CORS_ORIGINS;
    if (origins) {
      // Support comma-separated list of origins
      return origins.split(',').map(origin => origin.trim());
    }
    // Default: use frontend URL, allow localhost for development
    const nodeEnv = process.env.NODE_ENV || 'development';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    if (nodeEnv === 'development') {
      return [
        frontendUrl,
        'http://localhost:5176', // Current Vite port
        'http://localhost:5175', // Previous Vite port
        'http://localhost:5174',
        'http://localhost:5180', // Current dev port
        'http://localhost:3000',
        'http://127.0.0.1:5176', // Current Vite port
        'http://127.0.0.1:5175', // Previous Vite port
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5180', // Current dev port
        'http://127.0.0.1:3000',
      ];
    }
    // Production: only allow configured frontend URL
    return [frontendUrl];
  })(),
  corsCredentials: process.env.CORS_CREDENTIALS !== 'false', // Default to true
};

// Validate required environment variables
// NOTE: API keys are NOT required here - they should be stored in the database via Admin Console
// Environment variables are only used as fallback for backward compatibility
const requiredVars: { key: string; value: string; name: string }[] = [
  { key: 'JWT_SECRET', value: config.jwtSecret, name: 'JWT Secret' },
  { key: 'MONGODB_URI', value: config.mongodbUri, name: 'MongoDB URI' },
];

const missingVars: string[] = [];
const warnings: string[] = [];

// Check API_KEY_ENCRYPTION_KEY (critical for production)
const apiKeyEncryptionKey = process.env.API_KEY_ENCRYPTION_KEY;
if (!apiKeyEncryptionKey || apiKeyEncryptionKey.trim() === '') {
  if (config.nodeEnv === 'production') {
    console.error('❌ CRITICAL: API_KEY_ENCRYPTION_KEY must be set in production!');
    console.error('   Without this key, all encrypted API keys will be lost on server restart.');
    console.error('   Set API_KEY_ENCRYPTION_KEY in your .env file before starting the server.');
    missingVars.push('API Key Encryption Key');
  } else {
    warnings.push('⚠️  WARNING: API_KEY_ENCRYPTION_KEY is not set. Using development key.');
    warnings.push('   ⚠️  ALL ENCRYPTED API KEYS WILL BE LOST ON SERVER RESTART!');
    warnings.push('   Set API_KEY_ENCRYPTION_KEY in your .env file for persistent encryption.');
  }
} else {
  // Validate key strength in production
  if (config.nodeEnv === 'production' && apiKeyEncryptionKey.length < 32) {
    warnings.push(
      '⚠️  WARNING: API_KEY_ENCRYPTION_KEY is too short. Use at least 32 characters for security.'
    );
  } else if (
    apiKeyEncryptionKey.includes('dev') ||
    apiKeyEncryptionKey.includes('development') ||
    apiKeyEncryptionKey.includes('test')
  ) {
    if (config.nodeEnv === 'production') {
      console.error(
        '❌ CRITICAL: API_KEY_ENCRYPTION_KEY appears to be a development key in production!'
      );
      missingVars.push('API Key Encryption Key (production-safe)');
    }
  } else {
    console.log('✅ API_KEY_ENCRYPTION_KEY is configured');
  }
}

// Check required vars
for (const { key, value, name } of requiredVars) {
  if (
    !value ||
    value === '' ||
    (key === 'JWT_SECRET' && value.includes('change-this-in-production'))
  ) {
    if (config.nodeEnv === 'production') {
      missingVars.push(name);
    } else {
      warnings.push(`⚠️  WARNING: ${key} is not set or using default value`);
    }
  } else {
    console.log(`✅ ${key} is configured`);
  }
}

// API Keys: Inform about database storage (not required in env vars)
// API keys should be managed through Admin Console → Settings → API Keys
const apiKeyProviders = [
  { key: 'GEMINI_API_KEY', value: config.geminiApiKey, name: 'Gemini' },
  { key: 'OPENAI_API_KEY', value: config.openaiApiKey, name: 'OpenAI' },
  { key: 'ANTHROPIC_API_KEY', value: config.anthropicApiKey, name: 'Anthropic' },
  { key: 'E2B_API_KEY', value: config.e2bApiKey, name: 'E2B' },
  { key: 'DEEPSEEK_API_KEY', value: config.deepseekApiKey, name: 'DeepSeek' },
  { key: 'GROK_API_KEY', value: config.grokApiKey, name: 'Grok' },
];

const envApiKeysFound = apiKeyProviders.filter(p => p.value && p.value.trim()).length;
if (envApiKeysFound > 0) {
  console.log(
    `ℹ️  Found ${envApiKeysFound} API key(s) in environment variables (using as fallback)`
  );
  console.log(
    `   💡 Tip: Store API keys in database via Admin Console → Settings → API Keys for better security`
  );
} else {
  console.log(
    `ℹ️  No API keys in environment variables (this is OK - use Admin Console to store them)`
  );
}

// Fail in production if required vars are missing
if (missingVars.length > 0 && config.nodeEnv === 'production') {
  console.error('\n❌ CRITICAL: Missing required environment variables in production:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error('\nPlease set all required environment variables before starting the server.\n');
  process.exit(1);
}

// Show warnings in development
if (warnings.length > 0) {
  warnings.forEach(w => console.warn(w));
}

export default config;
