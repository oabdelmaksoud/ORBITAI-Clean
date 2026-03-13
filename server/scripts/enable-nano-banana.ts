/**
 * Enable Nano Banana model for image generation
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function enableModel() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const result = await mongoose.connection.collection('llmmodelconfigs').updateOne(
        { modelId: 'gemini-nano-banana-pro-preview' },
        { $set: { isEnabled: true, status: 'active' } }
    );

    if (result.matchedCount > 0) {
        console.log('✅ Enabled gemini-nano-banana-pro-preview model');
    } else {
        console.log('❌ Model not found in database');
    }

    await mongoose.disconnect();
    console.log('Done');
}

enableModel().catch(console.error);
