/**
 * Collaborative Wiki Service
 * Manages collaborative documents with real-time editing
 * Inspired by XWiki and Confluence concepts
 */

import { CollaborativeDocument, ICollaborativeDocument } from '../models/CollaborativeDocument.model.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface DocumentUpdate {
  userId: string;
  userName: string;
  changes: Array<{
    type: 'insert' | 'delete' | 'format';
    position: number;
    length: number;
    content?: string;
  }>;
  timestamp: Date;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  position?: number;
  replies: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
  }>;
  timestamp: Date;
  resolved: boolean;
}

class CollaborativeWikiService {
  /**
   * Create a new collaborative document
   */
  async createDocument(
    title: string,
    content: string,
    contentType: 'markdown' | 'html' | 'plain',
    userId: string,
    userName: string
  ): Promise<ICollaborativeDocument> {
    const id = `doc-${crypto.randomUUID()}`;

    const document = await CollaborativeDocument.create({
      id,
      title,
      content,
      contentType,
      version: 1,
      versions: [{
        version: 1,
        content,
        changedBy: userId,
        changeDate: new Date(),
        changeSummary: 'Initial version'
      }],
      collaborators: [{
        userId,
        role: 'owner',
        joinedAt: new Date()
      }],
      activeEditors: [],
      comments: [],
      changes: [],
      tags: [],
      category: 'general',
      status: 'draft',
      locked: false,
      statistics: {
        views: 0,
        edits: 0,
        comments: 0
      },
      relatedDocuments: [],
      createdBy: userId,
      updatedBy: userId
    });

    logger.info(`Created collaborative document: ${id} - ${title}`);
    return document;
  }

  /**
   * Update document content
   */
  async updateDocument(
    documentId: string,
    content: string,
    userId: string,
    userName: string,
    changeSummary?: string
  ): Promise<ICollaborativeDocument> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Check if user has edit permission
    const collaborator = document.collaborators.find(c => c.userId === userId);
    if (!collaborator || (collaborator.role !== 'owner' && collaborator.role !== 'editor')) {
      throw new Error('User does not have edit permission');
    }

    // Check if locked
    if (document.locked && document.lockedBy !== userId) {
      throw new Error('Document is locked by another user');
    }

    // Calculate changes (simplified diff)
    const changes = this.calculateChanges(document.content, content);

    // Update document
    const oldVersion = document.version;
    document.content = content;
    document.version = oldVersion + 1;
    document.updatedBy = userId;

    // Add to version history
    document.versions.push({
      version: document.version,
      content,
      changedBy: userId,
      changeDate: new Date(),
      changeSummary: changeSummary || `Updated by ${userName}`
    });

    // Keep only last 50 versions
    if (document.versions.length > 50) {
      document.versions = document.versions.slice(-50);
    }

    // Record changes
    changes.forEach(change => {
      document.changes.push({
        id: `change-${crypto.randomUUID()}`,
        userId,
        userName,
        type: change.type,
        position: change.position,
        length: change.length,
        content: change.content,
        timestamp: new Date()
      });
    });

    // Keep only last 1000 changes
    if (document.changes.length > 1000) {
      document.changes = document.changes.slice(-1000);
    }

    // Update statistics
    document.statistics.edits += 1;
    document.statistics.lastEdited = new Date();

    await document.save();

    logger.info(`Updated document: ${documentId} by ${userName}`);
    return document;
  }

  /**
   * Calculate changes between old and new content
   */
  private calculateChanges(
    oldContent: string,
    newContent: string
  ): Array<{ type: 'insert' | 'delete' | 'format'; position: number; length: number; content?: string }> {
    const changes: Array<{ type: 'insert' | 'delete' | 'format'; position: number; length: number; content?: string }> = [];
    
    // Simple diff algorithm (would use proper diff library in production)
    const minLength = Math.min(oldContent.length, newContent.length);
    let diffStart = 0;

    // Find first difference
    for (let i = 0; i < minLength; i++) {
      if (oldContent[i] !== newContent[i]) {
        diffStart = i;
        break;
      }
    }

    // Find last difference
    let diffEnd = minLength;
    for (let i = 1; i <= minLength; i++) {
      if (oldContent[oldContent.length - i] !== newContent[newContent.length - i]) {
        diffEnd = minLength - i + 1;
        break;
      }
    }

    if (diffStart < diffEnd) {
      const deletedLength = diffEnd - diffStart;
      const insertedContent = newContent.substring(diffStart, diffStart + (newContent.length - oldContent.length + deletedLength));
      
      if (deletedLength > 0) {
        changes.push({
          type: 'delete',
          position: diffStart,
          length: deletedLength
        });
      }

      if (insertedContent.length > 0) {
        changes.push({
          type: 'insert',
          position: diffStart,
          length: insertedContent.length,
          content: insertedContent
        });
      }
    }

    return changes;
  }

  /**
   * Add a comment
   */
  async addComment(
    documentId: string,
    userId: string,
    userName: string,
    content: string,
    position?: number
  ): Promise<Comment> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const comment: Comment = {
      id: `comment-${crypto.randomUUID()}`,
      userId,
      userName,
      content,
      position,
      replies: [],
      timestamp: new Date(),
      resolved: false
    };

    document.comments.push(comment);
    document.statistics.comments += 1;
    await document.save();

    logger.info(`Added comment to document: ${documentId}`);
    return comment;
  }

  /**
   * Add reply to comment
   */
  async replyToComment(
    documentId: string,
    commentId: string,
    userId: string,
    userName: string,
    content: string
  ): Promise<void> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const comment = document.comments.find(c => c.id === commentId);
    if (!comment) {
      throw new Error(`Comment not found: ${commentId}`);
    }

    comment.replies.push({
      id: `reply-${crypto.randomUUID()}`,
      userId,
      userName,
      content,
      timestamp: new Date()
    });

    await document.save();
  }

  /**
   * Update active editor status
   */
  async updateActiveEditor(
    documentId: string,
    userId: string,
    userName: string,
    cursorPosition?: number
  ): Promise<void> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      return;
    }

    const existingEditor = document.activeEditors.find(e => e.userId === userId);
    if (existingEditor) {
      existingEditor.cursorPosition = cursorPosition;
      existingEditor.lastSeen = new Date();
    } else {
      document.activeEditors.push({
        userId,
        userName,
        cursorPosition,
        lastSeen: new Date()
      });
    }

    // Remove editors inactive for more than 30 seconds
    const now = new Date();
    document.activeEditors = document.activeEditors.filter(
      e => now.getTime() - e.lastSeen.getTime() < 30000
    );

    await document.save();
  }

  /**
   * Get document version
   */
  async getDocumentVersion(documentId: string, version: number): Promise<string | null> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      return null;
    }

    const versionData = document.versions.find(v => v.version === version);
    return versionData?.content || null;
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    documentId: string,
    version1: number,
    version2: number
  ): Promise<{
    version1: string;
    version2: string;
    diff: string;
  }> {
    const [content1, content2] = await Promise.all([
      this.getDocumentVersion(documentId, version1),
      this.getDocumentVersion(documentId, version2)
    ]);

    if (!content1 || !content2) {
      throw new Error('One or both versions not found');
    }

    // Simple diff (would use proper diff library in production)
    const diff = this.generateDiff(content1, content2);

    return {
      version1: content1,
      version2: content2,
      diff
    };
  }

  /**
   * Generate diff text
   */
  private generateDiff(oldContent: string, newContent: string): string {
    // Simplified diff (would use proper diff algorithm)
    if (oldContent === newContent) {
      return 'No changes';
    }

    const lines1 = oldContent.split('\n');
    const lines2 = newContent.split('\n');
    const diff: string[] = [];

    const maxLines = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (line1 !== line2) {
        if (line1) diff.push(`- ${line1}`);
        if (line2) diff.push(`+ ${line2}`);
      } else {
        diff.push(`  ${line1}`);
      }
    }

    return diff.join('\n');
  }

  /**
   * Lock document
   */
  async lockDocument(documentId: string, userId: string): Promise<void> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    document.locked = true;
    document.lockedBy = userId;
    await document.save();
  }

  /**
   * Unlock document
   */
  async unlockDocument(documentId: string, userId: string): Promise<void> {
    const document = await CollaborativeDocument.findOne({ id: documentId });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (document.lockedBy === userId) {
      document.locked = false;
      document.lockedBy = undefined;
      await document.save();
    }
  }
}

export const collaborativeWikiService = new CollaborativeWikiService();
















