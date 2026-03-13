
import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { apiRequest } from '../../../services/api';
import { ChatMessage, ProjectFolder, Idea } from '@/types';
import { parseXmlToIdeas } from '../utils/xmlParser';

interface UseIdeaExtractionProps {
    topic: string;
    ideas: Idea[];
    setIdeas: React.Dispatch<React.SetStateAction<Idea[]>>;
    setKeyInsights: React.Dispatch<React.SetStateAction<string[]>>;
    setNextSteps: React.Dispatch<React.SetStateAction<string[]>>;
    deepenLevel: number;
    isDeepeningIdeas: boolean;
    deepenMapRef: React.MutableRefObject<Map<string, string>>;
}

interface UseIdeaExtractionReturn {
    isExtractingIdeas: boolean;
    extractionAgent: { name: string; avatar: string; role: string } | null;
    extractIdeasAndInsights: (recentMessages: ChatMessage[], overrideTopic?: string) => Promise<void>;
    filterRelevantMessages: (messages: ChatMessage[], currentTopic: string) => Promise<ChatMessage[]>;
}

export const useIdeaExtraction = ({
    topic,
    ideas,
    setIdeas,
    setKeyInsights,
    setNextSteps,
    deepenLevel,

    isDeepeningIdeas,
    deepenMapRef
}: UseIdeaExtractionProps): UseIdeaExtractionReturn => {
    const [isExtractingIdeas, setIsExtractingIdeas] = useState(false);
    const [extractionAgent, setExtractionAgent] = useState<{ name: string; avatar: string; role: string } | null>(null);
    const isExtractingIdeasRef = useRef(false);

    // Helper to filter messages relevant to the project
    const filterRelevantMessages = useCallback(async (
        messages: ChatMessage[],
        currentTopic: string
    ): Promise<ChatMessage[]> => {
        if (messages.length === 0) return [];

        // If no topic yet, include all messages (early in conversation)
        const hasRealTopic = currentTopic &&
            currentTopic.length > 3 &&
            !currentTopic.toLowerCase().includes('share your dream') &&
            !currentTopic.toLowerCase().includes('welcome');

        if (!hasRealTopic) {
            // Early conversation - include all messages
            return messages;
        }

        // Build message list with IDs for filtering
        const messagesWithContext = messages.map((msg, idx) => ({
            id: msg.id,
            index: idx,
            sender: msg.sender,
            text: msg.text.substring(0, 500) // Limit text length for efficiency
        }));

        // Create filtering prompt
        const filterPrompt = `You are analyzing a conversation about a software project. Your task is to identify which messages are relevant to the project and which are off-topic.

Project Topic: "${currentTopic}"

Messages to analyze:
${messagesWithContext.map((m: any, i: number) => `${i + 1}. [${m.sender}] ${m.text}`).join('\n')}

Instructions:
- Include messages that discuss: project features, requirements, technologies, architecture, design, implementation, constraints, goals, user needs, business logic, technical decisions
- Exclude messages that are: casual conversation, greetings, off-topic discussions, unrelated questions, system status messages, error messages, or agent replies that don't relate to the project
- Agent replies should be included ONLY if they discuss project-related topics (features, technologies, recommendations, etc.)
- Agent replies that are off-topic, greetings, or system messages should be excluded
- CRITICAL: Agent replies that are PURELY conversational acknowledgments (e.g., "I understand", "That's great", "Let me help", "Absolutely") with NO project content should be excluded
- Agent replies that contain BOTH acknowledgments AND project content (features, technologies, requirements) should be INCLUDED
- Prioritize agent responses that mention: features, technologies, requirements, recommendations, constraints, goals, technical decisions
- Filter out agent responses that are ONLY acknowledgments without any project-relevant information

Return JSON array of message indices (0-based) that are project-relevant:
{
  "relevantIndices": [0, 1, 3, 5, ...]
}`;

        try {
            // Set timeout for filtering (5-10 seconds max)
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
                abortController.abort();
            }, 10000); // 10 second timeout for filtering

            const response = await apiRequest<{
                success: boolean;
                response: string;
            }>('/api/llm/chat', {
                method: 'POST',
                body: JSON.stringify({
                    message: filterPrompt,
                    history: [],
                    contextType: 'wizard',
                    preferFastModel: true, // Use fast model for filtering
                    maxTokens: 500 // Small response - just indices
                }),
                signal: abortController.signal
            });

            // Clear timeout if request completes successfully
            clearTimeout(timeoutId);

            if (response.success && response.response) {
                try {
                    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[0]);
                        const relevantIndices = data.relevantIndices || [];

                        // Filter messages based on relevant indices
                        const filtered = messages.filter((_, idx) => relevantIndices.includes(idx));

                        if (import.meta.env.DEV) {
                            console.log(`[FilterMessages] Filtered ${messages.length} messages to ${filtered.length} relevant messages`);
                        }

                        return filtered.length > 0 ? filtered : messages; // Fallback to all if filter too aggressive
                    }
                } catch (parseError) {
                    console.error('[FilterMessages] Failed to parse filter response:', parseError);
                    return messages; // Fallback to all messages
                }
            }
        } catch (error: any) {
            // Don't log error if it was aborted (timeout)
            if (error?.name !== 'AbortError' && error?.message !== 'signal is aborted') {
                console.error('[FilterMessages] Failed to filter messages:', error);
            }
            return messages; // Fallback to all messages on error
        }

        return messages; // Default: include all
    }, []);

    // Main extraction function
    const extractIdeasAndInsights = useCallback(async (recentMessages: ChatMessage[], overrideTopic?: string) => {
        // Prevent concurrent extractions
        if (isExtractingIdeasRef.current) {
            if (import.meta.env.DEV) {
                console.log('⏸️ [NeuralStreamChat] Extraction already in progress, skipping duplicate call');
            }
            return;
        }

        // Use override topic if provided (fixes stale closure issues), otherwise use state topic
        const effectiveTopic = overrideTopic || topic;

        // Mark extraction as in progress (but don't show UI indicator yet)
        isExtractingIdeasRef.current = true;
        setExtractionAgent(null); // Reset agent info

        try {
            // STEP 1: Filter messages for project relevance (silently, no UI indicator)
            const filteredMessages = await filterRelevantMessages(recentMessages, effectiveTopic);

            if (filteredMessages.length === 0) {
                if (import.meta.env.DEV) {
                    console.log('[ExtractIdeas] No relevant messages after filtering, skipping extraction');
                }
                isExtractingIdeasRef.current = false;
                return;
            }

            // NOW show the "Analyzing conversation" indicator since we have relevant messages
            setIsExtractingIdeas(true);

            if (import.meta.env.DEV && filteredMessages.length < recentMessages.length) {
                console.log(`[ExtractIdeas] Filtered ${recentMessages.length} messages to ${filteredMessages.length} project-relevant messages`);
            }

            // STEP 2: Build conversation text from FILTERED messages only
            const conversationText = filteredMessages
                .map(msg => {
                    if (msg.sender === 'user') {
                        return `User: ${msg.text}`;
                    }
                    if (msg.sender === 'agent') {
                        const textToUse = (msg as any).mindmapText || msg.text;
                        const agentMatch = msg.text.match(/\*\*\[([^\]]+)\]\*\*/);
                        const agentName = agentMatch ? agentMatch[1] : 'Orchestrator Agent';
                        const messageText = textToUse.replace(/\*\*\[([^\]]+)\]\*\*\s*/, '');
                        return `${agentName}: ${messageText}`;
                    }
                    if (msg.sender === 'system') {
                        return `System: ${msg.text}`;
                    }
                    const textToUse = (msg as any).mindmapText || msg.text;
                    return `AI: ${textToUse}`;
                })
                .join('\n\n');

            // Check for research findings
            const hasResearchFindings = conversationText.includes('Research Findings') ||
                conversationText.includes('**Research Findings**');

            let textToExtract = conversationText;
            if (hasResearchFindings) {
                const findingsMatch = conversationText.match(/\*\*Research Findings\*\*:?\s*([\s\S]*?)(?:\n\n\*|$)/);
                if (findingsMatch && findingsMatch[1]) {
                    textToExtract = findingsMatch[1].substring(0, 3000);
                    if (findingsMatch[1].length > 3000) {
                        textToExtract += '...';
                    }
                } else {
                    textToExtract = conversationText.substring(0, 3000);
                }
            }

            if (textToExtract.length > 1500) {
                textToExtract = textToExtract.substring(0, 1500) + '...';
            }

            const targetDepth = isDeepeningIdeas ? deepenLevel + 1 : deepenLevel;
            let hierarchyRule = "";

            if (targetDepth <= 0) {
                hierarchyRule = `HIERARCHY RULES (CRITICAL):
1. Create 6-8 PARENT CATEGORY ideas (e.g., "User Authentication", "Data Storage", "UI/UX Features")
2. For EACH parent category, create 3-5 CHILD sub-ideas that belong under it
3. Parent ideas get unique ids like "cat-1", "cat-2", etc. and have parentId: null
4. Child ideas MUST have parentId set to their parent's id (e.g., parentId: "cat-1")
5. This creates a tree structure where children are grouped under parents`;
            } else if (targetDepth === 1) {
                hierarchyRule = `HIERARCHY RULES (CRITICAL):
1. Look at the existing category IDs in the context below
2. Create 4-5 MORE SPECIFIC child ideas for each existing category
3. Each new idea MUST have parentId set to the ID of its parent category`;
            } else {
                hierarchyRule = `HIERARCHY RULES (CRITICAL):
1. Create detailed implementation sub-ideas nested under specific ideas from context
2. Each new idea MUST have parentId set to the ID of its parent`;
            }

            const existingIdeasList = ideas
                .filter(i => i.id !== 'welcome-bubble')
                .map(i => `- ID: "${i.id}", Label: "${i.label}", Description: "${i.description || ''}"`)
                .join('\n');

            const prompt = `You are a Product Architect helping brainstorm ideas for: "${effectiveTopic}"

CONTEXT: The user and AI are discussing features for this software project.
EXISTING IDEAS:
${existingIdeasList}

CONVERSATION LOG:
${textToExtract}

YOUR TASK:
Extract new ideas, key insights, and next steps based *only* on the conversation above.
Do not hallucinate features not discussed or implied.
Use the existing ideas context to avoid duplicates.

${hierarchyRule}

OUTPUT FORMAT:
Return a valid XML block:
<brainstorming>
  <ideas>
    <idea>
      <title>Feature Name</title>
      <description>Brief description</description>
      <category>feature|risk|technology|ux|business|data</category>
      <children>
         <idea>...</idea>
      </children>
    </idea>
    ...
  </ideas>
  <insights>
    <insight>Key technical or product insight</insight>
    ...
  </insights>
  <nextSteps>
    <step>Actionable next step</step>
    ...
  </nextSteps>
</brainstorming>`;

            // Determine appropriate agent persona
            const hasAgentMessages = filteredMessages.some(msg => msg.sender === 'agent');
            const hasVoiceMessages = filteredMessages.some(msg =>
                msg.id?.includes('voice-user') || msg.id?.includes('voice-agent')
            );

            let agentPersona = {
                name: 'Product Architect',
                avatar: '/agents/architect.png',
                role: 'Structure & Design'
            };

            if (hasVoiceMessages) {
                agentPersona = {
                    name: 'Voice Assistant',
                    avatar: '/agents/voice-ai.png',
                    role: 'Voice Interaction'
                };
            } else if (hasAgentMessages) {
                // Try to identify specific agents
                const techAgent = filteredMessages.find(m => m.text.includes('Tarek') || m.text.includes('Architect'));
                const uxAgent = filteredMessages.find(m => m.text.includes('Karim') || m.text.includes('UX'));
                const productAgent = filteredMessages.find(m => m.text.includes('Nour') || m.text.includes('Requirements'));

                if (techAgent) {
                    agentPersona = { name: 'Tarek', avatar: '/agents/tarek.png', role: 'System Architect' };
                } else if (uxAgent) {
                    agentPersona = { name: 'Karim', avatar: '/agents/karim.png', role: 'UX Designer' };
                } else if (productAgent) {
                    agentPersona = { name: 'Nour', avatar: '/agents/nour.png', role: 'Requirements Expert' };
                }
            }

            setExtractionAgent(agentPersona);

            const response = await apiRequest<{
                success: boolean;
                response: string;
            }>('/api/llm/chat', {
                method: 'POST',
                body: JSON.stringify({
                    message: prompt,
                    history: [],
                    contextType: 'wizard',
                    preferFastModel: false, // Use smarter model for extraction
                    maxTokens: 4000
                })
            });

            if (response.success && response.response) {
                // Parse XML response
                let newIdeas = parseXmlToIdeas(response.response);

                // ALIAS RESOLUTION: Resolve id-1 aliases to real UUIDs using deepenMapRef
                // This is critical for connecting Deepen Ideas to their real parents
                if (deepenMapRef && deepenMapRef.current.size > 0) {
                    newIdeas = newIdeas.map(idea => {
                        let finalParentId = idea.parentId || undefined;

                        // Resolve Alias ID (id-1) to Real UUID if mapping exists
                        if (finalParentId && deepenMapRef.current.has(finalParentId)) {
                            finalParentId = deepenMapRef.current.get(finalParentId);
                        } else if (finalParentId && !finalParentId.includes('-') && parseInt(finalParentId) > 0) {
                            // Handle case where AI just returns "1" instead of "id-1"
                            const aliasVariant = `id-${finalParentId}`;
                            if (deepenMapRef.current.has(aliasVariant)) {
                                finalParentId = deepenMapRef.current.get(aliasVariant);
                            }
                        }

                        // Generate new UUID for the idea itself
                        const newIdeaId = uuidv4();

                        // If the AI provided an ID (e.g., "id-1") for this idea, map it to the new UUID
                        // so children can find it
                        if (idea.id && idea.id.startsWith('id-')) {
                            deepenMapRef.current.set(idea.id, newIdeaId);
                        }

                        return {
                            ...idea,
                            id: newIdeaId,
                            parentId: finalParentId
                        };
                    });
                } else {
                    // Even if no map, ensure unique IDs
                    newIdeas = newIdeas.map(idea => ({ ...idea, id: uuidv4() }));
                }

                // Use regex for insights and next steps
                const insightsMatch = response.response.match(/<insight>(.*?)<\/insight>/g);
                const nextStepsMatch = response.response.match(/<step>(.*?)<\/step>/g);

                const newInsights = insightsMatch
                    ? insightsMatch.map(s => s.replace(/<\/?insight>/g, ''))
                    : [];

                const newNextSteps = nextStepsMatch
                    ? nextStepsMatch.map(s => s.replace(/<\/?step>/g, ''))
                    : [];

                if (newIdeas.length > 0) {
                    // Merge ideas logic
                    setIdeas(prev => {
                        const existingIds = new Set(prev.map(i => i.id));
                        const uniqueNewIdeas = newIdeas.filter(i => !existingIds.has(i.id));

                        // Limit total ideas to avoid performance issues
                        const combined = [...prev, ...uniqueNewIdeas];
                        return combined.slice(0, 100);
                    });

                    if (import.meta.env.DEV) {
                        console.log(`[ExtractIdeas] Extracted ${newIdeas.length} new ideas`);
                    }
                }

                if (newInsights.length > 0) {
                    setKeyInsights(prev => {
                        const combined = [...prev, ...newInsights];
                        return [...new Set(combined)].slice(0, 10);
                    });
                }

                if (newNextSteps.length > 0) {
                    setNextSteps(prev => {
                        const combined = [...prev, ...newNextSteps];
                        return [...new Set(combined)].slice(0, 10);
                    });
                }
            }

        } catch (error) {
            console.error('[ExtractIdeas] Failed to extract ideas:', error);
        } finally {
            setIsExtractingIdeas(false);
            setExtractionAgent(null);
            isExtractingIdeasRef.current = false;
        }
        setExtractionAgent(null);
        isExtractingIdeasRef.current = false;

    }, [topic, ideas, setIdeas, setKeyInsights, setNextSteps, filterRelevantMessages, deepenLevel, isDeepeningIdeas, deepenMapRef]);

    return {
        isExtractingIdeas,
        extractionAgent,
        extractIdeasAndInsights,
        filterRelevantMessages
    };
};
