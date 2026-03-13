/**
 * Script to create an admin user
 * Usage: npm run create-admin -- email password name
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

async function createAdmin() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.error('Usage: npm run create-admin -- <email> <password> <name> [role]');
      console.error('Example: npm run create-admin -- admin@example.com password123 "Admin User" superadmin');
      process.exit(1);
    }

    const [email, password, name, role = 'admin'] = args;

    if (role !== 'admin' && role !== 'superadmin') {
      console.error('Role must be either "admin" or "superadmin"');
      process.exit(1);
    }

    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
    
    if (!mongoUri || mongoUri === 'undefined') {
      console.error('❌ Error: MONGODB_URI is not set in environment variables');
      console.error('   Please set MONGODB_URI in server/.env file');
      process.exit(1);
    }
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log(`⚠️  User with email ${email} already exists.`);
      console.log(`   Current role: ${existingUser.role}`);
      
      // Update role if it's different from requested role
      const currentRole = existingUser.role;
      if (currentRole !== role) {
        existingUser.role = role as 'admin' | 'superadmin';
        await existingUser.save();
        console.log(`✅ Updated user role from ${currentRole} to ${role}`);
      } else {
        console.log(`   User already has role: ${role}. No changes made.`);
      }
      
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create new admin user (password will be hashed by pre-save hook)
    const adminUser = new User({
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      name,
      role: role as 'admin' | 'superadmin',
      plan: 'Enterprise',
      isActive: true
    });

    await adminUser.save();
    console.log(`✅ Admin user created successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Role: ${role}`);
    console.log(`   ID: ${adminUser._id}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

createAdmin();

