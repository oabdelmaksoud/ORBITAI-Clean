import React, { useState, useEffect, useRef } from 'react';
import { Send, SkipForward, X, CheckCircle2 } from 'lucide-react';
import { PROJECT_DISCOVERY_FLOW, getNextQuestion, hasEnoughInformation, generateSummary, ChatQuestion } from '@src/config/chatFlows';
import { ChatMessage } from '@orbitai/shared';
import { chatApi } from '@src/services/chatApi';

interface GuidedChatWizardProps {
  onComplete: (summary: string, answers: Record<string, any>) => void;
  onSkip: () => void;
  initialMessages?: ChatMessage[];
  projectId?: string;
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

const GuidedChatWizard: React.FC<GuidedChatWizardProps> = ({ 
  onComplete, 
  onSkip,
  initialMessages = [],
  projectId,
  conversationId,
  onConversationCreated
}) => {
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [showSkipOption, setShowSkipOption] = useState(true);
  const [conversationIdState, setConversationIdState] = useState<string | undefined>(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize conversation and first question
  useEffect(() => {
    const initializeConversation = async () => {
      // Create conversation if not provided
      if (!conversationIdState) {
        try {
          const welcomeMessage: ChatMessage = {
            id: 'welcome',
            sender: 'system',
            text: `Hello! I'm here to help you describe your project idea. I'll ask you a few questions to understand what you want to build. You can skip any question if you prefer.`,
            timestamp: Date.now()
          };

          const conversation = await chatApi.createConversation({
            projectId,
            type: 'setup',
            initialMessage: initialMessages.length === 0 ? welcomeMessage : undefined
          });

          const id = conversation._id || conversation.id;
          if (id) {
            setConversationIdState(id);
            if (onConversationCreated) {
              onConversationCreated(id);
            }
          }

          if (initialMessages.length === 0) {
            setMessages([welcomeMessage]);
          }
        } catch (error) {
          console.error('Failed to create conversation:', error);
          // Continue without persistence if API fails
        }
      }

      // Initialize first question
      if (!currentQuestionId && PROJECT_DISCOVERY_FLOW.questions.length > 0) {
        const firstQuestion = PROJECT_DISCOVERY_FLOW.questions[0];
        setCurrentQuestionId(firstQuestion.id);
        
        setTimeout(() => {
          addQuestionMessage(firstQuestion);
        }, 500);
      }
    };

    initializeConversation();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addQuestionMessage = (question: ChatQuestion) => {
    const questionText = `${question.question}${question.placeholder ? `\n\n(${question.placeholder})` : ''}`;
    setMessages(prev => {
      // Check if this question was already added recently (within last second)
      const recentQuestion = prev.find(
        msg => msg.id.startsWith(`question-${question.id}`) && 
        Date.now() - msg.timestamp < 1000
      );
      if (recentQuestion) return prev; // Don't add duplicate
      
      return [...prev, {
        id: `question-${question.id}-${Date.now()}`,
        sender: 'system',
        text: questionText,
        timestamp: Date.now()
      }];
    });
  };

  const handleAnswer = async () => {
    if (!currentQuestionId || !currentAnswer.trim()) return;

    const question = PROJECT_DISCOVERY_FLOW.questions.find(q => q.id === currentQuestionId);
    if (!question) return;

    // Save answer
    const newAnswers = { ...answers, [currentQuestionId]: currentAnswer.trim() };
    setAnswers(newAnswers);

    // Add user's answer as a message
    const answerMessage: ChatMessage = {
      id: `answer-${currentQuestionId}-${Date.now()}`,
      sender: 'user',
      text: currentAnswer.trim(),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, answerMessage]);

    // Persist to backend if conversation exists
    if (conversationIdState) {
      try {
        await chatApi.addMessage(conversationIdState, {
          message: answerMessage,
          answers: newAnswers
        });
      } catch (error) {
        console.error('Failed to persist message:', error);
      }
    }

    // Clear input
    setCurrentAnswer('');

    // Move to next question or complete
    moveToNextQuestion(newAnswers);
  };

  const handleSkip = async () => {
    if (!currentQuestionId) return;

    const question = PROJECT_DISCOVERY_FLOW.questions.find(q => q.id === currentQuestionId);
    if (!question || !question.skipable) return;

    // Mark as skipped
    const newAnswers = { ...answers, [currentQuestionId]: null };
    setAnswers(newAnswers);

    // Add skip message
    const skipMessage: ChatMessage = {
      id: `skip-${currentQuestionId}-${Date.now()}`,
      sender: 'user',
      text: '[Skipped]',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, skipMessage]);

    // Persist to backend if conversation exists
    if (conversationIdState) {
      try {
        await chatApi.addMessage(conversationIdState, {
          message: skipMessage,
          answers: newAnswers
        });
      } catch (error) {
        console.error('Failed to persist skip message:', error);
      }
    }

    // Move to next question
    moveToNextQuestion(newAnswers).catch(console.error);
  };

  const moveToNextQuestion = async (currentAnswers: Record<string, any>) => {
    const nextQuestion = getNextQuestion(PROJECT_DISCOVERY_FLOW, currentQuestionId, currentAnswers);
    
    if (!nextQuestion) {
      // Flow complete - check if we have enough info
      // Require at least 3 answered questions before allowing completion
      const answeredCount = Object.keys(currentAnswers).filter(key => {
        const value = currentAnswers[key];
        return value !== null && value !== undefined && value !== '';
      }).length;
      
      if (answeredCount >= 3 && hasEnoughInformation(PROJECT_DISCOVERY_FLOW, currentAnswers)) {
        const summary = generateSummary(currentAnswers);
        const completeMessage: ChatMessage = {
          id: 'complete',
          sender: 'system',
          text: `Great! I have enough information to help you get started. 

**Summary of what we discussed:**
\`\`\`
${summary}
\`\`\`

Would you like me to generate your project preview now, or would you like to tell me more about your project?`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, completeMessage]);

        // Persist completion to backend
        if (conversationIdState) {
          try {
            await chatApi.updateAnswers(conversationIdState, {
              answers: currentAnswers,
              summary,
              metadata: { completed: true, flowId: PROJECT_DISCOVERY_FLOW.id }
            });
          } catch (error) {
            console.error('Failed to persist completion:', error);
          }
        }

        // Don't auto-complete - wait for user to click "Proceed" button
        // User can continue chatting or proceed when ready
      } else {
        // Not enough info - ask if they want to proceed anyway
        setMessages(prev => [...prev, {
          id: 'insufficient-info',
          sender: 'system',
          text: `I have some information (${answeredCount} questions answered), but it would be helpful to know more. 

Would you like to:
- **Continue** answering a few more questions (recommended)
- **Proceed anyway** with what we have
- **Tell me more** about your project`,
          timestamp: Date.now()
        }]);
        // Don't auto-proceed - let user decide
      }
      return;
    }

    // Move to next question
    setCurrentQuestionId(nextQuestion.id);
    setTimeout(() => {
      addQuestionMessage(nextQuestion);
    }, 300);
  };

  const handleProceedAnyway = () => {
    const summary = generateSummary(answers);
    onComplete(summary, answers);
  };

  const currentQuestion = currentQuestionId 
    ? PROJECT_DISCOVERY_FLOW.questions.find(q => q.id === currentQuestionId)
    : null;

  const canProceed = hasEnoughInformation(PROJECT_DISCOVERY_FLOW, answers);
  const isComplete = !currentQuestionId && canProceed;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Project Discovery</h2>
          <p className="text-xs text-slate-500">Answer a few questions to get started</p>
        </div>
        <div className="flex items-center gap-2">
          {currentQuestion && (
            <span className="text-xs text-slate-500">
              {PROJECT_DISCOVERY_FLOW.questions.findIndex(q => q.id === currentQuestionId) + 1} / {PROJECT_DISCOVERY_FLOW.questions.length}
            </span>
          )}
          <button
            onClick={onSkip}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Skip wizard"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Proceed Button - Show when flow is complete or user has answered enough questions */}
      {(!currentQuestion || (canProceed && Object.keys(answers).filter(k => answers[k]).length >= 2)) && (
        <div className="border-t border-slate-200 p-4 shrink-0 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Ready to proceed?</p>
              <p className="text-xs text-slate-600">You can continue answering questions or generate your project preview now.</p>
            </div>
            <button
              onClick={handleProceedAnyway}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-medium shadow-md hover:shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              Generate Preview
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      {!isComplete && currentQuestion && (
        <div className="border-t border-slate-200 p-4 space-y-3 shrink-0">
          {currentQuestion.type === 'select' && currentQuestion.options ? (
            <select
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an option...</option>
              {currentQuestion.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : currentQuestion.type === 'textarea' ? (
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder={currentQuestion.placeholder}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleAnswer();
                }
              }}
            />
          ) : (
            <input
              type="text"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder={currentQuestion.placeholder}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAnswer();
                }
              }}
            />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleAnswer}
              disabled={!currentAnswer.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Send className="w-4 h-4" />
              Continue
            </button>
            {currentQuestion.skipable && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                title="Skip this question"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {currentQuestion && (
        <div className="border-t border-slate-200 p-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${((PROJECT_DISCOVERY_FLOW.questions.findIndex(q => q.id === currentQuestionId) + 1) / PROJECT_DISCOVERY_FLOW.questions.length) * 100}%`
                }}
              />
            </div>
            <span className="text-xs text-slate-500">
              {Math.round(((PROJECT_DISCOVERY_FLOW.questions.findIndex(q => q.id === currentQuestionId) + 1) / PROJECT_DISCOVERY_FLOW.questions.length) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidedChatWizard;

