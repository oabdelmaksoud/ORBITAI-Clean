/**
 * Script to reset a user's password
 * Usage: npx tsx scripts/reset-password.ts <email> <new_password>
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

async function resetPassword() {
    try {
        const args = process.argv.slice(2);

        if (args.length < 2) {
            console.error('Usage: npx tsx scripts/reset-password.ts <email> <new_password>');
            process.exit(1);
        }

        const [email, password] = args;

        // Get MongoDB URI from environment
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';

        console.log(`Connecting to MongoDB at ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`);

        if (!mongoUri || mongoUri === 'undefined') {
            console.error('❌ Error: MONGODB_URI is not set in environment variables');
            process.exit(1);
        }

        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Find and update user
        const user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            console.log(`Found user: ${user.email} (Role: ${user.role})`);
            user.password = password; // Pre-save hook will hash this
            await user.save();
            console.log(`✅ Password for ${email} has been updated successfully.`);
        } else {
            console.log(`❌ User with email ${email} not found.`);
            console.log('Creating new admin user since they do not exist...');
            const newUser = new User({
                email: email.toLowerCase(),
                password: password,
                name: 'Admin User',
                role: 'superadmin',
                plan: 'Enterprise',
                isActive: true
            });
            await newUser.save();
            console.log(`✅ New superadmin user created: ${email}`);
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);

    } catch (error: any) {
        console.error('❌ Error resetting password:', error.message);
        await mongoose.disconnect().catch(() => { });
        process.exit(1);
    }
}

resetPassword();
