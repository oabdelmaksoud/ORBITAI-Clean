import { ProjectFolder, IProjectFolder } from '../models/ProjectFolder.model';
import { logger } from '../utils/logger';

/**
 * Service for managing project folders
 */
export class ProjectFolderService {
  /**
   * Ensure default "Unorganized" folder exists for a user
   * Creates it if it doesn't exist
   */
  static async ensureDefaultFolder(userId: string): Promise<IProjectFolder | null> {
    try {
      // Look for existing default folder
      let defaultFolder = await ProjectFolder.findOne({
        userId,
        name: 'Unorganized'
      });

      // Create if doesn't exist
      if (!defaultFolder) {
        defaultFolder = await ProjectFolder.create({
          userId,
          name: 'Unorganized',
          description: 'Default folder for unorganized conversations',
          platforms: ['other'],
          metadata: { isDefault: true },
          conversationIds: []
        });
        logger.info(`Created default folder for user ${userId}`);
      }

      return defaultFolder;
    } catch (error: any) {
      logger.error('Error ensuring default folder:', error);
      return null;
    }
  }

  /**
   * Get or create default folder for a user
   */
  static async getOrCreateDefaultFolder(userId: string): Promise<IProjectFolder | null> {
    return this.ensureDefaultFolder(userId);
  }

  /**
   * Get all folders for a user
   */
  static async getFoldersByUserId(userId: string): Promise<IProjectFolder[]> {
    try {
      return await ProjectFolder.find({ userId })
        .sort({ createdAt: -1 })
        .lean();
    } catch (error: any) {
      logger.error('Error getting folders by userId:', error);
      throw error;
    }
  }

  /**
   * Get folder by ID (with user validation)
   */
  static async getFolderById(folderId: string, userId: string): Promise<IProjectFolder | null> {
    try {
      return await ProjectFolder.findOne({ _id: folderId, userId }).lean();
    } catch (error: any) {
      logger.error('Error getting folder by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new folder
   */
  static async createFolder(data: {
    userId: string;
    name: string;
    description?: string;
    platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
    metadata?: Record<string, any>;
  }): Promise<IProjectFolder> {
    try {
      // Handle migration: if platform (singular) is provided, convert to platforms array
      const platforms = data.platforms && data.platforms.length > 0 ? data.platforms : ['other'];
      const folder = await ProjectFolder.create({
        userId: data.userId,
        name: data.name,
        description: data.description,
        platforms,
        metadata: data.metadata || {},
        conversationIds: []
      });
      return folder;
    } catch (error: any) {
      logger.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Update folder
   */
  static async updateFolder(
    folderId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
      metadata?: Record<string, any>;
    }
  ): Promise<IProjectFolder | null> {
    try {
      // Handle migration: ensure platforms is an array if provided
      const processedUpdates: any = { ...updates };
      if (processedUpdates.platforms !== undefined && processedUpdates.platforms.length === 0) {
        processedUpdates.platforms = ['other'];
      }
      const folder = await ProjectFolder.findOneAndUpdate(
        { _id: folderId, userId },
        { $set: processedUpdates },
        { new: true }
      );
      return folder;
    } catch (error: any) {
      logger.error('Error updating folder:', error);
      throw error;
    }
  }

  /**
   * Delete folder
   * @param folderId ID of folder to delete
   * @param userId ID of owner
   * @param hardDelete If true, deletes all contained conversations. If false, moves them to Unorganized.
   */
  static async deleteFolder(folderId: string, userId: string, hardDelete: boolean = false): Promise<void> {
    try {
      const folder = await ProjectFolder.findOne({ _id: folderId, userId });
      if (!folder) {
        throw new Error('Folder not found');
      }

      const { ChatConversation } = await import('../models/ChatConversation.model');

      if (hardDelete) {
        // Hard delete: Remove all conversations in this folder
        if (folder.conversationIds.length > 0) {
          logger.info(`Hard deleting folder ${folderId}: Removing ${folder.conversationIds.length} conversations`);
          await ChatConversation.deleteMany({ _id: { $in: folder.conversationIds }, userId });
        }
      } else {
        // Soft delete: Remove folder association (orphan conversations)
        if (folder.conversationIds.length > 0) {
          // Update conversations to remove folderId (set to null/undefined)
          await ChatConversation.updateMany(
            { _id: { $in: folder.conversationIds }, userId },
            { $unset: { folderId: "" } }
          );
        }
      }

      // Delete the folder
      await ProjectFolder.findByIdAndDelete(folderId);
    } catch (error: any) {
      logger.error('Error deleting folder:', error);
      throw error;
    }
  }

  /**
   * Add conversation to folder
   */
  static async addConversationToFolder(
    folderId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      const folder = await ProjectFolder.findOne({ _id: folderId, userId });
      if (!folder) {
        throw new Error('Folder not found');
      }

      // Update conversation's folderId
      const { ChatConversation } = await import('../models/ChatConversation.model');
      await ChatConversation.findOneAndUpdate(
        { _id: conversationId, userId },
        { $set: { folderId: folderId } }
      );

      // Add to folder's conversationIds if not already present
      if (!folder.conversationIds.includes(conversationId)) {
        await ProjectFolder.findByIdAndUpdate(
          folderId,
          { $addToSet: { conversationIds: conversationId } }
        );
      }
    } catch (error: any) {
      logger.error('Error adding conversation to folder:', error);
      throw error;
    }
  }

  /**
   * Remove conversation from folder
   */
  static async removeConversationFromFolder(
    folderId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      const folder = await ProjectFolder.findOne({ _id: folderId, userId });
      if (!folder) {
        throw new Error('Folder not found');
      }

      // Update conversation's folderId to remove it
      const { ChatConversation } = await import('../models/ChatConversation.model');
      await ChatConversation.findOneAndUpdate(
        { _id: conversationId, userId },
        { $unset: { folderId: "" } }
      );

      // Remove from folder's conversationIds
      await ProjectFolder.findByIdAndUpdate(
        folderId,
        { $pull: { conversationIds: conversationId } }
      );
    } catch (error: any) {
      logger.error('Error removing conversation from folder:', error);
      throw error;
    }
  }
}

