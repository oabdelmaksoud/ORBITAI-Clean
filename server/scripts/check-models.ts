
import mongoose from 'mongoose';
import { LLMModelConfig } from '../src/models/LLMModelConfig.model';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';

async function checkModels() {
    try {
        console.log('Connecting to MongoDB...', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const models = await LLMModelConfig.find({});
        console.log(`Found ${models.length} model configs.`);

        const enabledModels = models.filter(m => m.isEnabled);
        console.log(`Enabled models: ${enabledModels.length}`);

        if (enabledModels.length > 0) {
            console.log('Enabled Models:');
            enabledModels.forEach(m => console.log(` - ${m.modelId} (${m.provider}): isEnabled=${m.isEnabled}, status=${m.status}`));
        } else {
            console.log('NO ENABLED MODELS FOUND!');
        }

        const disabledModels = models.filter(m => !m.isEnabled);
        if (disabledModels.length > 0) {
            console.log('Disabled Models (First 5):');
            disabledModels.slice(0, 5).forEach(m => console.log(` - ${m.modelId} (${m.provider}): isEnabled=${m.isEnabled}, status=${m.status}`));
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkModels();
