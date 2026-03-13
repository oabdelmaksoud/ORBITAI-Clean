
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

async function removeUnorganizedFolder() {
    console.log('🗑️  Starting removal of "Unorganized" folder...');

    try {
        // 1. Connect to MongoDB
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Find "Unorganized" folder
        // It might be unique per user, or one global? Based on schema it has userId. 
        // We should delete ALL folders named "Unorganized" to be thorough.

        // First, find IDs of all folders named "Unorganized"
        const foldersToDelete = await ProjectFolder.find({ name: 'Unorganized' });

        if (foldersToDelete.length === 0) {
            console.log('⚠️ No "Unorganized" folders found.');
            return;
        }

        console.log(`📂 Found ${foldersToDelete.length} "Unorganized" folders.`);

        const folderIds = foldersToDelete.map(f => f._id);

        // 3. Unassign conversations from these folders
        const updateResult = await ChatConversation.updateMany(
            { folderId: { $in: folderIds } },
            { $unset: { folderId: "" } }
        );

        console.log(`🔗 Unassigned ${updateResult.modifiedCount} conversations from the deleted folders.`);

        // 4. Delete the folders
        const deleteResult = await ProjectFolder.deleteMany({ _id: { $in: folderIds } });

        console.log(`✅ Deleted ${deleteResult.deletedCount} "Unorganized" folders from database.`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        // 5. Close connection
        await mongoose.connection.close();
        console.log('👋 Database connection closed');
        process.exit(0);
    }
}

removeUnorganizedFolder();
