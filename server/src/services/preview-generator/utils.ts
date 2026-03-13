// Preview Generator Utilities
// Extracted from enhancedPreviewGenerator.service.ts

import { logger } from '../../utils/logger.js';

/**
 * Clean JSON response from LLM - strips markdown code blocks if present
 * Handles responses like: ```json\n{...}\n``` or ```\n{...}\n```
 */
export function cleanJsonResponse(text: string): string {
    if (!text) return '{}';

    let cleaned = text.trim();

    // Remove markdown code blocks with language specifier
    const codeBlockMatch = cleaned.match(/^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/i);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }

    // Handle embedded code blocks
    const embeddedMatch = cleaned.match(/```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```/i);
    if (embeddedMatch) {
        cleaned = embeddedMatch[1].trim();
    }

    // Handle case where response starts with ``` but no closing
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
        }
    }

    return cleaned.trim() || '{}';
}

/**
 * Sanitize JSX code to fix common AI-generated errors
 * - Fixes truncated closing tags like </s> → </span>
 * - Fixes fragment shortcuts like </> → proper closing tags
 */
export function sanitizeJsx(code: string): string {
    if (!code) return code;

    let fixed = code;

    // Common truncated closing tag patterns and their fixes
    const truncatedTags: Record<string, string> = {
        '</s>': '</span>',
        '</sp>': '</span>',
        '</spa>': '</span>',
        '</d>': '</div>',
        '</di>': '</div>',
        '</la>': '</label>',
        '</lab>': '</label>',
        '</labe>': '</label>',
        '</bu>': '</button>',
        '</but>': '</button>',
        '</butt>': '</button>',
        '</butto>': '</button>',
        '</h>': '</h1>',
        '</pa>': '</p>',
        '</sec>': '</section>',
        '</arti>': '</article>',
        '</heade>': '</header>',
        '</foote>': '</footer>',
    };

    // Fix truncated tags
    for (const [truncated, full] of Object.entries(truncatedTags)) {
        fixed = fixed.split(truncated).join(full);
    }

    // Remove </s> patterns entirely (often EOS tokens)
    fixed = fixed.replace(/<\/\s*s\s*>/gi, '');
    fixed = fixed.replace(/<\/\s*sp\s*>/gi, '</span>');
    fixed = fixed.replace(/<\/\s*spa\s*>/gi, '</span>');

    // Fix mismatched closing tags
    const openTagRegex = /<(span|label|button|div|p|section|article|header|footer|nav|main|aside|h[1-6])(\s[^>]*)?>/gi;
    let match;
    while ((match = openTagRegex.exec(fixed)) !== null) {
        const tagName = match[1].toLowerCase();
        const shortClose = '</' + tagName.charAt(0) + '>';
        if (fixed.includes(shortClose)) {
            fixed = fixed.split(shortClose).join('</' + tagName + '>');
        }
    }

    // Fix specific pattern where </> is used to close a known tag
    const specificFragmentPattern = /<(\w+)(\s+[^>]*)?>([^<]*?)<\/>/gi;
    fixed = fixed.replace(specificFragmentPattern, (_match, tagName, attrs, content) => {
        return `<${tagName}${attrs || ''}>${content}</${tagName}>`;
    });

    // Fix React fragment shortcut misuse
    const fragmentPattern = /(<(label|span|p|div|button|h[1-6]|section|article)\b[^>]*>[^<]*)<\/>/gi;
    fixed = fixed.replace(fragmentPattern, (_match, content, tagName) => {
        return content + '</' + tagName + '>';
    });

    logger.debug(`[PreviewUtils] JSX sanitized - original: ${code.length} chars, fixed: ${fixed.length} chars`);

    return fixed;
}

/**
 * Strip XML tags from input text
 */
export function cleanXmlTags(text: any): string {
    if (!text) return '';

    // Handle non-string inputs
    if (typeof text !== 'string') {
        if (text.label) {
            text = `${text.label}${text.description ? ': ' + text.description : ''}`;
        } else {
            text = String(text);
        }
    }
    return text.replace(/<[^>]+>/g, ' ');
}

/**
 * Extract HTML from LLM response
 */
export function extractHtml(text: string): string {
    let code = text || '';

    // Reject XML hierarchy responses
    if (code.includes('<idea>') && code.includes('<category>')) {
        logger.warn('[PreviewUtils] Detected XML hierarchy instead of HTML code. Rejecting.');
        return '';
    }

    // Simple cleanup
    code = code.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    // Extract HTML if prose was added
    const doctypeIndex = code.indexOf('<!DOCTYPE');
    const htmlIndex = code.indexOf('<html');

    if (doctypeIndex !== -1) {
        code = code.substring(doctypeIndex);
    } else if (htmlIndex !== -1) {
        code = code.substring(htmlIndex);
    } else if (code.includes('import React')) {
        return code;
    }

    return sanitizeJsx(code);
}

/**
 * Detect project domain/subtype for better prompt customization
 */
export function detectProjectDomain(userGoal: string, projectType: string): string {
    const goal = userGoal.toLowerCase();

    // E-commerce detection
    if (goal.includes('shop') || goal.includes('store') || goal.includes('e-commerce') ||
        goal.includes('ecommerce') || goal.includes('marketplace') || goal.includes('cart') ||
        goal.includes('checkout') || goal.includes('product catalog')) {
        return 'e-commerce';
    }

    // Game detection
    if (projectType === 'game' || goal.includes('game') || goal.includes('gaming') ||
        goal.includes('player') || goal.includes('score') || goal.includes('level') ||
        goal.includes('mario') || goal.includes('platformer') || goal.includes('arcade')) {
        return 'game';
    }

    // SaaS detection
    if (goal.includes('saas') || goal.includes('subscription') || goal.includes('dashboard') ||
        goal.includes('analytics') || goal.includes('crm') || goal.includes('erp') ||
        goal.includes('project management') || goal.includes('task management')) {
        return 'saas';
    }

    // Social detection
    if (goal.includes('social') || goal.includes('community') || goal.includes('forum') ||
        goal.includes('chat') || goal.includes('messaging') || goal.includes('network') ||
        goal.includes('friends') || goal.includes('followers')) {
        return 'social';
    }

    // Healthcare detection
    if (goal.includes('health') || goal.includes('medical') || goal.includes('patient') ||
        goal.includes('doctor') || goal.includes('hospital') || goal.includes('clinic') ||
        goal.includes('telemedicine') || goal.includes('appointment')) {
        return 'healthcare';
    }

    // Education detection
    if (goal.includes('education') || goal.includes('learning') || goal.includes('course') ||
        goal.includes('student') || goal.includes('teacher') || goal.includes('school') ||
        goal.includes('training') || goal.includes('tutorial')) {
        return 'education';
    }

    // Finance detection
    if (goal.includes('finance') || goal.includes('banking') || goal.includes('payment') ||
        goal.includes('invoice') || goal.includes('accounting') || goal.includes('budget') ||
        goal.includes('expense') || goal.includes('wallet')) {
        return 'finance';
    }

    return 'general';
}

export default {
    cleanJsonResponse,
    sanitizeJsx,
    cleanXmlTags,
    extractHtml,
    detectProjectDomain,
};
