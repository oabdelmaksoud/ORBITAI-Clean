#!/usr/bin/env tsx
import mongoose from 'mongoose';
import { config } from '../src/config/env';
import { apiKeyManagement } from '../src/services/apiKeyManagement.service';
import { User } from '../src/models/User.model';

async function addGeminiKey() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(config.mongodbUri);
        console.log('✅ Connected to MongoDB');

        // Find a user (admin or first user) to assign key to
        // We need a valid user ID for the 'createdBy' field
        const user = await User.findOne();
        const userId = user ? user._id.toString() : new mongoose.Types.ObjectId().toString(); // Fallback to random ID if no user (should be rare)

        console.log(`👤 Using User ID: ${userId}`);

        const key = process.env.GEMINI_API_KEY || 'AIzaSyDuSVgFxc6fNY7kU__tOJT6is9Vg6svNVE';

        console.log('🔑 Adding Gemini API key...');
        await apiKeyManagement.createApiKey({
            provider: 'gemini',
            keyName: 'System Gemini Key (Repaired)',
            value: key,
            metadata: {
                description: 'Added via repair script to fix encryption error',
                enabledEnvironments: ['development', 'production']
            }
        }, userId);

        console.log('✅ Gemini API key added successfully!');

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addGeminiKey();
