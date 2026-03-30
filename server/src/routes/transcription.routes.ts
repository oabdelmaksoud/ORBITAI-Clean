/**
 * Transcription Routes
 * Endpoints for managing voice conversation transcriptions
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ChatConversation } from '../models/ChatConversation.model.js';
import { BrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/transcriptions/:conversationId
 * Get transcriptions for a conversation
 */
router.get('/conversations/:conversationId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({ _id: conversationId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check access
    if (conversation.userId && conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const transcripts = conversation.metadata?.voiceTranscripts || [];
    
    res.json({
      conversationId,
      transcripts,
      isVoiceConversation: conversation.metadata?.isVoiceConversation || false
    });
  } catch (error: unknown) {
    logger.error('Error fetching transcriptions:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/transcriptions/:conversationId
 * Add transcription to conversation
 */
router.post('/conversations/:conversationId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { userText, aiText } = req.body;
    const userId = req.user?.id;

    if (!userText && !aiText) {
      return res.status(400).json({ error: 'At least userText or aiText is required' });
    }

    const conversation = await ChatConversation.findOne({ _id: conversationId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check access
    if (conversation.userId && conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Initialize metadata if needed
    if (!conversation.metadata) {
      conversation.metadata = {};
    }

    // Initialize voiceTranscripts if needed
    if (!conversation.metadata.voiceTranscripts) {
      conversation.metadata.voiceTranscripts = [];
    }

    // Add new transcript
    conversation.metadata.voiceTranscripts.push({
      userText: userText || '',
      aiText: aiText || '',
      timestamp: Date.now()
    });

    conversation.metadata.isVoiceConversation = true;
    await conversation.save();

    res.json({
      success: true,
      transcript: conversation.metadata.voiceTranscripts[conversation.metadata.voiceTranscripts.length - 1]
    });
  } catch (error: unknown) {
    logger.error('Error adding transcription:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/transcriptions/search
 * Search transcriptions
 */
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { query, conversationId, roomId } = req.query;
    const userId = req.user?.id;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchRegex = new RegExp(query as string, 'i');
    const results: Array<{
      conversationId: string;
      roomId?: string;
      transcript: any;
      matchedText: string;
    }> = [];

    // Search in conversations
    if (conversationId) {
      const conversation = await ChatConversation.findOne({ 
        _id: conversationId,
        userId: userId 
      });
      
      if (conversation?.metadata?.voiceTranscripts) {
        conversation.metadata.voiceTranscripts.forEach((transcript: any) => {
          if (searchRegex.test(transcript.userText) || searchRegex.test(transcript.aiText)) {
            results.push({
              conversationId: conversation._id.toString(),
              transcript,
              matchedText: transcript.userText.match(searchRegex)?.[0] || transcript.aiText.match(searchRegex)?.[0] || ''
            });
          }
        });
      }
    } else {
      // Search all user's conversations
      const conversations = await ChatConversation.find({ userId: userId });
      
      for (const conversation of conversations) {
        if (conversation.metadata?.voiceTranscripts) {
          conversation.metadata.voiceTranscripts.forEach((transcript: any) => {
            if (searchRegex.test(transcript.userText) || searchRegex.test(transcript.aiText)) {
              results.push({
                conversationId: conversation._id.toString(),
                transcript,
                matchedText: transcript.userText.match(searchRegex)?.[0] || transcript.aiText.match(searchRegex)?.[0] || ''
              });
            }
          });
        }
      }
    }

    // Search in brainstorming rooms
    if (roomId) {
      const room = await BrainstormingRoom.findOne({ 
        id: roomId,
        $or: [
          { createdBy: userId },
          { 'participants.userId': userId }
        ]
      });
      
      // Rooms don't have transcriptions directly, but could link to conversations
      // This is a placeholder for future enhancement
    }

    res.json({
      query,
      results,
      count: results.length
    });
  } catch (error: unknown) {
    logger.error('Error searching transcriptions:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/transcriptions/:conversationId/export
 * Export transcriptions as text
 */
router.get('/conversations/:conversationId/export', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { format } = req.query; // 'text' | 'json'
    const userId = req.user?.id;

    const conversation = await ChatConversation.findOne({ _id: conversationId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check access
    if (conversation.userId && conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const transcripts = conversation.metadata?.voiceTranscripts || [];

    if (format === 'json') {
      res.json({ transcripts });
    } else {
      // Export as plain text
      const textContent = transcripts.map((t: any, index: number) => {
        const date = new Date(t.timestamp).toLocaleString();
        return `[${date}] User: ${t.userText}\n[${date}] AI: ${t.aiText}\n`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="transcription-${conversationId}.txt"`);
      res.send(textContent);
    }
  } catch (error: unknown) {
    logger.error('Error exporting transcriptions:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

