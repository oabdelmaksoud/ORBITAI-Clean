
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectFolder } from '../src/models/ProjectFolder.model.js';
import { ChatConversation } from '../src/models/ChatConversation.model.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanupUnorganizedChats() {
    console.log('🧹 Starting cleanup of "Unorganized" chats...');

    try {
        // 1. Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Find "Unorganized" folder
        const unorganizedFolder = await ProjectFolder.findOne({ name: 'Unorganized' });

        if (!unorganizedFolder) {
            console.log('⚠️ "Unorganized" folder not found. Nothing to delete.');
            return;
        }

        console.log(`📂 Found "Unorganized" folder ID: ${unorganizedFolder._id}`);

        // 3. Delete conversations in this folder
        const result = await ChatConversation.deleteMany({ folderId: unorganizedFolder._id });

        console.log(`🗑️  Deleted ${result.deletedCount} conversations from "Unorganized" folder.`);

        // 4. Update folder metadata if needed (optional, checking schema first, but standard is just count)
        // Some implementations might track conversationCount on folder, update it if so
        // Assuming simple model first, but let's check count
        const remainingCount = await ChatConversation.countDocuments({ folderId: unorganizedFolder._id });
        console.log(`info: Remaining conversations in "Unorganized": ${remainingCount}`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        // 5. Close connection
        await mongoose.connection.close();
        console.log('👋 Database connection closed');
        process.exit(0);
    }
}

cleanupUnorganizedChats();
