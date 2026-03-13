
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserSettings } from '../src/models/UserSettings.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const INVALID_PROJECT_ID = '6941146bd1c646abbe2be4b5';

async function clearInvalidProjectId() {
    console.log('🧹 Cleaning up invalid project ID:', INVALID_PROJECT_ID);

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Find users with this project ID as current
        const usersWithInvalidProject = await UserSettings.find({ currentProjectId: INVALID_PROJECT_ID });

        if (usersWithInvalidProject.length === 0) {
            console.log('✅ No user settings found with this invalid project ID.');
        } else {
            console.log(`⚠️ Found ${usersWithInvalidProject.length} user(s) with stale project ID.`);

            const result = await UserSettings.updateMany(
                { currentProjectId: INVALID_PROJECT_ID },
                { $set: { currentProjectId: null } }
            );

            console.log(`✅ Cleared stale project ID from ${result.modifiedCount} user settings.`);
        }

        await mongoose.disconnect();
        console.log('✅ disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error cleaning up:', error);
        process.exit(1);
    }
}

clearInvalidProjectId();
