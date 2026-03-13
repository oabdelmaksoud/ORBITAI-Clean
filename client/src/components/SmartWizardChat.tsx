import React, { useState, useEffect, useRef } from 'react';
import { Send, SkipForward, Sparkles, Bot, User, CheckCircle2, Loader2 } from 'lucide-react';
import { PROJECT_DISCOVERY_FLOW, getNextQuestion, hasEnoughInformation, generateSummary, ChatQuestion } from '@src/config/chatFlows';
import { ChatMessage } from '@orbitai/shared';
import { chatApi } from '@src/services/chatApi';

interface SmartWizardChatProps {
  onComplete: (summary: string, answers: Record<string, any>) => void;
  onSkip: () => void;
  initialMessages?: ChatMessage[];
  projectId?: string;
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
  onFreeChat?: () => void; // Allow switching to free chat
}

// Human-like responses based on context
const getContextualResponse = (question: ChatQuestion, answers: Record<string, any>): string => {
  const responses: Record<string, string[]> = {
    'project-type': [
      "Great! Let's start with understanding what you're building. 🚀",
      "Perfect! I'd love to help you bring your idea to life. What kind of project are we working on?",
      "Exciting! Let's begin by understanding your vision. What type of project is this?"
    ],
    'target-audience': [
      "Wonderful! Now, who are you building this for? Understanding your audience helps me tailor the solution perfectly. 👥",
      "Nice choice! Who will be using this? Knowing your users helps me make better recommendations.",
      "Got it! Now tell me about your users - who is this for?"
    ],
    'main-features': [
      "Excellent! What features are most important to you? Think about what would make your users say 'wow!' ✨",
      "Perfect! What are the key things your project needs to do? List them out and we'll make sure they're all covered.",
      "Great! What features matter most? Don't worry about being too detailed - we can refine later."
    ],
    'tech-preferences': [
      "Awesome! Do you have any preferences for technologies or frameworks? If not, I can suggest the best options. 💻",
      "Good progress! Any tech stack preferences? Or should I recommend the best tools for your project?",
      "Nice! Any favorite technologies? If you're not sure, I'll pick the perfect stack for you."
    ],
    'timeline': [
      "Almost there! When do you need this completed? This helps me plan everything perfectly. ⏰",
      "Great! What's your timeline? Understanding your schedule helps me prioritize features.",
      "Perfect! When do you need this done? No pressure - just helps me plan better."
    ],
    'budget': [
      "Excellent! What's your budget range? This helps me suggest the most cost-effective solutions. 💰",
      "Good to know! What budget are we working with? I'll make sure we get the best value.",
      "Perfect! Budget helps me tailor recommendations. What range are we looking at?"
    ],
    'additional-requirements': [
      "Last one! Any special requirements or constraints I should know about? 🔍",
      "Almost done! Anything else important? Accessibility, performance, security - let me know!",
      "Final question! Any other requirements? This helps me make sure nothing is missed."
    ]
  };

  const options = responses[question.id] || [
    "Tell me more about that!",
    "That's helpful! Can you elaborate?",
    "Interesting! Let's dive deeper."
  ];

  return options[Math.floor(Math.random() * options.length)];
};

// Generate follow-up questions based on answers
const generateFollowUp = (questionId: string, answer: string, answers: Record<string, any>): string | null => {
  if (!answer || answer.trim().length < 10) {
    return null; // Answer too short for follow-up
  }

  const followUps: Record<string, (answer: string) => string> = {
    'project-type': (ans) => {
      if (ans.toLowerCase().includes('web')) {
        return "Are you thinking of a single-page app or something more traditional?";
      }
      if (ans.toLowerCase().includes('mobile')) {
        return "iOS, Android, or both?";
      }
      return null;
    },
    'main-features': (ans) => {
      const features = ans.split(',').length;
      if (features > 5) {
        return "That's quite a list! Which 2-3 features are absolutely essential for launch?";
      }
      return null;
    },
    'target-audience': (ans) => {
      if (ans.toLowerCase().includes('business') || ans.toLowerCase().includes('enterprise')) {
        return "Will this need enterprise-level security and scalability?";
      }
      return null;
    }
  };

  const followUp = followUps[questionId];
  return followUp ? followUp(answer) : null;
};

const SmartWizardChat: React.FC<SmartWizardChatProps> = ({ 
  onComplete, 
  onSkip,
  initialMessages = [],
  projectId,
  conversationId,
  onConversationCreated,
  onFreeChat
}) => {
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentAnswer, setCurrentAnswer] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationIdState, setConversationIdState] = useState<string | undefined>(conversationId);
  const [isThinking, setIsThinking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Initialize conversation and first question
  useEffect(() => {
    const initializeConversation = async () => {
      if (!conversationIdState) {
        try {
          const welcomeMessage: ChatMessage = {
            id: 'welcome',
            sender: 'system',
            text: `👋 Hi there! I'm your AI project assistant, and I'm excited to help you bring your idea to life! 

I'll have a conversation with you to really understand what you want to build. I'll ask questions, listen to your answers, and dig deeper into the details that matter. Think of me as your brainstorming partner who's here to help you think through every aspect of your project.

Feel free to share as much or as little as you'd like - I'll adapt to your style! Let's start by you telling me about your project idea. What are you looking to build? 🚀`,
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
        }
      }

      // Initialize first question with a delay for better UX
      // Start with AI-driven conversation instead of structured questions
      if (!currentQuestionId && PROJECT_DISCOVERY_FLOW.questions.length > 0 && messages.length <= 1) {
        setTimeout(async () => {
          // Use LLM to start the conversation naturally
          try {
            const { apiRequest } = await import('@src/services/api');
            const response = await apiRequest<{
              success: boolean;
              response: string;
            }>('/api/llm/chat', {
              method: 'POST',
              body: JSON.stringify({
                message: "Hi! I'd like to start a new project. Can you help me describe it?",
                history: [],
                projectState: projectId ? { id: projectId } : null,
                contextType: 'wizard'
              })
            });

            if (response.success && response.response) {
              const aiMessage: ChatMessage = {
                id: `ai-start-${Date.now()}`,
                sender: 'system',
                text: response.response,
                timestamp: Date.now()
              };
              setMessages(prev => [...prev, aiMessage]);
            } else {
              // Fallback to structured first question
              const firstQuestion = PROJECT_DISCOVERY_FLOW.questions[0];
              setCurrentQuestionId(firstQuestion.id);
              addQuestionMessage(firstQuestion);
            }
          } catch (error) {
            console.error('Failed to start AI conversation:', error);
            // Fallback to structured first question
            const firstQuestion = PROJECT_DISCOVERY_FLOW.questions[0];
            setCurrentQuestionId(firstQuestion.id);
            addQuestionMessage(firstQuestion);
          }
        }, 1500);
      }
    };

    initializeConversation();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input when question changes
  useEffect(() => {
    if (currentQuestionId && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [currentQuestionId]);

  const addQuestionMessage = (question: ChatQuestion) => {
    const contextualResponse = getContextualResponse(question, answers);
    const questionText = `${contextualResponse}\n\n**${question.question}**${question.placeholder ? `\n\n💡 ${question.placeholder}` : ''}`;
    
    setMessages(prev => {
      const recentQuestion = prev.find(
        msg => msg.id.startsWith(`question-${question.id}`) && 
        Date.now() - msg.timestamp < 1000
      );
      if (recentQuestion) return prev;
      
      return [...prev, {
        id: `question-${question.id}-${Date.now()}`,
        sender: 'system',
        text: questionText,
        timestamp: Date.now()
      }];
    });
  };

  const handleAnswer = async () => {
    if (!currentAnswer.trim()) return;

    setIsThinking(true);

    // Add user's answer as a message
    const answerMessage: ChatMessage = {
      id: `answer-${Date.now()}`,
      sender: 'user',
      text: currentAnswer.trim(),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, answerMessage]);

    // Save answer if we're in structured question mode
    let newAnswers = { ...answers };
    if (currentQuestionId) {
      const question = PROJECT_DISCOVERY_FLOW.questions.find(q => q.id === currentQuestionId);
      if (question) {
        newAnswers = { ...answers, [currentQuestionId]: currentAnswer.trim() };
        setAnswers(newAnswers);
      }
    }

    // Persist to backend
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

    // Use LLM to generate intelligent follow-up questions and engage in conversation
    try {
      const { apiRequest } = await import('@src/services/api');
      
      // Build conversation history for LLM
      const history = messages
        .filter(msg => msg.sender !== 'system' || !msg.id.startsWith('question-'))
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Add current user message
      history.push({
        role: 'user',
        content: currentAnswer.trim()
      });

      // Call LLM chat API with wizard context
      const response = await apiRequest<{
        success: boolean;
        response: string;
        usage?: any;
        modelUsed?: string;
        provider?: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: currentAnswer.trim(),
          history: history.slice(-10), // Last 10 messages for context
          projectState: projectId ? { id: projectId } : null,
          contextType: 'wizard'
        })
      });

      if (response.success && response.response) {
        const aiResponse: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'system',
          text: response.response,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiResponse]);

        // Only check for completion if we have had a meaningful conversation (at least 4 exchanges)
        const messageCount = messages.filter(m => m.sender === 'user').length + 1; // +1 for current message
        const shouldCheckCompletion = messageCount >= 4; // Require at least 4 user messages
        
        if (shouldCheckCompletion) {
          // Check if AI explicitly indicates it has enough information
          const responseText = response.response.toLowerCase();
          // More strict detection - look for explicit completion phrases
          const explicitCompletionPhrases = [
            'i have enough information to generate',
            'i can now generate your project',
            'ready to create your project preview',
            'i have everything i need to get started',
            'perfect! i have enough information',
            'i\'m ready to generate your project'
          ];
          
          const hasEnoughInfo = explicitCompletionPhrases.some(phrase => responseText.includes(phrase));
          
          if (hasEnoughInfo) {
            // AI explicitly says we have enough info - show summary and ask for confirmation
            setTimeout(() => {
              // Extract project details from conversation for summary
              const conversationSummary = messages
                .filter(m => m.sender === 'user')
                .map(m => m.text)
                .join('\n');
              
              const generatedSummary = conversationSummary || generateSummary(newAnswers);
              setSummary(generatedSummary);
              
              const completeMessage: ChatMessage = {
                id: 'complete',
                sender: 'system',
                text: `Great! Based on our conversation, I have a good understanding of your project. 

**Summary of what we discussed:**
\`\`\`
${generatedSummary}
\`\`\`

Would you like me to generate your project preview now, or would you like to tell me more about your project?`,
                timestamp: Date.now()
              };
              setMessages(prev => [...prev, completeMessage]);
              
              // Don't auto-complete - let user decide
              // User can click "Proceed" button or continue chatting
            }, 500);
          } else {
            // AI wants to continue conversation - clear input and wait for next response
            setCurrentAnswer('');
            setCurrentQuestionId(null); // Exit structured question mode, enter free conversation
          }
        } else {
          // Too early in conversation - always continue
          setCurrentAnswer('');
          setCurrentQuestionId(null);
        }
      }
    } catch (error) {
      console.error('Failed to get AI response:', error);
      // Fallback to structured flow if LLM fails
      if (currentQuestionId) {
        const followUp = generateFollowUp(currentQuestionId, currentAnswer.trim(), newAnswers);
        if (followUp) {
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: `followup-${Date.now()}`,
              sender: 'system',
              text: `🤔 ${followUp}`,
              timestamp: Date.now()
            }]);
          }, 800);
        }
        setTimeout(() => {
          moveToNextQuestion(newAnswers);
        }, followUp ? 2000 : 1000);
      }
    } finally {
      setIsThinking(false);
      setCurrentAnswer('');
    }
  };

  const handleSkip = async () => {
    if (!currentQuestionId) return;

    const question = PROJECT_DISCOVERY_FLOW.questions.find(q => q.id === currentQuestionId);
    if (!question || !question.skipable) return;

    // Mark as skipped
    const newAnswers = { ...answers, [currentQuestionId]: null };
    setAnswers(newAnswers);

    // Add skip message with friendly tone
    const skipMessage: ChatMessage = {
      id: `skip-${currentQuestionId}-${Date.now()}`,
      sender: 'user',
      text: '⏭️ Skip',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, skipMessage]);

    // Add friendly response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `skip-response-${Date.now()}`,
        sender: 'system',
        text: "No problem! Let's move on. 😊",
        timestamp: Date.now()
      }]);
    }, 500);

    // Persist to backend
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
    setTimeout(() => {
      moveToNextQuestion(newAnswers);
    }, 1000);
  };

  const moveToNextQuestion = async (currentAnswers: Record<string, any>) => {
    const nextQuestion = getNextQuestion(PROJECT_DISCOVERY_FLOW, currentQuestionId, currentAnswers);
    
    if (!nextQuestion) {
      // Flow complete - check if we have enough info
      if (hasEnoughInformation(PROJECT_DISCOVERY_FLOW, currentAnswers)) {
        const generatedSummary = generateSummary(currentAnswers);
        setSummary(generatedSummary);
        
        const completeMessage: ChatMessage = {
          id: 'complete',
          sender: 'system',
          text: `🎉 **Excellent! I have enough information to help you get started.**

Let me summarize what we've discussed:`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, completeMessage]);

        // Show summary
        setTimeout(() => {
          setShowSummary(true);
          setMessages(prev => [...prev, {
            id: 'summary',
            sender: 'system',
            text: `\`\`\`\n${generatedSummary}\n\`\`\`\n\n✨ **Ready to proceed?** I'll generate your project preview based on this information.`,
            timestamp: Date.now()
          }]);
        }, 1000);

        // Persist completion
        if (conversationIdState) {
          try {
            await chatApi.updateAnswers(conversationIdState, {
              answers: currentAnswers,
              summary: generatedSummary,
              metadata: { completed: true, flowId: PROJECT_DISCOVERY_FLOW.id }
            });
          } catch (error) {
            console.error('Failed to persist completion:', error);
          }
        }

        // Auto-complete after showing summary
        setTimeout(() => {
          onComplete(generatedSummary, currentAnswers);
        }, 3000);
      } else {
        // Not enough info - offer to proceed anyway
        setMessages(prev => [...prev, {
          id: 'insufficient-info',
          sender: 'system',
          text: `🤔 I have some information, but it would be helpful to know more. 

Would you like to:
- **Continue** answering a few more questions (recommended)
- **Proceed anyway** with what we have
- **Switch to free chat** for a more casual conversation`,
          timestamp: Date.now()
        }]);
      }
      return;
    }

    // Move to next question with animation
    setCurrentQuestionId(nextQuestion.id);
    setTimeout(() => {
      addQuestionMessage(nextQuestion);
    }, 500);
  };

  const handleProceedAnyway = () => {
    // Generate summary from conversation
    const conversationSummary = messages
      .filter(m => m.sender === 'user')
      .map(m => m.text)
      .join('\n\n');
    
    const generatedSummary = conversationSummary || generateSummary(answers);
    
    // Show confirmation message
    const confirmMessage: ChatMessage = {
      id: 'proceed-confirm',
      sender: 'system',
      text: `Perfect! Let me generate your project preview based on our conversation. This will take a moment... 🚀`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, confirmMessage]);
    
    // Complete after short delay
    setTimeout(() => {
      onComplete(generatedSummary, answers);
    }, 1500);
  };

  const currentQuestion = currentQuestionId 
    ? PROJECT_DISCOVERY_FLOW.questions.find(q => q.id === currentQuestionId)
    : null;

  const canProceed = hasEnoughInformation(PROJECT_DISCOVERY_FLOW, answers);
  const isComplete = !currentQuestionId && canProceed;
  const progress = currentQuestionId 
    ? ((PROJECT_DISCOVERY_FLOW.questions.findIndex(q => q.id === currentQuestionId) + 1) / PROJECT_DISCOVERY_FLOW.questions.length) * 100
    : 0;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-white to-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Smart Project Discovery</h2>
            <p className="text-xs text-slate-500">Let's build something amazing together</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentQuestion && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <span className="text-xs font-medium text-slate-600">
                {PROJECT_DISCOVERY_FLOW.questions.findIndex(q => q.id === currentQuestionId) + 1} / {PROJECT_DISCOVERY_FLOW.questions.length}
              </span>
            </div>
          )}
          {onFreeChat && (
            <button
              onClick={onFreeChat}
              className="text-xs text-slate-500 hover:text-primary transition-colors px-2 py-1 rounded hover:bg-slate-100"
              title="Switch to free chat"
            >
              Free Chat
            </button>
          )}
          <button
            onClick={onSkip}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Skip wizard"
          >
            <SkipForward className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {currentQuestion && (
        <div className="px-4 py-2 bg-white/50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 min-w-[40px] text-right">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((message, index) => (
          <div
            key={`${message.id}-${index}`}
            className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Avatar */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.sender === 'user'
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-md'
                : 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-md'
            }`}>
              {message.sender === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex gap-3 animate-in fade-in">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Always show for free conversation */}
      {!isComplete && (
        <div className="border-t border-slate-200 p-4 space-y-3 shrink-0 bg-white/80 backdrop-blur-sm">
          <textarea
            ref={inputRef as any}
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder={currentQuestion ? currentQuestion.placeholder : "Tell me more about your project idea... I'm here to help you bring it to life! 🚀"}
            rows={3}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none bg-white text-slate-800 font-medium placeholder-slate-400 transition-all"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAnswer();
              }
            }}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleAnswer}
              disabled={!currentAnswer.trim() || isThinking}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg disabled:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isThinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
            {currentQuestion && currentQuestion.skipable && (
              <button
                onClick={handleSkip}
                disabled={isThinking}
                className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Skip this question"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            )}
          </div>
          
          {/* Show proceed button if we have at least 2 exchanges */}
          {messages.filter(m => m.sender === 'user').length >= 2 && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={handleProceedAnyway}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-medium text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                I'm Ready - Generate Project Preview
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary View */}
      {showSummary && summary && (
        <div className="border-t border-slate-200 p-4 shrink-0 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-slate-800">Summary Ready</span>
          </div>
          <p className="text-xs text-slate-600">Generating your project preview...</p>
        </div>
      )}
    </div>
  );
};

export default SmartWizardChat;




