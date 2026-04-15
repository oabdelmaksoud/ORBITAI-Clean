/**
 * Global test setup for mongodb-memory-server
 * Starts an in-memory MongoDB instance before all tests
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export async function setup(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  // Store the URI so tests can access it
  process.env.TEST_MONGODB_URI = uri;
  process.env.MONGODB_URI = uri;
}

export async function teardown(): Promise<void> {
  if (mongoServer) {
    await mongoServer.stop();
  }
}
