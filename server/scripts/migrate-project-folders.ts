/**
 * Migration script to create default "Unorganized" folders for all existing users
 * and assign all existing conversations to these folders.
 * 
 * Run with: npx tsx server/scripts/migrate-project-folders.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../src/config/database.js';
import { ChatConversation } from '../src/models/ChatConversation.model.js';
import { ProjectFolder } from '../src/models/ProjectFolder.model.js';
import { ProjectFolderService } from '../src/services/projectFolder.service.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

async function migrateProjectFolders() {
  try {
    console.log('🔄 Starting project folders migration...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Connected to database');

    // Get all unique user IDs from conversations
    const conversations = await ChatConversation.find({
      userId: { $exists: true, $ne: null }
    }).distinct('userId');
    
    console.log(`📊 Found ${conversations.length} unique users with conversations`);

    let foldersCreated = 0;
    let conversationsUpdated = 0;

    // Process each user
    for (const userId of conversations) {
      try {
        // Ensure default folder exists
        const defaultFolder = await ProjectFolderService.ensureDefaultFolder(userId);
        
        if (!defaultFolder) {
          console.log(`⚠️  Failed to create default folder for user ${userId}`);
          continue;
        }

        // Check if folder was just created (new)
        const wasNew = !defaultFolder._id || 
          (defaultFolder.createdAt && 
           new Date(defaultFolder.createdAt).getTime() > Date.now() - 5000);
        
        if (wasNew) {
          foldersCreated++;
        }

        // Get all conversations for this user that don't have a folderId
        const userConversations = await ChatConversation.find({
          userId,
          $or: [
            { folderId: { $exists: false } },
            { folderId: null }
          ]
        });

        if (userConversations.length > 0) {
          // Update conversations to point to default folder
          await ChatConversation.updateMany(
            {
              userId,
              _id: { $in: userConversations.map(c => c._id) }
            },
            {
              $set: { folderId: defaultFolder._id.toString() }
            }
          );

          // Add conversations to folder's conversationIds
          const conversationIds = userConversations.map(c => c._id.toString());
          await ProjectFolder.findByIdAndUpdate(
            defaultFolder._id,
            {
              $addToSet: { conversationIds: { $each: conversationIds } }
            }
          );

          conversationsUpdated += userConversations.length;
          console.log(`✅ User ${userId}: Updated ${userConversations.length} conversations`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing user ${userId}:`, error.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Folders created: ${foldersCreated}`);
    console.log(`   Conversations updated: ${conversationsUpdated}`);
    console.log('✅ Migration completed successfully!');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateProjectFolders();


