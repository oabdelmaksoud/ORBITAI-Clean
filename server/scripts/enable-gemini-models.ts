
import mongoose from 'mongoose';
import { LLMModelConfig } from '../src/models/LLMModelConfig.model';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';

async function enableGeminiModels() {
    try {
        console.log('Connecting to MongoDB...', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // Find all models that look like Gemini
        // We check modelId starting with 'gemini' or provider being 'gemini' (if it exists)
        // Note: provider might be in modelDefinition.provider or top level specific to schema

        // We update all models where modelId includes 'gemini'
        const result = await LLMModelConfig.updateMany(
            { modelId: { $regex: /gemini/i } },
            { $set: { isEnabled: true, status: 'active' } }
        );

        console.log(`Enabled ${result.modifiedCount} Gemini models.`);

        // Also enable specific core models by ID just in case regex misses
        // gemini-2.5-flash, gemini-2.5-pro, etc.
        const specificIds = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-exp'];
        const resultSpecific = await LLMModelConfig.updateMany(
            { modelId: { $in: specificIds } },
            { $set: { isEnabled: true, status: 'active' } }
        );
        console.log(`Ensured core models enabled (matched ${resultSpecific.matchedCount}).`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

enableGeminiModels();
