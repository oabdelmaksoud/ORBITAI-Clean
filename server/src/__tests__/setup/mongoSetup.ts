/**
 * Per-file test setup for MongoDB connection
 * Connects/disconnects mongoose for each test file
 */

import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('TEST_MONGODB_URI is not set. Global setup may not have run.');
  }
  // Only connect if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterEach(async () => {
  // Clean all collections after each test to ensure isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});
