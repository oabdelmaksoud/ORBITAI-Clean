import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { config } from '../config/env.js';

// Use test database - ENFORCE separate test database
const getTestDatabaseUri = (): string => {
  const testDbUri = process.env.TEST_MONGODB_URI;
  
  if (testDbUri) {
    // Safety check: Ensure test database URI doesn't point to production
    if (testDbUri.includes('/orbitai') && !testDbUri.includes('/orbitai-test') && !testDbUri.includes('test')) {
      throw new Error(
        '❌ SAFETY CHECK FAILED: TEST_MONGODB_URI appears to point to production database!\n' +
        '   TEST_MONGODB_URI must use a test database (e.g., orbitai-test)\n' +
        '   Current TEST_MONGODB_URI: ' + testDbUri
      );
    }
    return testDbUri;
  }
  
  // Fallback: Create safe test database URI from production URI
  const prodUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
  const defaultTestUri = prodUri.replace(/\/orbitai([^\/]*)$/, '/orbitai-test$1');
  
  // Safety check: Never use production database name in tests
  if (defaultTestUri.includes('/orbitai') && !defaultTestUri.includes('/orbitai-test')) {
    throw new Error(
      '❌ SAFETY CHECK FAILED: Tests cannot use production database!\n' +
      '   Set TEST_MONGODB_URI in .env to a separate test database (e.g., orbitai-test)\n' +
      '   Current URI would use: ' + defaultTestUri
    );
  }
  
  // Warn if using default (should set TEST_MONGODB_URI explicitly)
  if (!process.env.CI) {
    console.warn('⚠️  WARNING: TEST_MONGODB_URI not set. Using default test database.');
    console.warn('   Set TEST_MONGODB_URI in .env to use a dedicated test database.');
    console.warn('   Using: ' + defaultTestUri);
  }
  
  return defaultTestUri;
};

const TEST_MONGODB_URI = getTestDatabaseUri();

beforeAll(async () => {
  // Connect to test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGODB_URI);
    
    // Verify we're connected to a test database
    const dbName = mongoose.connection.db?.databaseName;
    if (dbName && !dbName.includes('test') && !process.env.CI) {
      console.warn(`⚠️  WARNING: Connected to database "${dbName}" which doesn't appear to be a test database.`);
      console.warn('   Tests should use a separate test database to avoid affecting production data.');
    }
  }
});

afterAll(async () => {
  // Clean up: drop test database and close connection
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.db?.dropDatabase();
    } catch (error: any) {
      // If drop fails (e.g., auth required), just clear collections
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        try {
          await collections[key].deleteMany({});
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    await mongoose.connection.close();
  }
});

beforeEach(async () => {
  // Clear all collections before each test
  // This ensures test isolation and prevents duplicate key errors
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    try {
      await collections[key].deleteMany({});
    } catch (error: any) {
      // Ignore errors during cleanup (e.g., if collection doesn't exist)
      console.debug(`Failed to clear collection ${key}:`, error.message);
    }
  }
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.MONGODB_URI = TEST_MONGODB_URI;

