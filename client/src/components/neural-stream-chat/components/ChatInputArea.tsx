/**
 * ChatInputArea - Reusable chat input component
 * Extracted from NeuralStreamChat for maintainability
 */

import React, { useState, useRef, useCallback } from 'react';
import { Mic, Paperclip, Globe } from 'lucide-react';

export interface ChatInputAreaProps {
    input: string;
    setInput: (value: string) => void;
    onSendMessage: (message: string, stageContext?: string) => void;
    isProcessing?: boolean;
    processingLabel?: string | null;
    placeholder?: string;
    useInternet?: boolean;
    onToggleInternet?: () => void;
    onAttachFile?: (file: File) => void;
    onVoiceInput?: () => void;
    disabled?: boolean;
    className?: string;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
    input,
    setInput,
    onSendMessage,
    isProcessing = false,
    processingLabel = null,
    placeholder = 'Type your message...',
    useInternet = false,
    onToggleInternet,
    onAttachFile,
    onVoiceInput,
    disabled = false,
    className = '',
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Handle textarea auto-resize
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [setInput]);

    // Handle send message
    const handleSend = useCallback(() => {
        const trimmedInput = input.trim();
        if (!trimmedInput || isProcessing || disabled) return;

        onSendMessage(trimmedInput);
        setInput('');

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [input, isProcessing, disabled, onSendMessage, setInput]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // Handle file attachment
    const handleFileClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onAttachFile) {
            onAttachFile(file);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [onAttachFile]);

    return (
        <div className={`chat-input-area ${className}`}>
            <div
                className={`
          relative flex items-end gap-2 p-3 
          bg-white/5 backdrop-blur-sm rounded-xl 
          border transition-all duration-200
          ${isFocused
                        ? 'border-cyan-400/50 shadow-lg shadow-cyan-400/10'
                        : 'border-white/10 hover:border-white/20'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
            >
                {/* Left side buttons */}
                <div className="flex items-center gap-1">
                    {/* Attachment button */}
                    {onAttachFile && (
                        <button
                            type="button"
                            onClick={handleFileClick}
                            disabled={disabled || isProcessing}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                            title="Attach file"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                    )}

                    {/* Voice input button */}
                    {onVoiceInput && (
                        <button
                            type="button"
                            onClick={onVoiceInput}
                            disabled={disabled || isProcessing}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                            title="Voice input"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    disabled={disabled || isProcessing}
                    rows={1}
                    className={`
            flex-1 bg-transparent text-white placeholder-gray-400
            resize-none outline-none text-sm leading-relaxed
            min-h-[40px] max-h-[200px]
            disabled:cursor-not-allowed
          `}
                />

                {/* Right side buttons */}
                <div className="flex items-center gap-1">
                    {/* Internet toggle */}
                    {onToggleInternet && (
                        <button
                            type="button"
                            onClick={onToggleInternet}
                            disabled={disabled || isProcessing}
                            className={`
                p-2 rounded-lg transition-colors disabled:opacity-50
                ${useInternet
                                    ? 'text-cyan-400 bg-cyan-400/20'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }
              `}
                            title={useInternet ? 'Internet search enabled' : 'Enable internet search'}
                        >
                            <Globe className="w-5 h-5" />
                        </button>
                    )}

                    {/* Send button */}
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim() || isProcessing || disabled}
                        className={`
              px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-200
              ${!input.trim() || isProcessing || disabled
                                ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/25'
                            }
            `}
                    >
                        {isProcessing ? (processingLabel || 'Processing...') : 'Send'}
                    </button>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="*/*"
                />
            </div>
        </div>
    );
};

export default ChatInputArea;
