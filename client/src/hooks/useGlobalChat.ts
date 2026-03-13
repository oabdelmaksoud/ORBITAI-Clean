/**
 * useGlobalChat Hook
 * 
 * Manages global chat state and interactions with the Orchestrator.
 * Extracted from App.tsx for better maintainability.
 */

import { useState, useRef, useCallback } from 'react';
import { ChatMessage } from '@orbitai/shared';

const WELCOME_MESSAGE: ChatMessage = {
    id: 'welcome',
    sender: 'system',
    text: '**Global Neural Link Established.**\n\nAll agent communications and system events will appear here. You can interject at any time to guide the Orchestrator.',
    timestamp: Date.now(),
    isLogEvent: false
};

interface UseGlobalChatOptions {
    onSendMessage?: (message: string) => Promise<void>;
}

export function useGlobalChat(options: UseGlobalChatOptions = {}) {
    const { onSendMessage } = options;

    // Message state
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    // Processing states
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isResearching, setIsResearching] = useState(false);

    // Refs
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /**
     * Add a message to the chat
     */
    const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const newMessage: ChatMessage = {
            id: Math.random().toString(36),
            timestamp: Date.now(),
            ...message
        };
        setMessages(prev => [...prev, newMessage]);
        return newMessage;
    }, []);

    /**
     * Add a system message
     */
    const addSystemMessage = useCallback((text: string, isLogEvent = false) => {
        return addMessage({
            sender: 'system',
            text,
            isLogEvent
        });
    }, [addMessage]);

    /**
     * Add a user message
     */
    const addUserMessage = useCallback((text: string) => {
        return addMessage({
            sender: 'user',
            text,
            isLogEvent: false
        });
    }, [addMessage]);

    /**
     * Add an agent message
     */
    const addAgentMessage = useCallback((text: string, agentId?: string, isLogEvent = false) => {
        return addMessage({
            sender: 'agent',
            text,
            agentId,
            isLogEvent
        });
    }, [addMessage]);

    /**
     * Handle sending a message
     */
    const handleSend = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isThinking) return;

        const text = input;
        setInput('');
        addUserMessage(text);
        setIsThinking(true);

        try {
            if (onSendMessage) {
                await onSendMessage(text);
            }
        } finally {
            setIsThinking(false);
        }
    }, [input, isThinking, addUserMessage, onSendMessage]);

    /**
     * Clear all messages except welcome
     */
    const clearMessages = useCallback(() => {
        setMessages([WELCOME_MESSAGE]);
    }, []);

    /**
     * Remove welcome message
     */
    const removeWelcome = useCallback(() => {
        setMessages(prev => prev.filter(m => m.id !== 'welcome'));
    }, []);

    /**
     * Append text to input
     */
    const appendToInput = useCallback((text: string) => {
        setInput(prev => prev + text);
    }, []);

    /**
     * Scroll to bottom of chat
     */
    const scrollToBottom = useCallback(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    /**
     * Focus the input field
     */
    const focusInput = useCallback(() => {
        inputRef.current?.focus();
    }, []);

    /**
     * Trigger file input click
     */
    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    /**
     * Clear file input
     */
    const clearFileInput = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    return {
        // State
        messages,
        setMessages,
        input,
        setInput,
        isThinking,
        setIsThinking,
        isProcessingFile,
        setIsProcessingFile,
        isEnhancing,
        setIsEnhancing,
        isResearching,
        setIsResearching,

        // Refs
        chatEndRef,
        fileInputRef,
        inputRef,

        // Methods
        addMessage,
        addSystemMessage,
        addUserMessage,
        addAgentMessage,
        handleSend,
        clearMessages,
        removeWelcome,
        appendToInput,
        scrollToBottom,
        focusInput,
        triggerFileSelect,
        clearFileInput,
    };
}

export default useGlobalChat;
