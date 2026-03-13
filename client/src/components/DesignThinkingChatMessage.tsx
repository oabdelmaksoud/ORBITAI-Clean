import React from 'react';
import { ChatMessage } from '@orbitai/shared';
import { DesignStage, STAGES } from './DesignThinkingStageSelector';

interface ChatMessageProps {
  message: ChatMessage;
  currentStage: DesignStage;
}

const DesignThinkingChatMessage: React.FC<ChatMessageProps> = ({ message, currentStage }) => {
  const isUser = message.sender === 'user';
  const stageColor = STAGES[currentStage].color;

  // Simple markdown-like rendering for AI messages
  const renderText = (text: string) => {
    if (isUser) {
      return <p className="whitespace-pre-wrap">{text}</p>;
    }
    
    // Basic markdown rendering
    const lines = text.split('\n');
    return (
      <div>
        {lines.map((line, idx) => {
          // Bold text
          if (line.includes('**')) {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
              <p key={idx} className="mb-2">
                {parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={pIdx} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                  }
                  return <span key={pIdx}>{part}</span>;
                })}
              </p>
            );
          }
          
          // Bullet points
          if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
            return (
              <ul key={idx} className="list-disc pl-4 my-2">
                <li className="mb-1">{line.trim().substring(1).trim()}</li>
              </ul>
            );
          }
          
          // Regular paragraph
          if (line.trim()) {
            return <p key={idx} className="mb-2">{line}</p>;
          }
          
          return <br key={idx} />;
        })}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed
          ${isUser 
            ? 'bg-gray-800 text-white rounded-br-none' 
            : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}
        `}
      >
        {!isUser && (
            <div className={`mb-2 text-xs font-bold uppercase tracking-wide opacity-50`}>
               AI Partner
            </div>
        )}
        
        <div className="prose prose-sm max-w-none">
          {renderText(message.text)}
        </div>
      </div>
    </div>
  );
};

export default DesignThinkingChatMessage;



