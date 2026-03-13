/**
 * Script to analyze users in the database
 * Usage: npm run analyze-users (or: npx tsx server/scripts/analyze-users.ts)
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

async function analyzeUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
    
    if (!mongoUri || mongoUri === 'undefined') {
      console.error('❌ Error: MONGODB_URI is not set in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({}).select('-password').sort({ createdAt: 1 }).lean();
    
    console.log(`📊 Total Users: ${users.length}\n`);
    
    // Group by role
    const byRole: Record<string, any[]> = {};
    users.forEach(u => {
      if (!byRole[u.role || 'user']) byRole[u.role || 'user'] = [];
      byRole[u.role || 'user'].push(u);
    });
    
    console.log('👥 Users by Role:');
    Object.entries(byRole).forEach(([role, roleUsers]) => {
      console.log(`   ${role}: ${roleUsers.length}`);
    });
    console.log('');
    
    // Group by plan
    const byPlan: Record<string, any[]> = {};
    users.forEach(u => {
      if (!byPlan[u.plan || 'Free']) byPlan[u.plan || 'Free'] = [];
      byPlan[u.plan || 'Free'].push(u);
    });
    
    console.log('💳 Users by Plan:');
    Object.entries(byPlan).forEach(([plan, planUsers]) => {
      console.log(`   ${plan}: ${planUsers.length}`);
    });
    console.log('');
    
    // Check for test users
    const testUsers = users.filter(u => 
      /test.*@example\.com/i.test(u.email) || 
      /^test-/i.test(u.email) ||
      /^Test/i.test(u.name || '')
    );
    
    if (testUsers.length > 0) {
      console.log(`🧪 Test Users Found: ${testUsers.length}`);
      testUsers.forEach(u => {
        console.log(`   - ${u.email} (${u.name}) - Created: ${u.createdAt}`);
      });
      console.log('');
    }
    
    // Check for admin-created users (users created by admins)
    // Note: We can't easily tell this without audit logs, but we can check patterns
    
    // Show recent users
    console.log('📅 Recent Users (last 10):');
    const recentUsers = users.slice(-10);
    recentUsers.forEach(u => {
      const date = new Date(u.createdAt).toLocaleString();
      console.log(`   ${date} - ${u.email} (${u.name}) - Role: ${u.role} - Plan: ${u.plan}`);
    });
    console.log('');
    
    // Show oldest users
    console.log('📅 Oldest Users (first 10):');
    const oldestUsers = users.slice(0, 10);
    oldestUsers.forEach(u => {
      const date = new Date(u.createdAt).toLocaleString();
      console.log(`   ${date} - ${u.email} (${u.name}) - Role: ${u.role} - Plan: ${u.plan}`);
    });
    console.log('');
    
    // Check for users created around the same time (possible bulk creation)
    const creationTimes = users.map(u => new Date(u.createdAt).getTime());
    const timeGroups: Record<number, number> = {};
    creationTimes.forEach(time => {
      // Group by hour
      const hour = Math.floor(time / (1000 * 60 * 60));
      timeGroups[hour] = (timeGroups[hour] || 0) + 1;
    });
    
    const bulkCreations = Object.entries(timeGroups)
      .filter(([_, count]) => count >= 5)
      .sort(([_, a], [__, b]) => b - a);
    
    if (bulkCreations.length > 0) {
      console.log('⚠️  Possible Bulk User Creations (5+ users in same hour):');
      bulkCreations.forEach(([hour, count]) => {
        const date = new Date(parseInt(hour) * 1000 * 60 * 60).toLocaleString();
        console.log(`   ${date}: ${count} users created`);
      });
      console.log('');
    }
    
    // Email patterns
    console.log('📧 Email Domain Analysis:');
    const domains: Record<string, number> = {};
    users.forEach(u => {
      const domain = u.email.split('@')[1] || 'unknown';
      domains[domain] = (domains[domain] || 0) + 1;
    });
    
    Object.entries(domains)
      .sort(([_, a], [__, b]) => b - a)
      .forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count} users`);
      });
    
    await mongoose.disconnect();
    console.log('\n✅ Analysis complete');
  } catch (error: any) {
    console.error('❌ Error analyzing users:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

analyzeUsers();




