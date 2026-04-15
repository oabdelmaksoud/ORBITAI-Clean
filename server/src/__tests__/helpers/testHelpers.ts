/**
 * Test Helpers
 * Shared utilities for testing
 */

import { User } from '../../models/User.model.js';
import { Project } from '../../models/Project.model.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

/**
 * Get the JWT secret for tests.
 * Avoids importing config/env.ts which triggers side effects (dotenv, console warnings).
 */
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
}

/**
 * Generate a test JWT token
 * Token format must match what authenticateToken middleware expects: { userId, email, plan }
 */
export function generateTestToken(
  userId: string,
  email: string = 'test@example.com',
  plan: string = 'Free',
  role?: string
): string {
  const secret = getJwtSecret();

  return jwt.sign(
    { userId, email, plan, role },
    secret,
    { expiresIn: '1h' }
  );
}

/**
 * Create a test user
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    plan: string;
    role: string;
  }> = {}
): Promise<{
  user: any;
  token: string;
  _id: any;
  email: string;
  password: string;
  name: string;
  plan: string;
  role: string;
}> {
  const userData = {
    email: overrides.email || `test-${Date.now()}@example.com`,
    password: overrides.password || 'Test@1234',
    name: overrides.name || 'Test User',
    plan: overrides.plan || 'Free',
    role: overrides.role || 'user',
    ...overrides,
  };

  const user = await User.create(userData);
  const token = generateTestToken(user._id.toString(), user.email, user.plan, userData.role);

  return {
    user,
    token,
    _id: user._id,
    email: userData.email,
    password: userData.password,
    name: userData.name,
    plan: userData.plan,
    role: userData.role,
  };
}

/**
 * Create a test admin user
 */
export async function createTestAdmin(
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    plan: string;
  }> = {}
) {
  return createTestUser({ role: 'admin', ...overrides });
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
    ...overrides,
  };

  return await Project.create(projectData);
}

/**
 * Clean up test data - drops all documents from all collections
 */
export async function cleanupTestData(): Promise<void> {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error: any) {
    console.error('Error during test cleanup:', error.message);
  }
}

/**
 * Set up test environment - connects to in-memory MongoDB
 */
export async function setupTestEnv(): Promise<void> {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'TEST_MONGODB_URI is not set. Ensure globalSetup is configured in vitest.config.ts.'
    );
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

/**
 * Tear down test environment
 */
export async function teardownTestEnv(): Promise<void> {
  await cleanupTestData();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

/**
 * Create authenticated request headers
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
