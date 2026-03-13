/**
 * Test Helpers
 * Shared utilities for testing
 */

import { User } from '../../models/User.model.js';
import { Project } from '../../models/Project.model.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

/**
 * Generate a test JWT token
 * Token format must match what authenticateToken middleware expects: { userId, email, plan }
 */
export function generateTestToken(userId: string, email: string = 'test@example.com', plan: string = 'Free'): string {
  // Ensure JWT_SECRET is set for tests
  const secret = process.env.JWT_SECRET || config.jwtSecret || 'test-jwt-secret-key-for-testing-only';
  
  return jwt.sign(
    { userId, email, plan }, // Use userId (not id) to match middleware expectation
    secret,
    { expiresIn: '1h' }
  );
}

/**
 * Create a test user
 */
export async function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  name: string;
  plan: string;
  role: string;
}> = {}): Promise<{ user: any; token: string }> {
  const userData = {
    email: overrides.email || `test-${Date.now()}@example.com`,
    password: overrides.password || 'Test@1234',
    name: overrides.name || 'Test User',
    plan: overrides.plan || 'Free',
    role: overrides.role || 'user',
    ...overrides
  };

  const user = await User.create(userData);
  const token = generateTestToken(user._id.toString(), user.email, user.plan);

  return { user, token };
}

/**
 * Create a test project
 */
export async function createTestProject(
  userId: string,
  overrides: Partial<{
    name: string;
    description: string;
    methodology: string;
    currentPhase: string;
  }> = {}
): Promise<any> {
  const projectData = {
    userId: new mongoose.Types.ObjectId(userId),
    name: overrides.name || `Test Project ${Date.now()}`,
    description: overrides.description || 'Test project description',
    methodology: overrides.methodology || 'V-Model',
    currentPhase: overrides.currentPhase || 'Initiation',
    lastModified: new Date(),
    ...overrides
  };

  return await Project.create(projectData);
}

/**
 * Clean up test data
 * More thorough cleanup to prevent duplicate key errors
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // Delete all test users (by email pattern or test prefix)
    await User.deleteMany({ 
      $or: [
        { email: /test.*@example\.com/i },
        { email: /^test-/i },
        { name: /^Test/i }
      ]
    });
    
    // Delete all test projects
    await Project.deleteMany({ 
      $or: [
        { name: /Test Project/i },
        { name: /^Test/i },
        { description: /test/i }
      ]
    });
    
    // Clear any other test-related collections if needed
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      if (key !== 'users' && key !== 'projects') {
        try {
          // Only delete documents that look like test data
          await collections[key].deleteMany({ 
            $or: [
              { name: /^Test/i },
              { email: /test.*@example\.com/i }
            ]
          });
        } catch (error: any) {
          // Ignore errors for collections without these fields
        }
      }
    }
  } catch (error: any) {
    console.error('Error during test cleanup:', error.message);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Set up test environment
 * ENFORCES use of test database to prevent accidental production database usage
 */
export async function setupTestEnv(): Promise<void> {
  // ENFORCE: Use test database - prevent accidental production database usage
  const testDbUri = process.env.TEST_MONGODB_URI;
  
  if (!testDbUri) {
    // In CI/CD or when TEST_MONGODB_URI is not set, use a safe default
    const defaultTestUri = process.env.MONGODB_URI 
      ? process.env.MONGODB_URI.replace(/\/orbitai([^\/]*)$/, '/orbitai-test$1')
      : 'mongodb://localhost:27017/orbitai-test';
    
    // Warn if using default (should set TEST_MONGODB_URI explicitly)
    if (!process.env.CI && !process.env.TEST_MONGODB_URI) {
      console.warn('⚠️  WARNING: TEST_MONGODB_URI not set. Using default test database.');
      console.warn('   Set TEST_MONGODB_URI in .env to use a dedicated test database.');
    }
    
    // Safety check: Never use production database name in tests
    if (defaultTestUri.includes('/orbitai') && !defaultTestUri.includes('/orbitai-test')) {
      throw new Error(
        '❌ SAFETY CHECK FAILED: Tests cannot use production database!\n' +
        '   Set TEST_MONGODB_URI to a separate test database (e.g., orbitai-test)\n' +
        '   Current URI would use: ' + defaultTestUri
      );
    }
    
    await mongoose.connect(defaultTestUri);
  } else {
    // Safety check: Ensure test database URI doesn't point to production
    if (testDbUri.includes('/orbitai') && !testDbUri.includes('/orbitai-test') && !testDbUri.includes('test')) {
      throw new Error(
        '❌ SAFETY CHECK FAILED: TEST_MONGODB_URI appears to point to production database!\n' +
        '   TEST_MONGODB_URI must use a test database (e.g., orbitai-test)\n' +
        '   Current TEST_MONGODB_URI: ' + testDbUri
      );
    }
    
    await mongoose.connect(testDbUri);
  }
  
  // Verify we're connected to a test database
  const dbName = mongoose.connection.db?.databaseName;
  if (dbName && !dbName.includes('test') && !process.env.CI) {
    console.warn(`⚠️  WARNING: Connected to database "${dbName}" which doesn't appear to be a test database.`);
    console.warn('   Tests should use a separate test database to avoid affecting production data.');
  }
}

/**
 * Tear down test environment
 */
export async function teardownTestEnv(): Promise<void> {
  await cleanupTestData();
  // Optionally close connection (usually handled by test framework)
}

/**
 * Create authenticated request headers
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}


