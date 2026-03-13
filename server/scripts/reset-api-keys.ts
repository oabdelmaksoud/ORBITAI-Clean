
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

async function resetApiKeys() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Drop the api_keys collection
        const collections = await mongoose.connection.db.listCollections({ name: 'apikeys' }).toArray();
        if (collections.length > 0) {
            await mongoose.connection.db.dropCollection('apikeys');
            console.log('✅ Dropped apikeys collection');
        } else {
            console.log('ℹ️  apikeys collection not found');
        }

        // Also clear User specific keys if any (skipping for now as they are likely in users collection)

        await mongoose.disconnect();
        console.log('✅ Done');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

resetApiKeys();
