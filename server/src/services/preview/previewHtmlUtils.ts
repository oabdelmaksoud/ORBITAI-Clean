/**
 * Preview HTML Utilities
 * Extracted from enhancedPreviewGenerator.service.ts for maintainability
 * Contains HTML processing, sanitization, and React dependency fixing
 */

import { logger } from '../../utils/logger.js';

/**
 * Clean JSON response from LLM - strips markdown code blocks if present
 * Handles responses like: ```json\n{...}\n``` or ```\n{...}\n```
 */
export function cleanJsonResponse(text: string): string {
    let cleaned = text.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }

    cleaned = cleaned.trim();

    // Handle nested code blocks
    const jsonMatch = cleaned.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
    if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
    }

    return cleaned;
}

/**
 * Sanitize JSX code to fix common AI-generated errors
 * - Fixes truncated closing tags like </s> → </span>
 * - Fixes fragment shortcuts like </> → proper closing tags
 * - Fixes </la> → </label>, </bu> → </button>, etc.
 * - Fixes unclosed self-closing tags: <img> → <img />
 */
export function sanitizeJsx(code: string): string {
    let sanitized = code;

    // Map of truncated tags to full tags
    const tagFixes: Record<string, string> = {
        '</s>': '</span>',
        '</d>': '</div>',
        '</p>': '</p>',
        '</a>': '</a>',
        '</h>': '</h1>',
        '</bu>': '</button>',
        '</la>': '</label>',
        '</in>': '</input>',
        '</fo>': '</form>',
        '</ul>': '</ul>',
        '</li>': '</li>',
        '</ol>': '</ol>',
        '</ta>': '</table>',
        '</tr>': '</tr>',
        '</td>': '</td>',
        '</th>': '</th>',
        '</se>': '</section>',
        '</he>': '</header>',
        '</na>': '</nav>',
        '</ma>': '</main>',
        '</ar>': '</article>',
        '</as>': '</aside>',
        '</fi>': '</figure>',
        '</ca>': '</canvas>',
        '</sv>': '</svg>',
        '</pa>': '</path>',
    };

    // Apply tag fixes
    for (const [broken, fixed] of Object.entries(tagFixes)) {
        sanitized = sanitized.split(broken).join(fixed);
    }

    // Fix self-closing tags that might be broken
    const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
    for (const tag of selfClosingTags) {
        // Match <tag ...> without />
        const pattern = new RegExp(`<${tag}([^>]*[^/])>`, 'gi');
        sanitized = sanitized.replace(pattern, `<${tag}$1 />`);

        // Also fix <tag> (no attributes, no slash)
        const simplePattern = new RegExp(`<${tag}>`, 'gi');
        sanitized = sanitized.replace(simplePattern, `<${tag} />`);
    }

    // Fix empty fragments
    sanitized = sanitized.replace(/<\/>/g, '</>');

    // Fix className with hyphenated values (CSS classes with hyphens are fine)
    // But fix className="" → className=""
    sanitized = sanitized.replace(/className=""/g, 'className=""');

    return sanitized;
}

/**
 * Helper to strip XML tags from input text
 */
export function cleanXmlTags(text: unknown): string {
    if (typeof text !== 'string') {
        return String(text || '');
    }

    // Remove common XML/HTML wrapper tags
    let cleaned = text
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .replace(/<\/?head[^>]*>/gi, '')
        .replace(/<\/?script[^>]*>/gi, '')
        .replace(/<\/?style[^>]*>/gi, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .trim();

    return cleaned;
}

/**
 * Helper to extract HTML from LLM response
 * Handles markdown code blocks and raw HTML
 */
export function extractHtml(text: string): string {
    // Try to extract HTML from markdown code block
    const htmlBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (htmlBlockMatch) {
        return htmlBlockMatch[1].trim();
    }

    // Try to find a complete HTML document
    const docMatch = text.match(/<!DOCTYPE[\s\S]*<\/html>/i);
    if (docMatch) {
        return docMatch[0];
    }

    // Try to find html tags
    const htmlMatch = text.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) {
        return htmlMatch[0];
    }

    // Return as-is if no extraction possible
    return text.trim();
}

/**
 * Fix React dependencies in generated HTML to ensure proper loading
 * Enforces strict loading of React from jsDelivr before any app code executes.
 * NO FALLBACKS: Uses the most reliable single source to prevent complexity.
 * STRATEGY: Deferred Execution - Renames scripts to prevent early execution, 
 * then manually transforms and runs them after dependencies are ready.
 */
export function fixReactDependencies(html: string): string {
    // If already has proper React setup, return as-is
    if (html.includes('window.React') && html.includes('window.ReactDOM')) {
        return html;
    }

    // React CDN URLs (jsDelivr is most reliable)
    const reactCdn = 'https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js';
    const reactDomCdn = 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js';
    const babelCdn = 'https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js';

    // Dependency loader script
    const dependencyLoader = `
<script>
  // React Dependency Loader
  (function() {
    var deps = [
      '${reactCdn}',
      '${reactDomCdn}'
    ];
    var loaded = 0;
    
    function onLoad() {
      loaded++;
      if (loaded === deps.length) {
        // Dependencies ready, load Babel for JSX
        var babel = document.createElement('script');
        babel.src = '${babelCdn}';
        babel.onload = function() {
          // Execute deferred scripts
          var scripts = document.querySelectorAll('script[type="text/babel-deferred"]');
          scripts.forEach(function(s) {
            s.type = 'text/babel';
            Babel.transformScriptTags();
          });
        };
        document.head.appendChild(babel);
      }
    }
    
    deps.forEach(function(src) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = onLoad;
      document.head.appendChild(s);
    });
  })();
</script>`;

    // Transform existing text/babel scripts to deferred
    let fixed = html.replace(/type="text\/babel"/g, 'type="text/babel-deferred"');

    // Insert dependency loader after <head> or at start
    if (fixed.includes('<head>')) {
        fixed = fixed.replace('<head>', '<head>' + dependencyLoader);
    } else if (fixed.includes('<html>')) {
        fixed = fixed.replace('<html>', '<html><head>' + dependencyLoader + '</head>');
    } else {
        // Prepend to document
        fixed = dependencyLoader + fixed;
    }

    logger.debug('[PreviewHtmlUtils] Fixed React dependencies in HTML');
    return fixed;
}

/**
 * Validate HTML structure - checks for common issues
 */
export function validateHtmlStructure(html: string): {
    valid: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    // Check for basic structure
    if (!html.includes('<html') && !html.includes('<body')) {
        issues.push('Missing HTML document structure');
    }

    // Check for unclosed script tags
    const scriptOpens = (html.match(/<script/g) || []).length;
    const scriptCloses = (html.match(/<\/script>/g) || []).length;
    if (scriptOpens !== scriptCloses) {
        issues.push(`Unclosed script tags: ${scriptOpens} opens, ${scriptCloses} closes`);
    }

    // Check for unclosed div tags (common issue)
    const divOpens = (html.match(/<div/g) || []).length;
    const divCloses = (html.match(/<\/div>/g) || []).length;
    if (divOpens !== divCloses) {
        issues.push(`Unclosed div tags: ${divOpens} opens, ${divCloses} closes`);
    }

    return {
        valid: issues.length === 0,
        issues
    };
}
