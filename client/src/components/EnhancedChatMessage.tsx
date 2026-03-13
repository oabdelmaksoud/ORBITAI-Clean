import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessage } from '@orbitai/shared';
import { Copy, Check, ChevronDown, ChevronUp, Bookmark, BookmarkCheck, Clock, Brain } from 'lucide-react';

interface EnhancedChatMessageProps {
    message: ChatMessage;
    onCopy?: (text: string) => void;
    onBookmark?: (messageId: string, isBookmarked: boolean) => void;
    isBookmarked?: boolean;
    showTimestamp?: boolean;
}

// Format relative time
const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return new Date(timestamp).toLocaleDateString();
};

// Detect and extract thinking sections from message text
const extractThinkingSections = (text: string): { thinking: string[]; mainContent: string } => {
    const thinkingPatterns = [
        /(?:^|\n)\s*(?:🤔|💭|🧠)?\s*(?:Thinking|Analyzing|Processing|Considering|Evaluating|Reasoning)[:\s].*?(?=\n\n|\n[A-Z]|$)/gis,
        /(?:^|\n)\s*\*\*(?:Thinking|Analysis|Processing)\*\*[:\s].*?(?=\n\n|\n[A-Z]|$)/gis,
        /(?:^|\n)\s*>\s*(?:💭|🤔).*?(?=\n[^>]|$)/gis,
    ];

    const thinkingParts: string[] = [];
    let mainContent = text;

    for (const pattern of thinkingPatterns) {
        const matches = text.match(pattern);
        if (matches) {
            thinkingParts.push(...matches.map(m => m.trim()));
            mainContent = mainContent.replace(pattern, '').trim();
        }
    }

    // Clean up multiple newlines
    mainContent = mainContent.replace(/\n{3,}/g, '\n\n').trim();

    return { thinking: thinkingParts, mainContent };
};

const EnhancedChatMessage: React.FC<EnhancedChatMessageProps> = ({
    message,
    onCopy,
    onBookmark,
    isBookmarked = false,
    showTimestamp = true
}) => {
    const [copied, setCopied] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [showThinking, setShowThinking] = useState(false);

    const isUser = message.sender === 'user';
    const isSystem = message.sender === 'system';
    const isThinkingMessage = !isUser && (message.text === '🤔 Thinking...' || message.text.startsWith('🤔 Thinking'));

    // Extract thinking sections (memoized) - skip for thinking placeholder
    const { thinking, mainContent } = useMemo(() =>
        isUser || isThinkingMessage ? { thinking: [], mainContent: message.text } : extractThinkingSections(message.text),
        [message.text, isUser, isThinkingMessage]
    );

    // Handle copy action
    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(message.text);
        setCopied(true);
        onCopy?.(message.text);
        setTimeout(() => setCopied(false), 2000);
    }, [message.text, onCopy]);

    // Handle bookmark toggle
    const handleBookmark = useCallback(() => {
        onBookmark?.(message.id, !isBookmarked);
    }, [message.id, isBookmarked, onBookmark]);

    // Toggle expandable section
    const toggleSection = useCallback((id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Custom renderers for markdown
    const markdownComponents = useMemo(() => ({
        // Code blocks with syntax highlighting
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';

            // Fix: Properly extract text from children (handles React elements and arrays)
            const extractText = (c: any): string => {
                if (typeof c === 'string') return c;
                if (Array.isArray(c)) return c.map(extractText).join('');
                if (c?.props?.children) return extractText(c.props.children);
                return '';
            };
            const codeString = extractText(children).replace(/\n$/, '');

            if (!inline && codeString.length > 0) {
                const codeId = `code-${message.id}-${codeString.slice(0, 20)}`;
                const isExpanded = expandedSections.has(codeId) || codeString.split('\n').length <= 10;

                return (
                    <div className="relative group my-3 rounded-lg overflow-hidden">
                        {/* Language badge + copy button */}
                        <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 text-xs">
                            <span className="text-slate-400 font-medium uppercase tracking-wider">
                                {language}
                            </span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(codeString);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copied ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>

                        {/* Code content */}
                        <div className={`transition-all duration-300 ${!isExpanded ? 'max-h-48 overflow-hidden' : ''}`}>
                            <SyntaxHighlighter
                                style={atomDark}
                                language={language}
                                PreTag="div"
                                customStyle={{
                                    margin: 0,
                                    borderRadius: 0,
                                    fontSize: '13px',
                                    lineHeight: '1.5',
                                }}
                                {...props}
                            >
                                {codeString}
                            </SyntaxHighlighter>
                        </div>

                        {/* Expand/collapse for long code */}
                        {codeString.split('\n').length > 10 && (
                            <button
                                onClick={() => toggleSection(codeId)}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs py-1.5 flex items-center justify-center gap-1 transition-colors"
                            >
                                {isExpanded ? (
                                    <>
                                        <ChevronUp size={14} /> Show less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={14} /> Show more ({codeString.split('\n').length} lines)
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                );
            }

            // Inline code
            return (
                <code
                    className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 rounded text-sm font-mono"
                    {...props}
                >
                    {children}
                </code>
            );
        },

        // Headers with styling
        h1: ({ children }: any) => (
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2 first:mt-0">
                {children}
            </h1>
        ),
        h2: ({ children }: any) => (
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-3 mb-2 first:mt-0">
                {children}
            </h2>
        ),
        h3: ({ children }: any) => (
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mt-2 mb-1 first:mt-0">
                {children}
            </h3>
        ),

        // Blockquotes
        blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-2 text-slate-600 dark:text-slate-300 italic bg-indigo-50/50 dark:bg-indigo-900/20 rounded-r">
                {children}
            </blockquote>
        ),

        // Lists
        ul: ({ children }: any) => (
            <ul className="list-disc list-inside my-2 space-y-1 text-slate-700 dark:text-slate-300">
                {children}
            </ul>
        ),
        ol: ({ children }: any) => (
            <ol className="list-decimal list-inside my-2 space-y-1 text-slate-700 dark:text-slate-300">
                {children}
            </ol>
        ),
        li: ({ children }: any) => (
            <li className="leading-relaxed">{children}</li>
        ),

        // Links
        a: ({ href, children }: any) => (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
                {children}
            </a>
        ),

        // Paragraphs
        p: ({ children }: any) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),

        // Strong/Bold
        strong: ({ children }: any) => (
            <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
        ),

        // Emphasis/Italic
        em: ({ children }: any) => (
            <em className="italic">{children}</em>
        ),

        // Horizontal rules
        hr: () => (
            <hr className="my-4 border-slate-200 dark:border-slate-700" />
        ),

        // Tables
        table: ({ children }: any) => (
            <div className="overflow-x-auto my-3">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                    {children}
                </table>
            </div>
        ),
        th: ({ children }: any) => (
            <th className="px-3 py-2 bg-slate-100 dark:bg-slate-800 font-semibold text-left">
                {children}
            </th>
        ),
        td: ({ children }: any) => (
            <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-700">
                {children}
            </td>
        ),
    }), [message.id, expandedSections, copied, toggleSection]);

    // System messages have minimal styling
    if (isSystem) {
        return (
            <div className="flex justify-center my-2">
                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs rounded-full">
                    {message.text}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex w-full mb-4 group ${isUser ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`
          relative max-w-[85%] md:max-w-[75%] rounded-2xl shadow-sm
          ${isUser
                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'}
        `}
            >
                {/* Message header (AI only) */}
                {!isUser && (
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">AI</span>
                            </div>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                OrbitAI
                            </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                title="Copy message"
                            >
                                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                            <button
                                onClick={handleBookmark}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                title={isBookmarked ? 'Remove bookmark' : 'Bookmark message'}
                            >
                                {isBookmarked ? (
                                    <BookmarkCheck size={14} className="text-yellow-500" />
                                ) : (
                                    <Bookmark size={14} />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Message content */}
                <div className={`px-4 ${isUser ? 'py-3' : 'pb-3'}`}>
                    {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                    ) : isThinkingMessage ? (
                        /* Animated thinking indicator */
                        <div className="flex items-center gap-3 py-2">
                            <span className="text-lg">🤔</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Thinking</span>
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Collapsible thinking section */}
                            {thinking.length > 0 && (
                                <div className="mb-3">
                                    <button
                                        onClick={() => setShowThinking(!showThinking)}
                                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                    >
                                        <Brain size={14} className="text-purple-500" />
                                        <span className="font-medium">
                                            {showThinking ? 'Hide' : 'Show'} thinking ({thinking.length} step{thinking.length !== 1 ? 's' : ''})
                                        </span>
                                        {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                    {showThinking && (
                                        <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 text-xs text-slate-600 dark:text-slate-300">
                                            {thinking.map((step, idx) => (
                                                <div key={idx} className="flex gap-2 items-start mb-1 last:mb-0">
                                                    <span className="text-purple-500">💭</span>
                                                    <span>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Main content (without thinking sections) */}
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown components={markdownComponents}>
                                    {mainContent}
                                </ReactMarkdown>
                            </div>
                        </>
                    )}
                </div>

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                        {message.attachments.map((attachment, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs"
                            >
                                <span>📎</span>
                                <span className="truncate max-w-[150px]">{attachment.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Timestamp */}
                {showTimestamp && (
                    <div className={`px-4 pb-2 flex items-center gap-1 text-xs ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                        <Clock size={10} />
                        <span>{formatRelativeTime(message.timestamp)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedChatMessage;
