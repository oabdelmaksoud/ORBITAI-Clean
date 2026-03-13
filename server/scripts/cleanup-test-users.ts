/**
 * Script to clean up test users from the database
 * Usage: npm run cleanup-test-users
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

async function cleanupTestUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
    
    if (!mongoUri || mongoUri === 'undefined') {
      console.error('❌ Error: MONGODB_URI is not set in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find test users
    const testUsers = await User.find({
      $or: [
        { email: /test.*@example\.com/i },
        { email: /^test-/i },
        { email: /@example\.com/i }, // All example.com emails
        { name: /^Test/i },
        { name: /Test User/i },
        { name: /Integration User/i },
        { name: /Workflow User/i },
        { name: /New User/i },
        { name: /Login User/i },
        { name: /Me User/i }
      ]
    }).select('-password');

    if (testUsers.length === 0) {
      console.log('✅ No test users found to clean up');
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  Found ${testUsers.length} test users to delete:\n`);
    testUsers.forEach(u => {
      console.log(`   - ${u.email} (${u.name}) - Created: ${u.createdAt}`);
    });

    console.log('\n⚠️  WARNING: This will permanently delete these users!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete test users
    const result = await User.deleteMany({
      $or: [
        { email: /test.*@example\.com/i },
        { email: /^test-/i },
        { email: /@example\.com/i }, // All example.com emails
        { name: /^Test/i },
        { name: /Test User/i },
        { name: /Integration User/i },
        { name: /Workflow User/i },
        { name: /New User/i },
        { name: /Login User/i },
        { name: /Me User/i }
      ]
    });

    console.log(`✅ Deleted ${result.deletedCount} test users`);
    
    // Also delete any projects owned by these users (if they exist)
    const { Project } = await import('../src/models/Project.model.js');
    const testUserIds = testUsers.map(u => u._id);
    const projectsResult = await Project.deleteMany({
      userId: { $in: testUserIds }
    });
    
    if (projectsResult.deletedCount > 0) {
      console.log(`✅ Deleted ${projectsResult.deletedCount} test projects`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete');
  } catch (error: any) {
    console.error('❌ Error cleaning up test users:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

cleanupTestUsers();




