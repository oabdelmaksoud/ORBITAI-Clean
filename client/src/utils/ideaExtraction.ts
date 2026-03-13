/**
 * Idea Extraction Utility
 * Ported from MYPROJECT - extracts ideas from AI response text using XML tags
 * 
 * Usage in existing NeuralStreamChat.tsx:
 * 
 * import { extractIdeasFromText, cleanTextFromXmlTags } from '../utils/ideaExtraction';
 * 
 * // In your streaming callback:
 * const ideas = extractIdeasFromText(streamedText, existingIdeasRef.current);
 * if (ideas.length > 0) {
 *     setIdeas(prev => [...prev, ...ideas]);
 * }
 * 
 * // When displaying the message, clean the XML tags:
 * const displayText = cleanTextFromXmlTags(message.text);
 */

import type { Idea } from '../components/OrbGraph';

// Set to track already extracted idea IDs (prevents duplicates during streaming)
const extractedIdsCache = new Set<string>();

/**
 * Extract ideas from AI response text that contains XML-tagged ideas
 * The AI is prompted to output ideas in this format:
 * <idea>
 *   <title>Feature Name</title>
 *   <description>What it does</description>
 *   <category>feature|technical|design|business|user-experience</category>
 *   <connections>Related idea 1, Related idea 2</connections>
 * </idea>
 * 
 * @param text - The raw AI response text
 * @param existingIdeas - Optional array of existing ideas to check for duplicates
 * @returns Array of newly extracted ideas
 */
export function extractIdeasFromText(
    text: string,
    existingIdeas: Idea[] = []
): Idea[] {
    const ideaRegex = /<idea>([\s\S]*?)<\/idea>/g;
    let match;
    const newIdeas: Idea[] = [];

    // Build set of existing idea titles for duplicate checking
    const existingTitles = new Set(existingIdeas.map(i => i.label?.toLowerCase() || i.title?.toLowerCase()));

    while ((match = ideaRegex.exec(text)) !== null) {
        const ideaBlock = match[1];
        const titleMatch = /<title>(.*?)<\/title>/s.exec(ideaBlock);

        if (titleMatch) {
            const title = titleMatch[1].trim();
            const normalizedTitle = title.toLowerCase();
            const id = `idea-${normalizedTitle.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            // Skip if already extracted or exists
            if (extractedIdsCache.has(normalizedTitle) || existingTitles.has(normalizedTitle)) {
                continue;
            }

            extractedIdsCache.add(normalizedTitle);

            const descMatch = /<description>(.*?)<\/description>/s.exec(ideaBlock);
            const categoryMatch = /<category>(.*?)<\/category>/s.exec(ideaBlock);
            const connectionsMatch = /<connections>(.*?)<\/connections>/s.exec(ideaBlock);

            // Map category to valid OrbGraph categories
            const rawCategory = categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'idea';
            const categoryMap: Record<string, Idea['category']> = {
                'feature': 'feature',
                'technical': 'feature',
                'design': 'improvement',
                'business': 'opportunity',
                'user-experience': 'improvement',
                'ux': 'improvement',
                'risk': 'risk',
                'requirement': 'requirement',
                'constraint': 'constraint',
            };
            const category = categoryMap[rawCategory] || 'idea';

            const idea: Idea = {
                id,
                label: title,
                description: descMatch ? descMatch[1].trim() : '',
                category,
                x: 0, // Will be positioned by OrbGraph
                y: 0,
            };

            newIdeas.push(idea);
        }
    }

    return newIdeas;
}

/**
 * Clean XML idea tags from text for display
 * @param text - Raw AI response with XML tags
 * @returns Clean text without the XML tags
 */
export function cleanTextFromXmlTags(text: string): string {
    return text
        .replace(/<idea>[\s\S]*?<\/idea>/g, '')
        .replace(/<ideas>[\s\S]*?<\/ideas>/g, '')
        .replace(/\[\[IDEA:[^\]]+\]\]/g, '') // Also clean inline IDEA tags
        .trim();
}

/**
 * Reset the extraction cache (call when starting a new conversation)
 */
export function resetExtractionCache(): void {
    extractedIdsCache.clear();
}

/**
 * System prompt to instruct the AI to output ideas in extractable format
 * Append this to your existing brainstorming context
 * 
 * IMPORTANT: This prompt instructs the AI to create HIERARCHICAL ideas
 * with parent-child relationships using nested <children> tags.
 */
export const IDEA_EXTRACTION_PROMPT = `
When identifying ideas, features, or concepts in your response, wrap them in XML tags with HIERARCHICAL structure:

For TOP-LEVEL ideas:
<idea>
<title>Main Feature or Concept</title>
<description>Brief description of the idea</description>
<category>One of: feature, technology, ux, business, data, risk, requirement</category>
<children>
  <idea>
  <title>Sub-feature 1</title>
  <description>Description of sub-feature</description>
  <category>feature</category>
  </idea>
  <idea>
  <title>Sub-feature 2</title>
  <description>Description of another sub-feature</description>
  <category>technology</category>
  </idea>
</children>
</idea>

For SIMPLE ideas without sub-features:
<idea>
<title>Simple Concept</title>
<description>Brief description</description>
<category>feature</category>
</idea>

RULES:
- Main ideas should have 2-4 sub-ideas inside <children> tags when relevant
- Use <children> tags to group related sub-features under a parent idea
- Sub-ideas can also have their own <children> for deeper nesting (sub-sub-ideas)
- Categories: feature, technology, ux, business, data, architecture, community, platform, risk, requirement
- These tags will be automatically parsed to create a visual mind map hierarchy
- Continue your response naturally - the tags will be hidden from the user
`;
