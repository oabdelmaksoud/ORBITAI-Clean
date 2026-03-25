import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to .env file
const ENV_FILE_PATH = path.join(__dirname, '../../.env');

// List of environment variables that can be safely edited via UI
// Excludes sensitive/critical vars that require restart or are security-critical
// NOTE: API keys are now managed via the database (API Keys Management section)
// They are NOT editable here - use Settings → API Keys instead
const EDITABLE_VARS = [
  // Server Configuration
  'FRONTEND_URL',
  'LOG_LEVEL',
  'CORS_ORIGINS',
  'CORS_CREDENTIALS',
  'NODE_ENV', // Environment switching (requires restart)
  // LLM Configuration
  'ENABLE_MULTI_LLM',
  'DEFAULT_LLM_PROVIDER',
  'LLM_ROUTING_STRATEGY',
  // Database & Vector Store
  'WEAVIATE_URL',
  'WEAVIATE_CLASS_NAME',
  // Azure Configuration (non-key fields)
  'VERTEX_PROJECT_ID',
  'VERTEX_LOCATION',
  'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_DEPLOYMENT_NAME',
      'AZURE_OPENAI_API_VERSION',
      // Note: GOOGLE_SEARCH_ENGINE_ID is now stored in database with API key (metadata.additionalConfig.engineId)
];

// API Keys - These are now managed via database (Settings → API Keys)
// They are NOT editable via environment variables UI
const API_KEY_VARS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GROK_API_KEY',
  'MISTRAL_API_KEY',
  'QWEN_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'VERTEX_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'E2B_API_KEY',
  'GOOGLE_SEARCH_API_KEY',
  'WEAVIATE_API_KEY',
];

// Variables that require server restart to take effect
const REQUIRES_RESTART_VARS = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
];

// Variables that should be masked when reading (show only last 4 chars)
const MASKED_VARS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GROK_API_KEY',
  'MISTRAL_API_KEY',
  'QWEN_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'VERTEX_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'E2B_API_KEY',
  'GOOGLE_SEARCH_API_KEY',
  'WEAVIATE_API_KEY',
  'JWT_SECRET',
];

/**
 * Read .env file and parse into key-value pairs
 */
async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_FILE_PATH, 'utf-8');
    const env: Record<string, string> = {};
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Parse KEY=VALUE format
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        env[key] = value;
      }
    }
    
    return env;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty object
      logger.warn('.env file not found, returning empty config');
      return {};
    }
    throw error;
  }
}

/**
 * Write environment variables to .env file
 */
async function writeEnvFile(env: Record<string, string>): Promise<void> {
  // Read existing file to preserve comments and formatting
  let existingContent = '';
  try {
    existingContent = await fs.readFile(ENV_FILE_PATH, 'utf-8');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  
  // Parse existing content to preserve comments and structure
  const lines = existingContent.split('\n');
  const newLines: string[] = [];
  const updatedKeys = new Set(Object.keys(env));
  
  // Process existing lines
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Preserve comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line);
      continue;
    }
    
    // Check if this line is a key-value pair
    const match = trimmed.match(/^([^=]+)=/);
    if (match) {
      const key = match[1].trim();
      // If this key is being updated, skip it (we'll add it later)
      if (updatedKeys.has(key)) {
        continue;
      }
      // Otherwise, keep the original line
      newLines.push(line);
    } else {
      // Keep non-key-value lines as-is
      newLines.push(line);
    }
  }
  
  // Add updated/new variables
  for (const [key, value] of Object.entries(env)) {
    // Escape value if it contains spaces or special characters
    const escapedValue = value.includes(' ') || value.includes('#') || value.includes('=')
      ? `"${value.replace(/"/g, '\\"')}"`
      : value;
    
    newLines.push(`${key}=${escapedValue}`);
  }
  
  // Write back to file
  await fs.writeFile(ENV_FILE_PATH, newLines.join('\n'), 'utf-8');
}

/**
 * Get environment variables (masked for sensitive values)
 */
export async function getEnvironmentVariables(): Promise<Record<string, { value: string; editable: boolean; masked: boolean }>> {
  const env = await readEnvFile();
  const result: Record<string, { value: string; editable: boolean; masked: boolean }> = {};
  
  // Get all environment variables from process.env and .env file
  const allVars = new Set([
    ...Object.keys(env),
    ...Object.keys(process.env)
  ]);
  
  for (const key of allVars) {
    // Skip internal Node.js variables
    if (key.startsWith('npm_') || key.startsWith('NODE_') && key !== 'NODE_ENV') {
      continue;
    }
    
    const value = env[key] || process.env[key] || '';
    const editable = EDITABLE_VARS.includes(key);
    const masked = MASKED_VARS.includes(key) && value.length > 4;
    
    result[key] = {
      value: masked ? `***${value.slice(-4)}` : value,
      editable,
      masked
    };
  }
  
  return result;
}

/**
 * Update environment variables
 */
export async function updateEnvironmentVariables(
  updates: Record<string, string>
): Promise<void> {
  // Validate that all keys are editable
  for (const key of Object.keys(updates)) {
    if (!EDITABLE_VARS.includes(key)) {
      throw new Error(`Variable ${key} is not editable via UI`);
    }
  }
  
  // Read current env file
  const env = await readEnvFile();
  
  // Apply updates
  for (const [key, value] of Object.entries(updates)) {
    // If value is masked (starts with ***), don't update it
    if (value.startsWith('***')) {
      logger.info(`Skipping update for ${key} (masked value)`);
      continue;
    }
    
    env[key] = value;
    // Also update process.env for immediate effect (for some vars)
    process.env[key] = value;
  }
  
  // Write back to file
  await writeEnvFile(env);
  
  logger.info(`Updated environment variables: ${Object.keys(updates).join(', ')}`);
}

/**
 * Get list of editable environment variables
 */
export function getEditableVariables(): string[] {
  return [...EDITABLE_VARS];
}


