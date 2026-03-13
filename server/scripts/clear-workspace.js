
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';

async function clearData() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // Dynamic import of models (assuming they are ES modules)
        // Note: In a standalone script, defining simple schemas/models often easier than importing if strict types aren't needed,
        // but better to rely on actual collection names.

        const db = mongoose.connection.db;

        console.log('Clearing "projectfolders"...');
        const folders = await db.collection('projectfolders').deleteMany({});
        console.log(`Deleted ${folders.deletedCount} folders.`);

        console.log('Clearing "chatconversations"...');
        const chats = await db.collection('chatconversations').deleteMany({});
        console.log(`Deleted ${chats.deletedCount} chats.`);

        // Also clear "messages" if it exists as a separate collection? 
        // The ChatConversation model embeds messages, but check if there's a separate one.
        // Based on list_dir earlier, there isn't a Message model, so it's embedded.

        console.log('Clearing "projects"...');
        // Assuming 'projects' collection matches Project model
        const projects = await db.collection('projects').deleteMany({});
        console.log(`Deleted ${projects.deletedCount} projects.`);

        console.log('Workspace cleared successfully.');
    } catch (error) {
        console.error('Error clearing data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    }
}

clearData();
