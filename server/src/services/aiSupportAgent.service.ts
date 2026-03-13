/**
 * AI Support Agent Service
 * Handles AI-powered customer support with ability to:
 * - Understand and respond to user issues
 * - Create background tasks for technical fixes
 * - Escalate to human agents when needed
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupportChat, ISupportChat } from '../models/SupportChat.model.js';
import { SupportTicket } from '../models/SupportTicket.model.js';
import { User } from '../models/User.model.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { webSocketService } from './websocket.service.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';

// Lazy initialization for Gemini AI (using apiKeyProvider for security)
let genAI: GoogleGenerativeAI | null = null;

async function getGenAI(): Promise<GoogleGenerativeAI> {
  if (!genAI) {
    const apiKey = await apiKeyProvider.getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add it via Admin Console → Settings → API Keys');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// Types
export interface AIResponse {
  message: string;
  action?: 'continue' | 'escalate' | 'create_task' | 'resolve';
  taskDetails?: {
    type: 'bug_fix' | 'account_issue' | 'billing_adjustment' | 'feature_request' | 'technical_support';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    description: string;
    assignToRole?: string;
  };
  escalationReason?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'frustrated';
  confidence: number;
}

export interface BackgroundTask {
  id: string;
  chatId: string;
  userId: string;
  type: string;
  priority: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  assignedToName?: string;
  createdAt: Date;
  completedAt?: Date;
  result?: string;
}

// In-memory task queue (in production, use Redis or database)
const backgroundTasks: Map<string, BackgroundTask> = new Map();

// System prompt for AI support agent
const SYSTEM_PROMPT = `You are OrbitAI's friendly and helpful AI Support Agent. Your role is to:

1. UNDERSTAND the user's issue clearly by asking clarifying questions if needed
2. SOLVE problems directly when possible (account questions, how-to guides, feature explanations)
3. CREATE BACKGROUND TASKS for technical issues that need fixing (bugs, account adjustments, billing issues)
4. ESCALATE to a human agent only when:
   - User explicitly requests human support
   - Issue is too complex or sensitive (legal, severe complaints)
   - User seems very frustrated after 3+ exchanges
   - You cannot understand or solve the issue

IMPORTANT GUIDELINES:
- Be warm, professional, and empathetic
- Keep responses concise but helpful (2-4 sentences typically)
- If creating a background task, reassure user it's being handled
- Never make up information - if unsure, say so
- For billing/refund issues, you CAN create tasks but cannot process them directly
- For technical bugs, create a task and explain the fix is being worked on

RESPONSE FORMAT:
Always respond with a JSON object:
{
  "message": "Your response to the user",
  "action": "continue" | "escalate" | "create_task" | "resolve",
  "taskDetails": { // Only if action is "create_task"
    "type": "bug_fix" | "account_issue" | "billing_adjustment" | "feature_request" | "technical_support",
    "priority": "low" | "medium" | "high" | "urgent",
    "description": "Detailed description for the support team"
  },
  "escalationReason": "Reason for escalation", // Only if action is "escalate"
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "confidence": 0.0-1.0 // Your confidence in handling this issue
}`;

/**
 * Get user context for AI to understand the user better
 */
async function getUserContext(userId: string): Promise<string> {
  try {
    const [user, recentTickets, recentChats] = await Promise.all([
      User.findById(userId).select('name email plan role createdAt').lean(),
      SupportTicket.find({ userId }).sort({ createdAt: -1 }).limit(3).select('subject status category').lean(),
      SupportChat.find({ userId, status: 'ended' }).sort({ createdAt: -1 }).limit(2).select('rating').lean()
    ]);

    if (!user) return 'New user with no history.';

    const accountAge = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const avgRating = recentChats.length > 0
      ? recentChats.filter(c => c.rating).reduce((sum, c) => sum + (c.rating || 0), 0) / recentChats.filter(c => c.rating).length
      : null;

    return `
User Context:
- Name: ${user.name}
- Plan: ${user.plan || 'Free'}
- Account age: ${accountAge} days
- Recent tickets: ${recentTickets.length > 0 ? recentTickets.map(t => `${t.subject} (${t.status})`).join(', ') : 'None'}
- Previous chat ratings: ${avgRating ? `${avgRating.toFixed(1)}/5` : 'No ratings yet'}
`;
  } catch (error) {
    logger.error('[AI Support] Error getting user context:', error);
    return 'Unable to fetch user context.';
  }
}

/**
 * Format chat history for AI context
 */
function formatChatHistory(messages: ISupportChat['messages']): string {
  return messages
    .slice(-10) // Last 10 messages for context
    .map(m => `${m.sender === 'user' ? 'User' : m.sender === 'ai' ? 'AI Agent' : 'System'}: ${m.content}`)
    .join('\n');
}

/**
 * Generate AI response for user message
 */
export async function generateAIResponse(
  chatId: string,
  userMessage: string,
  userId: string
): Promise<AIResponse> {
  try {
    const chat = await SupportChat.findOne({ chatId });
    if (!chat) {
      throw new Error('Chat not found');
    }

    const userContext = await getUserContext(userId);
    const chatHistory = formatChatHistory(chat.messages);

    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `${SYSTEM_PROMPT}

${userContext}

Chat History:
${chatHistory}

User's new message: "${userMessage}"

Respond with the JSON object as specified. Remember to be helpful and empathetic.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    let aiResponse: AIResponse;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        aiResponse = {
          message: responseText,
          action: 'continue',
          sentiment: 'neutral',
          confidence: 0.5
        };
      }
    } catch (parseError) {
      logger.warn('[AI Support] Failed to parse AI response as JSON, using raw text');
      aiResponse = {
        message: responseText,
        action: 'continue',
        sentiment: 'neutral',
        confidence: 0.5
      };
    }

    // Validate and sanitize response
    if (!aiResponse.message) {
      aiResponse.message = "I apologize, but I'm having trouble processing your request. Let me connect you with a human agent.";
      aiResponse.action = 'escalate';
      aiResponse.escalationReason = 'AI response generation failed';
    }

    return aiResponse;
  } catch (error) {
    logger.error('[AI Support] Error generating AI response:', error);
    return {
      message: "I'm experiencing some technical difficulties. Let me connect you with a human agent who can help you better.",
      action: 'escalate',
      escalationReason: 'AI service error',
      sentiment: 'neutral',
      confidence: 0
    };
  }
}

/**
 * Process AI response and take appropriate actions
 */
export async function processAIResponse(
  chatId: string,
  userId: string,
  aiResponse: AIResponse
): Promise<{ success: boolean; task?: BackgroundTask; escalated?: boolean }> {
  try {
    const chat = await SupportChat.findOne({ chatId });
    if (!chat) {
      throw new Error('Chat not found');
    }

    // Add AI message to chat
    const aiMessage = {
      id: uuidv4(),
      sender: 'ai' as const,
      senderId: 'ai-agent',
      senderName: 'AI Support Agent',
      content: aiResponse.message,
      createdAt: new Date()
    };
    chat.messages.push(aiMessage);

    // Update chat metadata with sentiment
    if (!chat.metadata) chat.metadata = {};
    chat.metadata.lastSentiment = aiResponse.sentiment;
    chat.metadata.aiConfidence = aiResponse.confidence;

    let result: { success: boolean; task?: BackgroundTask; escalated?: boolean } = { success: true };

    // Handle different actions
    switch (aiResponse.action) {
      case 'create_task':
        if (aiResponse.taskDetails) {
          const task = await createBackgroundTask(chatId, userId, aiResponse.taskDetails);
          result.task = task;

          // Add system message about task creation
          chat.messages.push({
            id: uuidv4(),
            sender: 'system',
            senderId: 'system',
            senderName: 'System',
            content: `A support task has been created and assigned to our team. Task ID: ${task.id.slice(0, 8)}`,
            createdAt: new Date()
          });
        }
        break;

      case 'escalate':
        // Move chat to human queue
        chat.status = 'queued';
        chat.queuedAt = new Date();
        chat.metadata.escalationReason = aiResponse.escalationReason;
        chat.metadata.escalatedFromAI = true;

        // Calculate queue position
        const queueCount = await SupportChat.countDocuments({ status: 'queued' });
        chat.queuePosition = queueCount + 1;

        // Add system message
        chat.messages.push({
          id: uuidv4(),
          sender: 'system',
          senderId: 'system',
          senderName: 'System',
          content: 'Connecting you with a human support agent. Please wait...',
          createdAt: new Date()
        });

        // Notify human agents
        webSocketService.broadcastToRoom('support-agents', {
          type: 'escalated_chat',
          chat: {
            chatId: chat.chatId,
            userName: chat.userName,
            userEmail: chat.userEmail,
            userPlan: chat.userPlan,
            queuePosition: chat.queuePosition,
            escalationReason: aiResponse.escalationReason
          }
        });

        result.escalated = true;
        break;

      case 'resolve':
        // Mark as resolved by AI
        chat.metadata.resolvedByAI = true;
        chat.messages.push({
          id: uuidv4(),
          sender: 'system',
          senderId: 'system',
          senderName: 'System',
          content: 'Your issue has been resolved. Is there anything else I can help you with?',
          createdAt: new Date()
        });
        break;

      case 'continue':
      default:
        // Just continue the conversation
        break;
    }

    await chat.save();

    // Broadcast AI message to user via WebSocket
    webSocketService.broadcastToRoom(`chat:${chatId}`, {
      type: 'new_message',
      message: aiMessage,
      chatId
    });

    return result;
  } catch (error) {
    logger.error('[AI Support] Error processing AI response:', error);
    return { success: false };
  }
}

/**
 * Create a background task for technical fixes
 */
export async function createBackgroundTask(
  chatId: string,
  userId: string,
  taskDetails: AIResponse['taskDetails']
): Promise<BackgroundTask> {
  if (!taskDetails) {
    throw new Error('Task details required');
  }

  const task: BackgroundTask = {
    id: uuidv4(),
    chatId,
    userId,
    type: taskDetails.type,
    priority: taskDetails.priority,
    description: taskDetails.description,
    status: 'pending',
    createdAt: new Date()
  };

  // Store task
  backgroundTasks.set(task.id, task);

  // Also create a support ticket for tracking
  const chat = await SupportChat.findOne({ chatId });
  const ticket = new SupportTicket({
    userId,
    userName: chat?.userName || 'Unknown',
    userEmail: chat?.userEmail || 'unknown@email.com',
    subject: `[Auto] ${taskDetails.type.replace(/_/g, ' ').toUpperCase()}: ${taskDetails.description.slice(0, 50)}...`,
    description: `This ticket was automatically created by AI Support Agent.\n\nOriginal Issue:\n${taskDetails.description}\n\nChat ID: ${chatId}\nTask ID: ${task.id}`,
    category: mapTaskTypeToCategory(taskDetails.type),
    priority: taskDetails.priority,
    status: 'open',
    messages: [{
      id: uuidv4(),
      sender: 'system',
      senderId: 'system',
      senderName: 'AI Support Agent',
      content: `Automated ticket from live chat.\n\nTask Type: ${taskDetails.type}\nPriority: ${taskDetails.priority}\n\nDescription: ${taskDetails.description}`,
      createdAt: new Date()
    }],
    history: [{
      id: uuidv4(),
      action: 'created_by_ai',
      performedBy: 'ai-agent',
      performedByName: 'AI Support Agent',
      details: 'Ticket automatically created from live chat',
      createdAt: new Date()
    }],
    metadata: {
      createdByAI: true,
      originalChatId: chatId,
      backgroundTaskId: task.id
    }
  });

  await ticket.save();
  task.assignedTo = ticket._id?.toString();

  // Notify support agents about new task
  webSocketService.broadcastToRoom('support-agents', {
    type: 'new_background_task',
    task: {
      ...task,
      ticketNumber: ticket.ticketNumber
    }
  });

  logger.info(`[AI Support] Created background task ${task.id} for chat ${chatId}`);

  return task;
}

/**
 * Map task type to ticket category
 */
function mapTaskTypeToCategory(type: string): 'billing' | 'technical' | 'account' | 'general' {
  switch (type) {
    case 'billing_adjustment':
      return 'billing';
    case 'account_issue':
      return 'account';
    case 'bug_fix':
    case 'technical_support':
      return 'technical';
    default:
      return 'general';
  }
}

/**
 * Get background task status
 */
export function getBackgroundTask(taskId: string): BackgroundTask | undefined {
  return backgroundTasks.get(taskId);
}

/**
 * Update background task status
 */
export async function updateBackgroundTask(
  taskId: string,
  updates: Partial<BackgroundTask>
): Promise<BackgroundTask | null> {
  const task = backgroundTasks.get(taskId);
  if (!task) return null;

  Object.assign(task, updates);
  backgroundTasks.set(taskId, task);

  // If completed, notify the user in chat
  if (updates.status === 'completed' && task.chatId) {
    const chat = await SupportChat.findOne({ chatId: task.chatId });
    if (chat && chat.status !== 'ended') {
      chat.messages.push({
        id: uuidv4(),
        sender: 'system',
        senderId: 'system',
        senderName: 'System',
        content: `Great news! Your issue has been resolved. ${updates.result || 'The fix has been applied to your account.'}`,
        createdAt: new Date()
      });
      await chat.save();

      webSocketService.broadcastToRoom(`chat:${task.chatId}`, {
        type: 'task_completed',
        taskId,
        result: updates.result
      });
    }
  }

  return task;
}

/**
 * Get all pending tasks for agents
 */
export function getPendingTasks(): BackgroundTask[] {
  return Array.from(backgroundTasks.values())
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => {
      // Sort by priority then by creation date
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

/**
 * Check if AI should handle this chat or escalate immediately
 */
export function shouldAIHandle(userMessage: string): boolean {
  const escalationKeywords = [
    'speak to human',
    'talk to human',
    'real person',
    'human agent',
    'speak to someone',
    'talk to someone',
    'manager',
    'supervisor',
    'lawyer',
    'legal',
    'sue',
    'lawsuit'
  ];

  const lowerMessage = userMessage.toLowerCase();
  return !escalationKeywords.some(keyword => lowerMessage.includes(keyword));
}

export default {
  generateAIResponse,
  processAIResponse,
  createBackgroundTask,
  getBackgroundTask,
  updateBackgroundTask,
  getPendingTasks,
  shouldAIHandle
};




