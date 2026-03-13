/**
 * Environment Validation Script
 * Validates that all required environment variables are set
 */

import { config } from '../src/config/env.js';

const errors: string[] = [];
const warnings: string[] = [];

// Check API_KEY_ENCRYPTION_KEY
const apiKeyEncryptionKey = process.env.API_KEY_ENCRYPTION_KEY;
if (!apiKeyEncryptionKey || apiKeyEncryptionKey.trim() === '') {
  if (config.nodeEnv === 'production') {
    errors.push('API_KEY_ENCRYPTION_KEY must be set in production!');
  } else {
    warnings.push('API_KEY_ENCRYPTION_KEY is not set. Using development key.');
    warnings.push('  ⚠️  ALL ENCRYPTED API KEYS WILL BE LOST ON SERVER RESTART!');
  }
} else {
  if (config.nodeEnv === 'production' && apiKeyEncryptionKey.length < 32) {
    warnings.push('API_KEY_ENCRYPTION_KEY is too short. Use at least 32 characters for security.');
  }
  if (apiKeyEncryptionKey.includes('dev') || apiKeyEncryptionKey.includes('development') || apiKeyEncryptionKey.includes('test')) {
    if (config.nodeEnv === 'production') {
      errors.push('API_KEY_ENCRYPTION_KEY appears to be a development key in production!');
    }
  }
}

// Check MongoDB URI
if (!config.mongodbUri || config.mongodbUri === 'mongodb://localhost:27017/orbitai') {
  if (config.nodeEnv === 'production') {
    warnings.push('MONGODB_URI is using default value. This may not be suitable for production.');
  }
}

// Check JWT Secret
if (!config.jwtSecret || config.jwtSecret.includes('change-this-in-production')) {
  if (config.nodeEnv === 'production') {
    errors.push('JWT_SECRET must be set and not use default value in production!');
  } else {
    warnings.push('JWT_SECRET is not set or using default value.');
  }
}

// Print results
if (errors.length > 0) {
  console.error('\n❌ Environment Validation Failed:\n');
  errors.forEach(error => console.error(`  - ${error}`));
  console.error('\n');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\n⚠️  Environment Warnings:\n');
  warnings.forEach(warning => console.warn(`  ${warning}`));
  console.warn('\n');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All environment variables are properly configured.\n');
}







