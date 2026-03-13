// XML Parser Utilities for Idea Extraction
// Extracted from NeuralStreamChat.tsx

import { Idea } from '@src/OrbGraph';

/**
 * Parse XML-formatted ideas from AI response into Idea objects
 * Handles hierarchical <idea> elements with children
 * 
 * @param text - Raw text containing XML-formatted ideas
 * @returns Array of parsed Idea objects with hierarchy
 */
export const parseXmlToIdeas = (text: string): Idea[] => {
    try {
        // Find the start of XML content
        const xmlStartIndex = text.indexOf('<idea>');
        if (xmlStartIndex === -1) return [];

        let xmlContent = text.slice(xmlStartIndex);

        const parser = new DOMParser();
        // Wrap in root to handle multiple top-level ideas
        const doc = parser.parseFromString(`<root>${xmlContent}</root>`, 'text/xml');

        const parsedIdeas: Idea[] = [];
        const errorNode = doc.querySelector('parsererror');

        if (errorNode) {
            // If parsing fails (common during streaming), we traverse what's there
            console.warn('XML parsing had errors, attempting partial extraction');
        }

        const processNode = (node: Element, parentId: string | null = null): void => {
            if (node.tagName !== 'idea') return;

            let title = '';
            let description = '';
            let categoryRaw = '';
            let childrenContainer: Element | null = null;

            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                const tagName = child.tagName.toLowerCase();
                if (tagName === 'title') title = child.textContent || '';
                else if (tagName === 'description') description = child.textContent || '';
                else if (tagName === 'category') categoryRaw = child.textContent || '';
                else if (tagName === 'children') childrenContainer = child;
            }

            if (!title) return;

            // Generate a deterministic ID based on title and parent to stabilize graph during stream
            const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            const id = `idea-${parentId || 'center'}-${safeTitle}`;

            // Normalize category
            const category = mapCategoryFromXml(categoryRaw);

            parsedIdeas.push({
                id,
                label: title,
                description,
                category,
                parentId: parentId === 'CENTER' ? null : parentId
            });

            // Recurse into children
            if (childrenContainer) {
                for (let i = 0; i < childrenContainer.children.length; i++) {
                    processNode(childrenContainer.children[i], id);
                }
            }
        };

        // Traverse from root
        const root = doc.documentElement;
        for (let i = 0; i < root.children.length; i++) {
            processNode(root.children[i], 'CENTER');
        }

        return parsedIdeas;
    } catch (e) {
        console.warn('XML Parsing error:', e);
        return [];
    }
};

/**
 * Map category string from XML to valid Idea category
 */
const mapCategoryFromXml = (categoryRaw: string): Idea['category'] => {
    const catLower = categoryRaw.toLowerCase();

    if (catLower.includes('risk')) return 'risk';
    if (catLower.includes('opportun')) return 'opportunity';
    if (catLower.includes('constraint')) return 'constraint';
    if (catLower.includes('require')) return 'requirement';
    if (catLower.includes('tech')) return 'technology';
    if (catLower.includes('ux')) return 'ux';
    if (catLower.includes('busines')) return 'business';
    if (catLower.includes('data')) return 'data';
    if (catLower.includes('communit')) return 'community';
    if (catLower.includes('plat')) return 'platform';

    return 'feature';
};

/**
 * Parse legacy [[IDEA:label:category]] format from older AI responses
 * 
 * @param text - Raw text containing inline idea markers
 * @returns Array of parsed Idea objects
 */
export const parseInlineIdeas = (text: string): Idea[] => {
    const inlineIdeaRegex = /\[\[\s*IDEA\s*:\s*(.*?)\s*:\s*(.*?)\s*\]\]/g;
    let match;
    const ideas: Idea[] = [];

    while ((match = inlineIdeaRegex.exec(text)) !== null) {
        const label = match[1].trim();
        const categoryRaw = match[2].trim();

        if (label.length > 2) {
            ideas.push({
                id: `idea-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
                label: label,
                description: '',
                category: mapCategoryFromXml(categoryRaw)
            });
        }
    }

    return ideas;
};

/**
 * Extract all ideas from text, trying XML first then falling back to inline format
 * 
 * @param text - Raw AI response text
 * @returns Array of parsed ideas from either format
 */
export const extractIdeasFromText = (text: string): Idea[] => {
    // Try XML format first (new format)
    const xmlIdeas = parseXmlToIdeas(text);
    if (xmlIdeas.length > 0) {
        return xmlIdeas;
    }

    // Fallback to inline format (legacy)
    return parseInlineIdeas(text);
};

/**
 * Merge new ideas into existing ideas array, avoiding duplicates
 * 
 * @param existingIdeas - Current ideas array
 * @param newIdeas - New ideas to merge in
 * @returns Merged array with duplicates handled
 */
export const mergeIdeas = (existingIdeas: Idea[], newIdeas: Idea[]): Idea[] => {
    const ideaMap = new Map(existingIdeas.map(i => [i.id, i]));

    // If an idea exists in both, update it (stream might refine description)
    // If it's new, add it
    newIdeas.forEach(idea => {
        ideaMap.set(idea.id, idea);
    });

    return Array.from(ideaMap.values());
};

/**
 * Clean AI response text by removing XML tags for display
 * 
 * @param text - Raw AI response with XML
 * @returns Cleaned text suitable for chat display
 */
export const cleanXmlFromText = (text: string): string => {
    let cleanText = text
        .replace(/<idea>[\s\S]*?<\/idea>/g, '') // Remove complete idea blocks
        .replace(/\[\[\s*IDEA\s*:\s*(.*?)\s*:\s*(.*?)\s*\]\]/g, '') // Remove legacy tags
        .trim();

    // If almost nothing left and there was XML, add placeholder
    if (cleanText.length < 10 && text.includes('<idea>')) {
        cleanText = 'Brainstorming session complete. View the mind map for ideas.';
    }

    return cleanText;
};
