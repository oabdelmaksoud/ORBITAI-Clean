// useAgentVoice Hook
// Extracted from NeuralStreamChat.tsx for managing agent voice selection

import { useMemo, useCallback } from 'react';
import { ChatMessage } from '@orbitai/shared';
import { AGENT_VOICE_MAP, AgentVoice } from '../types';

interface UseAgentVoiceOptions {
    messages: ChatMessage[];
    defaultVoice?: AgentVoice;
}

interface UseAgentVoiceReturn {
    currentVoice: AgentVoice;
    getVoiceForAgent: (agentName: string) => AgentVoice;
    detectAgentFromMessage: (message: ChatMessage) => string;
}

/**
 * Custom hook for managing agent voice selection in voice conversations
 * Maps different agents to different TTS voices for variety
 */
export const useAgentVoice = ({
    messages,
    defaultVoice = 'Puck'
}: UseAgentVoiceOptions): UseAgentVoiceReturn => {

    /**
     * Get the voice to use for a specific agent
     */
    const getVoiceForAgent = useCallback((agentName: string): AgentVoice => {
        for (const [key, voice] of Object.entries(AGENT_VOICE_MAP)) {
            if (agentName.includes(key) || key.includes(agentName)) {
                return voice;
            }
        }
        return defaultVoice;
    }, [defaultVoice]);

    /**
     * Detect which agent is speaking from a message
     */
    const detectAgentFromMessage = useCallback((message: ChatMessage): string => {
        if (message.sender !== 'agent') {
            return '';
        }

        // Check for explicit agent name format: **[AgentName]** message
        const agentMatch = message.text.match(/\*\*\[([^\]]+)\]\*\*/);
        if (agentMatch) {
            return agentMatch[1];
        }

        // Check for Orchestrator/Raed mentions
        if (message.text.includes('Orchestrator') || message.text.includes('Raed')) {
            return 'Orchestrator Agent';
        }

        // Default to Orchestrator for unmarked agent messages
        return 'Orchestrator Agent';
    }, []);

    /**
     * Get the current voice based on the last agent message
     */
    const getCurrentAgentVoice = useCallback((): AgentVoice => {
        // Find the last agent message
        const lastAgentMessage = [...messages].reverse().find(msg => msg.sender === 'agent');

        if (lastAgentMessage) {
            const agentName = detectAgentFromMessage(lastAgentMessage);
            if (agentName) {
                return getVoiceForAgent(agentName);
            }
        }

        // Default to Orchestrator voice
        return defaultVoice;
    }, [messages, getVoiceForAgent, detectAgentFromMessage, defaultVoice]);

    // Memoize current voice to prevent unnecessary recalculations
    const currentVoice = useMemo(getCurrentAgentVoice, [getCurrentAgentVoice]);

    return {
        currentVoice,
        getVoiceForAgent,
        detectAgentFromMessage,
    };
};

export default useAgentVoice;
