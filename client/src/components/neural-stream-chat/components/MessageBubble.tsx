/**
 * MessageBubble - Reusable chat message component
 * Extracted from NeuralStreamChat for maintainability
 */

import React, { useMemo } from 'react';
import { ChatMessage } from '@orbitai/shared';
import { User, Bot, Sparkles } from 'lucide-react';

export interface MessageBubbleProps {
    message: ChatMessage;
    isLast?: boolean;
    showAvatar?: boolean;
    className?: string;
}

// Helper to render markdown-like formatting
const formatMessageText = (text: string): React.ReactNode => {
    // Simple markdown-like formatting
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
        // Handle code blocks (simplified)
        if (line.trim().startsWith('```')) {
            return null; // Skip code fence markers
        }

        // Handle bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            return (
                <li key={lineIndex} className="ml-4 list-disc">
                    {line.replace(/^[\s-*]+/, '')}
                </li>
            );
        }

        // Handle numbered lists
        const numberedMatch = line.match(/^\d+\.\s+(.+)/);
        if (numberedMatch) {
            return (
                <li key={lineIndex} className="ml-4 list-decimal">
                    {numberedMatch[1]}
                </li>
            );
        }

        // Handle headers
        if (line.startsWith('### ')) {
            return (
                <h3 key={lineIndex} className="font-semibold text-lg mt-3 mb-1">
                    {line.replace('### ', '')}
                </h3>
            );
        }
        if (line.startsWith('## ')) {
            return (
                <h2 key={lineIndex} className="font-bold text-xl mt-4 mb-2">
                    {line.replace('## ', '')}
                </h2>
            );
        }

        // Handle bold and italic inline
        let formattedLine: React.ReactNode = line;

        // Bold: **text** or __text__
        if (line.includes('**') || line.includes('__')) {
            const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
            formattedLine = parts.map((part, i) => {
                if (part.startsWith('**') || part.startsWith('__')) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                return part;
            });
        }

        // Empty lines become spacing
        if (!line.trim()) {
            return <div key={lineIndex} className="h-2" />;
        }

        return (
            <p key={lineIndex} className="leading-relaxed">
                {formattedLine}
            </p>
        );
    });
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isLast = false,
    showAvatar = true,
    className = '',
}) => {
    const isUser = message.sender === 'user';
    const isAssistant = message.sender === 'agent' || message.sender === 'system';

    const formattedContent = useMemo(() => {
        if (typeof message.text === 'string') {
            return formatMessageText(message.text);
        }
        return message.text;
    }, [message.text]);

    // Avatar component
    const Avatar = useMemo(() => {
        if (!showAvatar) return null;

        if (isUser) {
            return (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                </div>
            );
        }

        return (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
            </div>
        );
    }, [isUser, showAvatar]);

    return (
        <div
            className={`
        flex gap-3 p-4 rounded-xl transition-all duration-200
        ${isUser
                    ? 'bg-white/5 ml-12'
                    : 'bg-gradient-to-r from-cyan-900/20 to-blue-900/20 mr-12 border border-cyan-500/10'
                }
        ${isLast && !isUser ? 'animate-fadeIn' : ''}
        ${className}
      `}
        >
            {/* Avatar - only show for assistant on left, user on right */}
            {!isUser && Avatar}

            {/* Message content */}
            <div className="flex-1 min-w-0">
                {/* Role label */}
                <div className={`flex items-center gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
                    <span className={`
            text-xs font-medium uppercase tracking-wider
            ${isUser ? 'text-purple-400' : 'text-cyan-400'}
          `}>
                        {isUser ? 'You' : (message.sender === 'agent' ? 'Agent' : 'OrbitAI')}
                    </span>
                    {!isUser && isLast && (
                        <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                    )}
                </div>

                {/* Message text */}
                <div className={`
          text-sm text-gray-200 
          ${isUser ? 'text-right' : 'text-left'}
        `}>
                    {formattedContent}
                </div>

                {/* Timestamp if available */}
                {message.timestamp && (
                    <div className={`mt-2 text-xs text-gray-500 ${isUser ? 'text-right' : ''}`}>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </div>
                )}
            </div>

            {/* User avatar on the right */}
            {isUser && Avatar}
        </div>
    );
};

export default MessageBubble;
