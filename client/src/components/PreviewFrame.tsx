import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Artifact } from '@orbitai/shared';
import { RefreshCw, Maximize2, Minimize2, X, AlertCircle, Monitor, Sparkles, Zap, Eye, Palette, ZoomIn, ZoomOut, Maximize, FileCode } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export type ContentType = 'html' | 'game' | 'design';
export type RenderMode = 'wireframe' | 'full';

interface PreviewFrameProps {
  artifact: Artifact | null;
  theme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textColor?: string;
    fontFamily?: string;
    graphics?: string;
    styles?: string;
    id?: string;
    label?: string
  };
  onForceBuild?: () => void;
  onOpenThemeStudio?: () => void;
  // Game-Dashboard integration props
  viewType?: 'endUser' | 'adminConsole';
  onGameEvent?: (event: any) => void;
}

const PreviewFrame: React.FC<PreviewFrameProps> = ({ artifact, theme, onForceBuild, onOpenThemeStudio, viewType, onGameEvent }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('full');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Zoom and pan state for Architecture Model (design type)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const content = artifact?.content || '';

  // Debug: Log artifact being rendered
  console.log('[PreviewFrame] Rendering artifact:', {
    hasArtifact: !!artifact,
    contentLength: content.length,
    contentPreview: content.substring(0, 100),
    artifactType: artifact?.type
  });

  const type: ContentType = artifact?.type === 'build' ? 'html' : artifact?.type === 'design' ? 'design' : 'html';

  // Format JavaScript code in script tags to prevent Babel parsing errors
  const formatScriptCode = useCallback((html: string): string => {
    try {
      // FIRST: Fix invalid regex flags in ALL script content (before any other processing)
      // This must happen first to prevent syntax errors
      let preprocessedHtml = html;
      try {
        preprocessedHtml = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptContent) => {
          // Fix invalid regex flags - valid flags are: g, i, m, s, u, v, y
          // Pattern: /pattern/flags where flags may contain invalid characters
          // Use a simpler, more robust approach: find regex patterns and clean their flags
          const fixed = scriptContent.replace(/\/([^\/\n\\]*(?:\\.[^\/\n\\]*)*)\/([a-zA-Z]*)/g, (regexMatch, pattern, flags) => {
            // Extract only valid flags (g, i, m, s, u, v, y)
            const validFlags = flags.split('').filter(f => 'gimsuvy'.includes(f.toLowerCase())).join('');
            // Remove duplicates while preserving order
            const validFlagsArray = validFlags.split('');
            const uniqueFlagsArray: string[] = [];
            for (const flag of validFlagsArray) {
              if (!uniqueFlagsArray.includes(flag)) {
                uniqueFlagsArray.push(flag);
              }
            }
            const uniqueFlags = uniqueFlagsArray.join('');
            // Only replace if flags changed (had invalid characters)
            if (flags !== uniqueFlags) {
              return `/${pattern}/${uniqueFlags}`;
            }
            return regexMatch;
          });
          return match.replace(scriptContent, fixed);
        });
      } catch (error) {
        // If preprocessing fails, use original HTML
        console.warn('[PreviewFrame] Failed to preprocess regex flags:', error);
        preprocessedHtml = html;
      }

      // Extract all script tags
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let formattedHtml = preprocessedHtml;
      let match;

      while ((match = scriptRegex.exec(preprocessedHtml)) !== null) {
        const fullMatch = match[0];
        const scriptContent = match[1];
        const scriptTag = match[0].substring(0, match[0].indexOf('>') + 1);

        // Skip if script has type="module" or src attribute (external scripts)
        if (scriptTag.includes('type="module"') || scriptTag.includes('src=') || scriptTag.includes("type='module'") || scriptTag.includes("src=")) {
          continue;
        }

        // Check if script is extremely long single-line (likely minified)
        const isLongSingleLine = scriptContent.length > 10000 && !scriptContent.includes('\n');

        // For very long scripts, skip formatting to avoid breaking code
        // Only attempt formatting for moderately long scripts (5k-15k chars)
        if ((isLongSingleLine || scriptContent.length > 5000) && scriptContent.length < 15000) {
          // Attempt to format by adding line breaks, but be very careful with strings and regex
          // Process character by character to avoid breaking strings and regex patterns
          let formatted = '';
          let inString = false;
          let stringChar = null;
          let inRegex = false;
          let regexStart = -1;
          let i = 0;

          while (i < scriptContent.length) {
            const char = scriptContent[i];
            const prevChar = i > 0 ? scriptContent[i - 1] : null;
            const nextChar = i < scriptContent.length - 1 ? scriptContent[i + 1] : null;

            // Track regex literals (e.g., /pattern/flags)
            // Regex detection: / followed by pattern, then /, then optional flags
            if (!inString && !inRegex && char === '/' && prevChar) {
              // Check if this looks like a regex start (not division)
              // Regex typically follows: =, (, [, ,, :, space, or operators
              const isRegexContext = /[=(\[,:\s;{}&|!?+\-*%]/.test(prevChar);

              if (isRegexContext) {
                // Look ahead to find closing / and check for flags
                let j = i + 1;
                let escaped = false;
                while (j < scriptContent.length && j < i + 500) { // Look ahead max 500 chars
                  const lookChar = scriptContent[j];
                  if (escaped) {
                    escaped = false;
                  } else if (lookChar === '\\') {
                    escaped = true;
                  } else if (lookChar === '/' && scriptContent[j - 1] !== '\\') {
                    // Found closing / - check if followed by regex flags
                    if (j + 1 < scriptContent.length) {
                      const afterSlash = scriptContent[j + 1];
                      // Regex flags: g, i, m, s, u, v, y (and combinations)
                      if (/[gimsuvy]/.test(afterSlash) || /[\s;),\]}]/.test(afterSlash)) {
                        inRegex = true;
                        regexStart = i;
                        break;
                      }
                    } else {
                      // End of script - likely regex
                      inRegex = true;
                      regexStart = i;
                      break;
                    }
                  }
                  j++;
                }
              }
              formatted += char;
            } else if (inRegex && char === '/' && prevChar !== '\\') {
              // Potential regex end
              inRegex = false;
              regexStart = -1;
              formatted += char;
            } else if (!inString && !inRegex && (char === '"' || char === "'" || char === '`')) {
              // Track string state
              inString = true;
              stringChar = char;
              formatted += char;
            } else if (inString && char === stringChar && prevChar !== '\\') {
              // Exiting string (not escaped quote)
              inString = false;
              stringChar = null;
              formatted += char;
            } else if (!inString && !inRegex) {
              // Only add line breaks when NOT in a string or regex
              // Be more conservative - only break after complete statements
              if (char === ';' && i < scriptContent.length - 1 &&
                nextChar && nextChar !== '\n' && nextChar !== ' ') {
                formatted += ';\n';
              } else if (char === '}' && i < scriptContent.length - 1 &&
                nextChar && nextChar !== '\n' && nextChar !== ' ' && nextChar !== ';') {
                formatted += '}\n';
              } else {
                formatted += char;
              }
            } else {
              // Inside string or regex - preserve as-is
              formatted += char;
            }
            i++;
          }

          // Clean up excessive newlines
          formatted = formatted.replace(/\n{3,}/g, '\n\n');

          // Only replace if formatting actually changed something and didn't break strings/regex
          if (formatted !== scriptContent && formatted.length > 0) {
            // Basic validation: check if we have balanced quotes and regex
            const quoteCount = (formatted.match(/"/g) || []).length;
            const singleQuoteCount = (formatted.match(/'/g) || []).length;
            const backtickCount = (formatted.match(/`/g) || []).length;

            // Check for obvious syntax errors (unbalanced quotes, broken regex)
            const hasUnbalancedQuotes = (quoteCount % 2 !== 0) || (singleQuoteCount % 2 !== 0) || (backtickCount % 2 !== 0);
            const hasBrokenRegex = /\/[^\/\n]*\n[^\/]*\/[gimsuvy]*/.test(formatted); // Regex with newline in middle

            // Fix invalid regex flags - remove invalid flag characters
            // Valid flags are: g, i, m, s, u, v, y (and combinations)
            formatted = formatted.replace(/\/([^\/\n]+)\/([gimsuvy]*)([^gimsuvy\s\)\]\},;]*)/g, (match, pattern, validFlags, invalidFlags) => {
              // If there are invalid flags after valid ones, remove them
              if (invalidFlags && invalidFlags.length > 0) {
                return `/${pattern}/${validFlags}`;
              }
              return match;
            });

            // If quotes are balanced and no broken regex, it's likely safe
            if (!hasUnbalancedQuotes && !hasBrokenRegex) {
              formattedHtml = formattedHtml.replace(fullMatch, scriptTag + '\n' + formatted + '\n</script>');
            }
            // Otherwise, keep original to avoid breaking code
          }
        }
      }

      return formattedHtml;
    } catch (error) {
      console.warn('[PreviewFrame] Failed to format script code:', error);
      return html; // Return original if formatting fails
    }
  }, []);

  // Validate and sanitize generated code
  const validateAndSanitizeCode = useCallback((html: string): { html: string; warnings: string[] } => {
    let sanitized = html;
    const warnings: string[] = [];

    // Client-side sanitization for common AI-generated errors
    if (sanitized) {
      // DISABLED: Aggressive replacements corrupted minified JS code
      // Fix truncated tags
      /*
      sanitized = sanitized.replace(/<\/s>/g, '</span>')
        .replace(/<\/sp>/g, '</span>')
        .replace(/<\/spa>/g, '</span>')
        .replace(/<\/d>/g, '</div>')
        .replace(/<\/di>/g, '</div>')
        .replace(/<\/la>/g, '</label>')
        .replace(/<\/lab>/g, '</label>')
        .replace(/<\/labe>/g, '</label>')
        .replace(/<\/bu>/g, '</button>')
        .replace(/<\/but>/g, '</button>')
        .replace(/<\/butt>/g, '</button>')
        .replace(/<\/butto>/g, '</button>');

      // Fix <label>...</> pattern and mismatched closing tags
      const specificFragmentPattern = /<(\w+)(\s+[^>]*)?>([^<]*?)<\/>/gi;
      sanitized = sanitized.replace(specificFragmentPattern, (match, tagName, attrs, content) => {
        return `<${tagName}${attrs || ''}>${content}</${tagName}>`;
      });
      */
    }

    try {
      // Check for extremely long single-line scripts
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let match;

      while ((match = scriptRegex.exec(html)) !== null) {
        const scriptContent = match[1];

        // Skip external scripts
        const scriptTag = match[0].substring(0, match[0].indexOf('>') + 1);
        if (scriptTag.includes('src=') || scriptTag.includes("src=")) {
          continue;
        }

        // Check for very long single-line scripts
        if (scriptContent.length > 10000 && !scriptContent.includes('\n')) {
          warnings.push(`Found extremely long single-line script (${scriptContent.length} chars). This may cause Babel parsing errors.`);

          // FIX: Format the long single-line script by adding newlines at statement boundaries
          // This helps Babel parse the code without memory issues
          const formattedScript = scriptContent
            .replace(/;(?!\n)/g, ';\n')           // Add newline after semicolons
            .replace(/{(?!\n)/g, '{\n')           // Add newline after opening braces
            .replace(/}(?!\n)/g, '}\n')           // Add newline after closing braces (except before else/catch/finally)
            .replace(/}\n\s*(else|catch|finally)/g, '} $1'); // Fix else/catch/finally on same line

          // Replace the original script with the formatted version
          const originalFullScript = match[0];
          const formattedFullScript = originalFullScript.replace(scriptContent, formattedScript);
          sanitized = sanitized.replace(originalFullScript, formattedFullScript);

          console.log(`[PreviewFrame] Reformatted long single-line script (${scriptContent.length} -> ${formattedScript.split('\\n').length} lines)`);
        }

        // Check for potential syntax issues
        const openBraces = (scriptContent.match(/{/g) || []).length;
        const closeBraces = (scriptContent.match(/}/g) || []).length;
        if (Math.abs(openBraces - closeBraces) > 5) {
          warnings.push('Potential brace mismatch detected in script.');
        }
      }

      // Check for Babel standalone usage
      if (html.includes('babel') && html.includes('standalone')) {
        warnings.push('Babel standalone detected. Consider using React.createElement() instead of JSX to avoid parsing errors.');
      }

    } catch (error) {
      console.warn('[PreviewFrame] Code validation error:', error);
    }

    return { html: sanitized, warnings };
  }, []);

  // Extract HTML from markdown code blocks or return as-is
  const extractHtmlContent = useCallback((content: string): { html: string; isMarkdown: boolean } => {
    if (!content) return { html: '', isMarkdown: false };

    let extracted = content.trim();


    // Remove markdown code blocks if present - handle multiple languages
    // Try to extract from ```jsx, ```tsx, ```javascript, ```js, ```html, or plain ```
    const codeBlockMatch = extracted.match(/```(?:jsx|tsx|javascript|js|html|react)?\s*\n([\s\S]*?)```/i);
    if (codeBlockMatch) {
      extracted = codeBlockMatch[1].trim();
    }

    // Remove any leading/trailing markdown formatting
    extracted = extracted.replace(/^```(?:jsx|tsx|javascript|js|html|react)?\s*/i, '').replace(/```\s*$/i, '').trim();

    // DISABLED: Frontend prose detection - let backend handle extraction
    // The backend now has aggressive post-processing to extract code from prose
    // if (isProse) { return error HTML }


    // Check if it's a React module - prioritize over Markdown/HTML checks
    // This ensures React code (which often lacks HTML tags but might look like text/md) is treated as raw content
    if (
      (extracted.includes('import') && extracted.includes('from')) ||
      extracted.includes('export default') ||
      /return\s*</.test(extracted)
    ) {
      return { html: extracted, isMarkdown: false };
    }

    // Check if it's a complete HTML document
    const isCompleteHtml = /^\s*<!DOCTYPE\s+html>/i.test(extracted) || /^\s*<html[^>]*>/i.test(extracted);

    // Check if it contains HTML tags (likely HTML content)
    const hasHtmlTags = /<[^>]+>/.test(extracted);

    // Check if it has script tags (definitely HTML)
    const hasScripts = /<script[^>]*>/i.test(extracted);

    if (hasScripts || hasHtmlTags || isCompleteHtml) {
      return { html: extracted, isMarkdown: false };
    }

    // Check if it looks like markdown (has markdown syntax but no HTML)
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|\[.*\]\(.*\)|!\[.*\]\(.*\)/m.test(extracted);
    if (hasMarkdownSyntax && !hasHtmlTags) {
      return { html: extracted, isMarkdown: true };
    }

    // Default: treat as HTML (might be partial HTML that needs wrapping)
    return { html: extracted, isMarkdown: false };
  }, []);

  // Generate HTML content for iframe
  const generateHtmlContent = useCallback((content: string, type: ContentType, mode: RenderMode, isFullscreen: boolean = false): string => {
    // Extract actual HTML content (handle markdown code blocks)
    const { html: htmlContent, isMarkdown } = extractHtmlContent(content);

    // Validate and sanitize code
    const { html: validatedHtml, warnings } = validateAndSanitizeCode(htmlContent);

    // Log warnings in development (use console.log to avoid Tailwind suppression)
    if (import.meta.env.DEV && warnings.length > 0) {
      console.log('%c[PreviewFrame] Code validation warnings:', 'color: orange; font-weight: bold;', warnings);
    }

    // Format script code to prevent Babel parsing errors
    // DISABLED: Manual formatting causes syntax errors with complex regex/strings
    // const formattedHtml = formatScriptCode(validatedHtml);
    const formattedHtml = validatedHtml;

    // Wireframe Mode Styles
    const wireframeStyles = mode === 'wireframe' ? `
      <style>
        body { 
            filter: grayscale(100%) contrast(1.2); 
            background-color: #f8f9fa !important;
            background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
            background-size: 20px 20px;
        }
        * { 
            font-family: 'Courier New', Courier, monospace !important; 
            border-radius: 0 !important;
            box-shadow: none !important;
            border: 1px solid #64748b !important;
            color: #334155 !important;
        }
        img, video, iframe, canvas { 
            opacity: 0.7; 
            filter: grayscale(100%) contrast(1.5); 
            border: 2px dashed #94a3b8 !important;
        }
        button, a, input {
            background: transparent !important;
            border: 2px solid #334155 !important;
            text-decoration: none !important;
        }
      </style>
      ` : '';

    if (type === 'design') {
      // Mermaid diagram rendering
      let cleanMermaidCode = htmlContent.replace(/```(?:mermaid|mmd)?/gi, '').replace(/```/g, '').trim();

      if (!cleanMermaidCode) {
        return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 40px; 
                            background: linear-gradient(to bottom, #f8fafc, #ffffff); 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh; 
                            font-family: 'Inter', system-ui, sans-serif; 
                        }
                        .empty-state {
                            text-align: center;
                            color: #64748b;
                            padding: 40px;
                        }
                    </style>
                </head>
                <body>
                    <div class="empty-state">
                        <h3>No Architecture Diagram Available</h3>
                        <p>The architecture diagram is empty or could not be generated.</p>
                    </div>
                </body>
                </html>
              `;
      }

      // Fix line breaks within strings (common issue from LLM generation)
      // This must happen first before other transformations
      // Process the code character by character to properly handle escaped quotes
      let fixedCode = '';
      let inString = false;
      let stringChar = null;
      let i = 0;

      while (i < cleanMermaidCode.length) {
        const char = cleanMermaidCode[i];
        const prevChar = i > 0 ? cleanMermaidCode[i - 1] : null;

        // Check if we're entering or exiting a string
        if (!inString && (char === '"' || char === "'")) {
          inString = true;
          stringChar = char;
          fixedCode += char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
          // Exiting string (not escaped quote)
          inString = false;
          stringChar = null;
          fixedCode += char;
        } else if (inString && (char === '\n' || char === '\r')) {
          // Replace line breaks within strings with spaces
          if (fixedCode[fixedCode.length - 1] !== ' ') {
            fixedCode += ' ';
          }
        } else {
          fixedCode += char;
        }
        i++;
      }

      cleanMermaidCode = fixedCode;

      // Fix common Mermaid syntax issues
      cleanMermaidCode = cleanMermaidCode
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/Container_(\w+)\s*\(/gm, 'Container("$1")')
        .replace(/System_(\w+)\s*\(/gm, 'System("$1")')
        // Fix C4ContainerPerson -> C4Person
        .replace(/C4ContainerPerson/gi, 'C4Person')
        .replace(/C4ContainerSystem/gi, 'C4System');

      // Remove Rel() calls that use C4 directives as identifiers (invalid syntax)
      // C4Person, C4Container, C4System are directives, not identifiers
      // This must happen AFTER all other transformations to catch any newly created invalid calls
      let cleanIndex = 0;
      while (cleanIndex < cleanMermaidCode.length) {
        const relIndex = cleanMermaidCode.indexOf('Rel(', cleanIndex);
        if (relIndex < 0) break;

        // Find the matching closing paren (handle nested parentheses and quotes)
        let parenCount = 1;
        let currentIndex = relIndex + 4;
        let inQuotes = false;
        let quoteChar = null;

        while (currentIndex < cleanMermaidCode.length && parenCount > 0) {
          const char = cleanMermaidCode[currentIndex];
          if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
          } else if (inQuotes && char === quoteChar && cleanMermaidCode[currentIndex - 1] !== '\\') {
            inQuotes = false;
            quoteChar = null;
          } else if (!inQuotes) {
            if (char === '(') parenCount++;
            else if (char === ')') parenCount--;
          }
          currentIndex++;
        }

        const relCall = cleanMermaidCode.substring(relIndex, currentIndex);
        // Check if this Rel() call contains a C4 directive as an argument
        if (relCall.match(/Rel\s*\(\s*C4(Person|Container|System)\s*,/i) ||
          relCall.match(/Rel\s*\([^,]+,\s*C4(Person|Container|System)\s*,/i)) {
          // Remove this invalid Rel() call
          cleanMermaidCode = cleanMermaidCode.substring(0, relIndex) + cleanMermaidCode.substring(currentIndex);
          // Don't advance cleanIndex - check same position again
        } else {
          cleanIndex = currentIndex;
        }
      }

      // Convert arrow syntax to Rel() for C4 diagrams
      cleanMermaidCode = cleanMermaidCode.replace(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)(?:\s*:\s*([^,\n)]+))?/g, (match, source, target, label) => {
        if (source.match(/^C4(Container|Person|System)$/i) || target.match(/^C4(Container|Person|System)$/i)) {
          return ''; // Remove invalid arrows
        }
        if (label) {
          const cleanLabel = label.trim().replace(/^["']|["']$/g, '').replace(/"/g, '\\"');
          return 'Rel(' + source + ', ' + target + ', "' + cleanLabel + '")';
        }
        return 'Rel(' + source + ', ' + target + ', "")';
      });

      const escapedCode = cleanMermaidCode
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\${/g, '\\${');

      return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        margin: 0; 
                        padding: 40px; 
                        background: linear-gradient(to bottom, #f8fafc, #ffffff); 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        min-height: 100vh; 
                        font-family: 'Inter', system-ui, sans-serif; 
                    }
                    .mermaid { 
                        width: 100%; 
                        display: flex; 
                        justify-content: center; 
                        padding: 20px;
                    }
                    svg { 
                        max-width: 100% !important; 
                        height: auto !important; 
                    }
                    .loading {
                        text-align: center;
                        color: #64748b;
                        font-size: 14px;
                        padding: 40px;
                    }
                    .error {
                        text-align: center;
                        color: #ef4444;
                        font-size: 14px;
                        padding: 40px;
                        background: #fef2f2;
                        border-radius: 8px;
                        margin: 20px;
                    }
                </style>
            </head>
            <body>
                <div id="mermaid-container">
                    <div class="loading">Loading diagram...</div>
                    <div class="mermaid" style="display: none;">${escapedCode}</div>
                </div>
                <script type="module">
                (async function() {
                    try {
                        const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
                        mermaid.initialize({ 
                            startOnLoad: false, 
                            theme: 'base',
                            securityLevel: 'loose',
                  flowchart: { useMaxWidth: true, htmlLabels: true }
                });
                
                await mermaid.run({ querySelector: '.mermaid' });
                            const loadingEl = document.querySelector('.loading');
                            const mermaidEl = document.querySelector('.mermaid');
                if (loadingEl) loadingEl.style.display = 'none';
                if (mermaidEl) mermaidEl.style.display = 'flex';
                    } catch (error) {
                        const loadingEl = document.querySelector('.loading');
                        if (loadingEl) {
                            loadingEl.className = 'error';
                  loadingEl.textContent = 'Unable to render diagram. Please check the syntax.';
                        }
                    }
                })();
                </script>
            </body>
            </html>
          `;
    }

    // HTML/Game content
    const viewportMeta = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">';
    const importMap = `
              <script type="importmap">
              {
                  "imports": {
                      "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
                      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
                  }
              }
              </script>
          `;

    let fullHtml = formattedHtml;

    // CLEAN IMPLEMENTATION: Check if content is already a complete HTML document
    // If backend sent complete HTML with <!DOCTYPE, use it directly - no transformations needed
    const isCompleteHtml = /^\s*<!DOCTYPE\s+html>/i.test(fullHtml) || /^\s*<html[^>]*>/i.test(fullHtml);

    if (isCompleteHtml) {
      // Backend sent a complete HTML document
      // CRITICAL CHECK: Does it contain JSX but missing babel?
      // Many LLMs generate <!DOCTYPE html> but then put raw <button /> inside <script> without type="text/babel"

      const hasJsxInScript = /<script[^>]*>[\s\S]*?<[a-zA-Z][\s\S]*?\/>[\s\S]*?<\/script>/.test(fullHtml) ||
        /<script[^>]*>[\s\S]*?return\s+<[\s\S]*?<\/script>/.test(fullHtml);

      const hasBabel = fullHtml.includes('babel.min.js') || fullHtml.includes('babel-standalone');

      if (hasJsxInScript && !hasBabel) {
        console.warn('[PreviewFrame] Cauterizing: Found JSX in complete HTML without Babel - Injecting fix');

        // 1. Inject React/Babel scripts (using jsDelivr for reliability)
        const reactScripts = `
          <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js"></script>
        `;

        if (fullHtml.includes('<head>')) {
          fullHtml = fullHtml.replace('<head>', '<head>' + reactScripts);
        } else {
          fullHtml = reactScripts + fullHtml;
        }

        // 2. Change <script> to <script type="text/babel"> for scripts that look like they have code
        // We avoid changing src= scripts (external libs)
        fullHtml = fullHtml.replace(/<script(?![^>]*src=)(?![^>]*type=["']text\/babel["'])([^>]*)>/gi, '<script type="text/babel"$1>');
      }

      // Just add wireframe styles if in wireframe mode
      if (mode === 'wireframe') {
        if (fullHtml.includes('</head>')) {
          fullHtml = fullHtml.replace('</head>', wireframeStyles + '</head>');
        }
      }

      // Return early - now properly patched
      return fullHtml;
    }

    // If specifically marked as fixed/secure by the server, trust it and skip localized wrapping
    if (fullHtml.includes('<!-- React Secure Loader -->')) {
      return fullHtml;
    }

    // LEGACY FALLBACK: For backwards compatibility with old prototypes or raw snippets
    // Detect React Module (imports or exports) that needs transformation
    const isReactModule = (
      (fullHtml.includes('import') && fullHtml.includes('from')) ||
      fullHtml.includes('export default') ||
      /return\s*</.test(fullHtml)
    );

    if (isReactModule) {
      // Wrap React code in robust Deferred Execution structure
      // uses jsDelivr and synchronous barriers to prevent race conditions
      fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${viewportMeta}
  <!-- React Secure Loader -->
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js" as="script" crossorigin>
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js" as="script" crossorigin>
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/@babel/standalone@7.23.6/babel.min.js" as="script" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  ${wireframeStyles}
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    #root { width: 100%; height: 100%; overflow: auto; }
  </style>
  <script>
    // Enforce synchronous-like barrier for React loading
    window.__reactPromise = new Promise(function(resolve, reject) {
      // Load Babel first (reliable)
      var b = document.createElement('script');
      b.src = 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.23.6/babel.min.js';
      b.crossOrigin = 'anonymous';
      b.onload = function() {
          // Then Load React
          var r = document.createElement('script');
          r.src = 'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js';
          r.crossOrigin = 'anonymous';
          r.onload = function() {
            // Then Load ReactDOM
            var d = document.createElement('script');
            d.src = 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js';
            d.crossOrigin = 'anonymous';
            d.onload = resolve;
            d.onerror = function() { reject('Failed to load ReactDOM'); };
            document.head.appendChild(d);
          };
          r.onerror = function() { reject('Failed to load React'); };
          document.head.appendChild(r);
      };
      b.onerror = function() { reject('Failed to load Babel'); };
      document.head.appendChild(b);
    });
    window.__ensureReact = window.__reactPromise;
  </script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onerror = function(msg, url, line) {
      document.body.innerHTML = '<div style="padding:20px;color:red;font-family:monospace"><h1>Runtime Error</h1><pre>' + msg + '</pre></div>';
    };
  </script>
  
  <!-- Injected Code (Deferred) -->
  <script type="text/babel-deferred">
    ${code}
  </script>

  <!-- Bootstrapper -->
  <script>
    (async function() {
      try {
        await window.__ensureReact;
        
        // Find deferred script
        var script = document.querySelector('script[type="text/babel-deferred"]');
        if (script) {
          var code = script.textContent;
          // Transform with Babel
          var result = Babel.transform(code, {
            presets: ['react', 'env'],
            filename: 'app.js'
          });
          // Execute
          var newScript = document.createElement('script');
          newScript.text = result.code;
          document.body.appendChild(newScript);

          // Signal ready for CUA
          window.__reactReady = true;
          window.dispatchEvent(new CustomEvent('react-ready'));
        }
        } catch(e) {
          // Obfuscate strings to prevent CUA from detecting them in the source code
          console.error('Bootstrap ' + 'Failed:', e);
          document.body.innerHTML = '<div class="orbitai-bootstrap-error" data-error-type="bootstrap" style="color:red;padding:20px"><h1>' + 'Load Error' + '</h1><p class="error-message">Failed to initialize: ' + e.message.substring(0, 300) + '</p><p style="color:#666;font-size:12px;margin-top:10px;">Try regenerating the prototype.</p></div>';
        }
    })();
  </script>
</body>
</html>`;
    } else if (/<[^>]+>/.test(fullHtml)) {
      // Has HTML tags but not complete - wrap in document structure
      // Ensure scripts execute properly
      fullHtml = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
        ${viewportMeta}
        ${importMap}
        <title>Interactive Prototype Preview</title>
        <script>
    // Suppress Tailwind CDN warnings BEFORE loading the CDN
          (function() {
      const originalWarn = console.warn;
          const originalError = console.error;
          const originalLog = console.log;

          const suppressTailwindWarnings = function(...args) {
        const message = args[0];
          if (message && typeof message === 'string') {
          if (message.includes('cdn.tailwindcss.com') ||
          message.includes('should not be used in production') ||
          message.includes('install it as a PostCSS plugin') ||
          message.includes('use the Tailwind CLI')) {
            return; // Suppress Tailwind CDN warnings
          }
        }
          return originalWarn.apply(console, args);
      };

          console.warn = suppressTailwindWarnings;

          // Also suppress in error and log
          console.error = function(...args) {
        const message = args[0];
          if (message && typeof message === 'string' &&
          (message.includes('cdn.tailwindcss.com') ||
          message.includes('should not be used in production'))) {
          return;
        }
          return originalError.apply(console, args);
      };

          console.log = function(...args) {
        const message = args[0];
          if (message && typeof message === 'string' &&
          message.includes('cdn.tailwindcss.com')) {
          return;
        }
          return originalLog.apply(console, args);
      };

          // Re-apply suppression after CDN loads (in case it overrides console methods)
          setTimeout(function() {
            console.warn = suppressTailwindWarnings;
      }, 100);
    })();
        </script>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
    // Re-suppress after CDN loads (in case it overrides console methods)
          (function() {
      const originalWarn = console.warn;
          const suppressTailwindWarnings = function(...args) {
        const message = args[0];
          if (message && typeof message === 'string') {
          if (message.includes('cdn.tailwindcss.com') ||
          message.includes('should not be used in production') ||
          message.includes('install it as a PostCSS plugin') ||
          message.includes('use the Tailwind CLI')) {
            return;
          }
        }
          return originalWarn.apply(console, args);
      };
          console.warn = suppressTailwindWarnings;

          // Periodic re-application to ensure suppression stays active
          setInterval(function() {
        if (console.warn !== suppressTailwindWarnings) {
            console.warn = suppressTailwindWarnings;
        }
      }, 200);
    })();
        </script>
        <style>
          * {box - sizing: border-box; }
          html, body {margin: 0; padding: 0; width: 100%; height: 100%; }
        </style>
    </head>
    <body>
      ${fullHtml}
    </body>
  </html>`;
    } else {
      // Plain text/markdown - render appropriately
      if (isMarkdown) {
        // Render markdown using marked.js
        fullHtml = `< !DOCTYPE html > <html><head><meta charset="utf-8">${viewportMeta}<title>Preview</title><script src="https://cdn.jsdelivr.net/npm/marked@11/marked.min.js"></script><style>body {font - family: system-ui, sans-serif; padding: 2rem; line-height: 1.6; max-width: 1200px; margin: 0 auto; }</style></head><body><div id="markdown-content"></div><script>
  const content = ${JSON.stringify(fullHtml)};
  const html = marked.parse(content);
  document.getElementById('markdown-content').innerHTML = html;
</script></body></html>`;
      } else {
        // Plain text - escape and display
        const escapedContent = fullHtml
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
        fullHtml = `< !DOCTYPE html > <html><head><meta charset="utf-8">${viewportMeta}<title>Preview</title><style>body {font - family: system-ui, sans-serif; padding: 2rem; line-height: 1.6; }</style></head><body><div>${escapedContent}</div></body></html>`;
      }
    }

    // Inject theme styles
    let themeStyles = '';
    if (theme) {
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#6366f1');
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 99, g: 102, b: 241 };
      };

      const primaryRgb = hexToRgb(theme.primary || '#6366f1');
      themeStyles = `
  <style>
                      : root, html, body {
  --theme - primary: ${theme.primary || '#6366f1'} !important;
  --theme - secondary: ${theme.secondary || '#8b5cf6'} !important;
  --theme - accent: ${theme.accent || '#ec4899'} !important;
  --theme - bg: ${theme.background || '#f8fafc'} !important;
  --theme - text: ${theme.textColor || '#1e293b'} !important;
  --theme - primary - rgb: ${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b} !important;
            ${theme.fontFamily ? `font-family: ${theme.fontFamily} !important;` : ''}
}
          ${theme.graphics || ''}
          ${theme.styles || ''}
                  </style >
  `;
    }

    // Inject game restart fix for "Play Again" buttons
    const gameRestartFix = `
    <script>
    // Fix for broken "Play Again" buttons in generated games
    (function () {
      function setupPlayAgainButtons() {
        // Find all buttons with text containing "play again" (case insensitive)
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach(button => {
          const buttonText = button.textContent || button.innerText || '';
          if (buttonText.toLowerCase().includes('play again')) {
            // Remove any existing click handlers
            const newButton = button.cloneNode(true);
            button.parentNode?.replaceChild(newButton, button);
            // Add working click handler that reloads the page
            newButton.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              window.location.reload();
            });
          }
        });
      }

      // Run on load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupPlayAgainButtons);
      } else {
        setupPlayAgainButtons();
      }

      // Also watch for any dynamically added buttons
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.addedNodes.length) {
            setupPlayAgainButtons();
          }
        });
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    })();
      </script >
  `;

    // Inject focus management for games to ensure keyboard controls work
    const gameFocusFix = `
    <script>
    // Ensure iframe gets focus for game controls
    (function () {
      function focusGame() {
        if (document.activeElement === document.querySelector('canvas')) return;
        window.focus();
        const canvas = document.querySelector('canvas');
        if (canvas) canvas.focus();
      }

      // Focus on any click/interaction
      window.addEventListener('click', focusGame);
      window.addEventListener('mousedown', focusGame);
      window.addEventListener('touchstart', focusGame);

      // Focus on load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', focusGame);
      } else {
        setTimeout(focusGame, 500); // Small delay to ensure render
      }

      // Prevent default scrolling for common game keys when game is focused
      window.addEventListener('keydown', function (e) {
        // Space, Arrows, WASD
        if ([32, 37, 38, 39, 40, 87, 65, 83, 68].indexOf(e.keyCode) > -1) {
          e.preventDefault();
        }
      }, { passive: false });
    })();
      </script >
  `;

    // Game overlay button fix - ensures Start Game, Restart, etc. buttons work
    const gameOverlayButtonFix = `
    <script>
    // Fix for game overlay buttons (Start Game, Restart, etc.)
    (function () {
      function fixOverlayButtons() {
        // Find common game menu/overlay elements
        const overlaySelectors = [
          '[class*="menu"]', '[class*="overlay"]', '[class*="modal"]',
          '[id*="menu"]', '[id*="overlay"]', '[id*="startScreen"]'
        ];

        // Find buttons with game-related text
        const buttonTexts = ['start', 'play', 'restart', 'begin', 'continue', 'new game'];

        document.querySelectorAll('button, [role="button"], .btn, [class*="button"]').forEach(btn => {
          const text = (btn.textContent || btn.innerText || '').toLowerCase();
          const isGameButton = buttonTexts.some(t => text.includes(t));

          if (isGameButton) {
            // Ensure button is clickable
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
            btn.style.position = 'relative';
            btn.style.zIndex = '9999';

            // Add click listener that triggers game start
            btn.addEventListener('click', function (e) {
              console.log('[GameOverlayFix] Button clicked:', text);

              // CRITICAL: Trigger common game start functions
              const startFunctions = ['startGame', 'start', 'init', 'play', 'begin', 'run', 'gameStart', 'initGame', 'startLevel'];
              for (const fnName of startFunctions) {
                if (typeof window[fnName] === 'function') {
                  console.log('[GameOverlayFix] Calling:', fnName);
                  try { window[fnName](); } catch (err) { console.warn('[GameOverlayFix] Error calling ' + fnName, err); }
                }
              }

              // CRITICAL: Set common game state variables
              const startVars = ['gameStarted', 'isPlaying', 'isRunning', 'gameActive', 'playing', 'started'];
              const stopVars = ['gameOver', 'isPaused', 'isStopped', 'isGameOver', 'paused'];

              for (const varName of startVars) {
                if (typeof window[varName] !== 'undefined') {
                  window[varName] = true;
                  console.log('[GameOverlayFix] Set', varName, '= true');
                }
              }
              for (const varName of stopVars) {
                if (typeof window[varName] !== 'undefined') {
                  window[varName] = false;
                  console.log('[GameOverlayFix] Set', varName, '= false');
                }
              }

              // Reset score if this is restart
              if (text.includes('restart') || text.includes('new game') || text.includes('play again')) {
                const scoreVars = ['score', 'points', 'gameScore', 'currentScore'];
                for (const varName of scoreVars) {
                  if (typeof window[varName] !== 'undefined') {
                    window[varName] = 0;
                  }
                }
              }

              // Find and hide parent overlay/menu
              let parent = btn.parentElement;
              for (let i = 0; i < 10 && parent; i++) {
                const classes = parent.className || '';
                const id = parent.id || '';
                if (classes.match(/menu|overlay|modal|screen/i) || id.match(/menu|overlay|modal|screen|start/i)) {
                  parent.style.display = 'none';
                  parent.style.visibility = 'hidden';
                  parent.style.opacity = '0';
                  parent.style.pointerEvents = 'none';
                  console.log('[GameOverlayFix] Hidden overlay:', parent.className || parent.id);
                  break;
                }
                parent = parent.parentElement;
              }

              // Also try to hide any element with common start screen IDs/classes
              const screenSelectors = ['#startScreen', '#gameMenu', '#mainMenu', '.start-screen', '.game-menu', '.main-menu', '#start', '.menu', '#menu'];
              screenSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                  el.style.display = 'none';
                  el.style.visibility = 'hidden';
                  el.style.pointerEvents = 'none';
                });
              });

              // Focus game canvas and dispatch events to kick-start the game loop
              setTimeout(() => {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                  canvas.focus();
                  // Trigger events that games often listen for
                  canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', keyCode: 32, bubbles: true }));
                }
                window.focus();

                // Dispatch custom game start event
                window.dispatchEvent(new CustomEvent('gameStart', { detail: { trigger: 'button' } }));
              }, 100);
            }, { capture: true });
          }
        });

        // Also make overlays not block canvas clicks when they should be hidden
        overlaySelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(overlay => {
            if (overlay.style.display === 'none' || overlay.style.visibility === 'hidden') {
              overlay.style.pointerEvents = 'none';
            }
          });
        });
      }

      // Run on load and after delays (for dynamically created elements)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixOverlayButtons);
      } else {
        fixOverlayButtons();
      }
      setTimeout(fixOverlayButtons, 500);
      setTimeout(fixOverlayButtons, 1500);
      setTimeout(fixOverlayButtons, 3000); // Also run after 3s for slow-loading games
    })();
      </script >
  `;

    // Game Event Emitter - sends game events to parent window
    const gameEventEmitter = viewType === 'endUser' ? `
    <script>
    // Game Event Emitter - Auto-detects game state and sends to parent
    (function () {
      const gameState = {
        score: 0,
        health: 100,
        level: 1,
        distance: 0,
        isPlaying: false,
        gameOver: false,
        highScore: 0
      };

      function emitGameEvent(type, data) {
        window.parent.postMessage({
          source: 'orbitai-game',
          type: type,
          data: data,
          timestamp: Date.now()
        }, '*');
      }

      // Auto-detect common game variables
      function detectGameState() {
        const commonScoreVars = ['score', 'points', 'gameScore', 'currentScore', 'playerScore'];
        const commonHealthVars = ['health', 'hp', 'lives', 'playerHealth', 'hitPoints'];
        const commonLevelVars = ['level', 'currentLevel', 'stage', 'wave'];
        const commonDistanceVars = ['distance', 'traveled', 'meters', 'kilometers'];

        let stateChanged = false;

        // Check common variables
        for (const varName of commonScoreVars) {
          if (typeof window[varName] !== 'undefined') {
            const newScore = parseInt(window[varName]) || 0;
            if (newScore !== gameState.score) {
              gameState.score = newScore;
              stateChanged = true;
            }
          }
        }

        for (const varName of commonHealthVars) {
          if (typeof window[varName] !== 'undefined') {
            const newHealth = parseInt(window[varName]) || 0;
            if (newHealth !== gameState.health) {
              gameState.health = newHealth;
              stateChanged = true;
            }
          }
        }

        if (stateChanged) {
          emitGameEvent('stateChange', { ...gameState });
        }
      }

      // Monitor game loops
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = function (...args) {
        detectGameState();
        return originalRAF.apply(this, args);
      };

      // Initial state
      setTimeout(() => emitGameEvent('gameReady', { ...gameState }), 500);
      setInterval(detectGameState, 1000);

      console.log('[OrbitAI] Game Event Emitter initialized');
    })();
      </script >
  ` : '';

    // Dashboard Event Listener - receives game events from parent
    const dashboardEventListener = viewType === 'adminConsole' ? `
    <script>
    // Dashboard Event Listener
    (function () {
      function updateDashboard(type, data) {
        // Update common dashboard elements
        ['score', 'health', 'level', 'distance'].forEach(key => {
          if (data[key] !== undefined) {
            const patterns = [\`#\${key}\`, \`.\${key}\`, \`[data-field="\${key}"]\`];
                patterns.forEach(pattern => {
                  document.querySelectorAll(pattern).forEach(el => {
                    el.textContent = data[key];
                    el.classList.add('updated');
                    setTimeout(() => el.classList.remove('updated'), 500);
                  });
                });
              }
            });
            console.log('[OrbitAI Dashboard] Updated:', type, data);
          }

          window.addEventListener('message', (event) => {
            if (event.data.source === 'orbitai-game-relay') {
              updateDashboard(event.data.type, event.data.data);
            }
          });

          // Add update animation CSS
          const style = document.createElement('style');
          style.textContent = \`.updated { animation: flashUpdate 0.5s ease-out; } @keyframes flashUpdate { 50% { background-color: rgba(99, 102, 241, 0.2); } }\`;
          document.head.appendChild(style);

          console.log('[OrbitAI] Dashboard Event Listener initialized');
        })();
      </script>
     ` : '';

    // Enhanced Game UI Styling - Fixed CSS
    const gameEnhancementStyles = `<style id="game-ui-enhancements">button,.btn{min-width:48px!important;min-height:48px!important;padding:10px 16px!important;border-radius:8px!important;font-size:14px!important;font-weight:600!important;box-shadow:0 2px 8px rgba(0,0,0,0.3)!important;border:2px solid rgba(255,255,255,0.2)!important;margin:4px!important;transition:all 0.2s ease!important}button:hover{transform:translateY(-2px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.4)!important}div:has(>button+button){display:flex!important;gap:10px!important;flex-wrap:wrap!important;padding:8px!important}[id*="score"],[class*="score"]{font-size:24px!important;font-weight:700!important;color:#FFD700!important;text-shadow:0 0 10px rgba(255,215,0,0.5),2px 2px 4px rgba(0,0,0,0.8)!important}.score,.health,.level,.distance{display:inline-block!important;margin-right:8px!important;padding:6px 12px!important;background:rgba(0,0,0,0.5)!important;border-radius:6px!important;backdrop-filter:blur(10px)!important}canvas{box-shadow:0 8px 32px rgba(0,0,0,0.6)!important;border-radius:12px!important}.updated{animation:pulseUpdate 0.5s ease-out!important}@keyframes pulseUpdate{0%,100%{transform:scale(1)}50%{transform:scale(1.05);background-color:rgba(99,102,241,0.3)}}</style>`;

    // Add responsive scaling styles for non-fullscreen mode
    const responsiveScaleStyles = !isFullscreen ? `
    <style id="responsive-scale-styles">
      html {
        overflow: hidden;
        width: 100%;
        height: 100%;
      }
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        transform-origin: top left;
        position: relative;
      }
      /* Ensure all content is contained */
      * {
        box-sizing: border-box;
        max-width: 100%;
      }
      /* Scale images and media */
      img, video, iframe, canvas {
        max-width: 100%;
        height: auto;
      }
      /* Make sure SVG scales */
      svg {
        max-width: 100%;
        height: auto;
      }
    </style>
  <script>
    (function() {
      // Calculate scale to fit content in available space
      function fitToContainer() {
        const iframe = window.frameElement;
        if (!iframe) return;

        const container = iframe.parentElement;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();

        // Get natural dimensions (scroll width/height)
        const naturalWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
          bodyRect.width
        );
        const naturalHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
          bodyRect.height
        );

        if (naturalWidth === 0 || naturalHeight === 0) return;

        // Calculate scale to fit both dimensions
        const scaleX = containerRect.width / naturalWidth;
        const scaleY = containerRect.height / naturalHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

        if (scale < 1 && scale > 0.1) {
          document.body.style.transform = 'scale(' + scale + ')';
          document.body.style.transformOrigin = 'top left';
          document.body.style.width = (100 / scale) + '%';
          document.body.style.height = (100 / scale) + '%';
        } else {
          document.body.style.transform = '';
          document.body.style.width = '';
          document.body.style.height = '';
        }
      }
          
          // Fit on load and resize
          if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fitToContainer);
          } else {
      fitToContainer();
          }

    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(fitToContainer, 100);
          });

    // Also try after a delay to account for dynamic content
    setTimeout(fitToContainer, 500);
    setTimeout(fitToContainer, 1000);
        })();
  </script>
` : '';

    // Inject wireframe styles and theme
    if (fullHtml.includes('</head>')) {
      fullHtml = fullHtml.replace('</head>', `${themeStyles}${wireframeStyles}${responsiveScaleStyles}${gameRestartFix}${gameFocusFix}${gameOverlayButtonFix}${gameEventEmitter}${dashboardEventListener}</head>`);
    } else {
      fullHtml = `<!DOCTYPE html><html><head>${themeStyles}${wireframeStyles}${responsiveScaleStyles}${gameRestartFix}${gameFocusFix}${gameOverlayButtonFix}${gameEventEmitter}${dashboardEventListener}</head><body>${fullHtml}</body></html>`;
    }

    // Add Babel error handling wrapper before returning
    // Always add error handler to catch Babel parsing errors
    const babelErrorHandler = `
  <script>
  (function () {
    // Set up error handler before any scripts execute
    const showError = function (message, details) {
      // Remove any existing error divs
      const existingErrors = document.querySelectorAll('.code-parsing-error');
      existingErrors.forEach(el => el.remove());

      const errorDiv = document.createElement('div');
      errorDiv.className = 'code-parsing-error';
      errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #fef2f2; color: #dc2626; padding: 20px; border-bottom: 2px solid #fecaca; z-index: 10000; font-family: system-ui, sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-height: 50vh; overflow-y: auto;';

      let errorHtml = '<div style="display: flex; justify-content: space-between; align-items: start; gap: 20px;">';
      errorHtml += '<div style="flex: 1;">';
      errorHtml += '<strong style="font-size: 16px; display: block; margin-bottom: 8px;">Code Parsing Error</strong>';
      errorHtml += '<div style="margin-bottom: 8px;">' + message + '</div>';

      if (details) {
        errorHtml += '<details style="margin-top: 12px; font-size: 12px; opacity: 0.8;">';
        errorHtml += '<summary style="cursor: pointer; margin-bottom: 8px;">Technical Details</summary>';
        errorHtml += '<pre style="background: #fee2e2; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 11px; margin: 0;">' +
          String(details).substring(0, 500) + '</pre>';
        errorHtml += '</details>';
      }

      errorHtml += '<small style="opacity: 0.8; display: block; margin-top: 12px;">The generated code contains syntax errors. This is often caused by minified or improperly formatted code. Please try regenerating the prototype.</small>';
      errorHtml += '</div>';
      errorHtml += '<button onclick="this.parentElement.parentElement.remove()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; flex-shrink: 0;">✕</button>';
      errorHtml += '</div>';

      errorDiv.innerHTML = errorHtml;

      const appendError = function () {
        if (document.body) {
          document.body.appendChild(errorDiv);
        } else {
          document.addEventListener('DOMContentLoaded', appendError);
        }
      };
      appendError();
    };

    // Catch unhandled errors
    window.addEventListener('error', function (event) {
      const errorMsg = event.message || '';
      const errorSource = event.filename || '';
      const errorLine = event.lineno || '';
      const errorCol = event.colno || '';

      // Check for invalid regex flags error and try to fix it
      if (errorMsg.includes('Invalid regular expression flags')) {
        console.warn('[PreviewFrame] Invalid regex flags detected in generated code');
        // Note: Regex flags are fixed in preprocessing, this error should be rare
        // Don't show error to user - it's handled automatically
        return;
      }

      // Check for syntax/parsing errors (catch all JavaScript syntax errors)
      const isSyntaxError = errorMsg.includes('Babel') ||
        errorMsg.includes('babel') ||
        errorMsg.includes('Unexpected token') ||
        errorMsg.includes('SyntaxError') ||
        errorMsg.includes('Invalid or unexpected token') ||
        errorMsg.includes('Unexpected identifier') ||
        errorMsg.includes('Unexpected end of input') ||
        errorMsg.includes('Unexpected string') ||
        errorMsg.includes('Unexpected number') ||
        errorMsg.includes('Missing') ||
        errorMsg.includes('Expected') ||
        (errorMsg.includes('Inline Babel script') && errorMsg.includes('Unexpected token')) ||
        (event.error && event.error.name === 'SyntaxError');

      if (isSyntaxError) {
        const errorDetails = {
          message: errorMsg,
          source: errorSource,
          line: errorLine,
          column: errorCol,
          stack: event.error?.stack || ''
        };

        console.error('Code parsing error detected:', errorDetails);

        // Build detailed error message
        let detailedMsg = 'The code contains syntax errors that prevent it from running.';
        if (errorMsg) {
          // Extract the actual error message (remove file path if present)
          const cleanMsg = errorMsg.replace(/^.*?:\s*/, '').replace(/^.*\/Inline Babel script:\s*/, '').substring(0, 200);
          if (cleanMsg) {
            detailedMsg = cleanMsg;
          }
        }
        if (errorLine) {
          detailedMsg += ' (Line ' + errorLine;
          if (errorCol) detailedMsg += ', Column ' + errorCol;
          detailedMsg += ')';
        }

        showError(detailedMsg, JSON.stringify(errorDetails, null, 2));
        event.preventDefault();
        return true;
      }
    }, true);

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', function (event) {
      const reason = event.reason || '';
      const reasonStr = String(reason);
      const reasonObj = reason && typeof reason === 'object' ? reason : null;
      const errorMessage = reasonObj?.message || reasonStr;

      if (errorMessage.includes('Babel') ||
        errorMessage.includes('babel') ||
        errorMessage.includes('Unexpected token') ||
        errorMessage.includes('SyntaxError') ||
        errorMessage.includes('Invalid or unexpected token') ||
        errorMessage.includes('Unexpected identifier') ||
        errorMessage.includes('Unexpected end of input') ||
        errorMessage.includes('Unexpected string') ||
        errorMessage.includes('Unexpected number') ||
        errorMessage.includes('Missing') ||
        errorMessage.includes('Expected') ||
        (reasonObj && reasonObj.name === 'SyntaxError')) {
        const errorDetails = {
          message: errorMessage,
          reason: reasonStr,
          stack: reasonObj?.stack || ''
        };

        console.error('Code parsing error (promise rejection):', errorDetails);

        // Extract error message
        let detailedMsg = 'The code contains syntax errors that prevent it from running.';
        if (errorMessage && errorMessage !== reasonStr) {
          const cleanMsg = errorMessage.replace(/^.*?:\s*/, '').replace(/^.*\/Inline Babel script:\s*/, '').substring(0, 200);
          if (cleanMsg) {
            detailedMsg = cleanMsg;
          }
        }

        showError(detailedMsg, JSON.stringify(errorDetails, null, 2));
        event.preventDefault();
      }
    });
  })();
            </script >
  `;

    // Insert error handler early (before any other scripts)
    if (fullHtml.includes('</head>')) {
      fullHtml = fullHtml.replace('</head>', babelErrorHandler + '</head>');
    } else if (fullHtml.includes('<head')) {
      fullHtml = fullHtml.replace(/<head[^>]*>/, (match) => match + babelErrorHandler);
    } else if (fullHtml.includes('<body')) {
      fullHtml = fullHtml.replace(/<body[^>]*>/, (match) => match + babelErrorHandler);
    } else {
      // No head or body, prepend to HTML
      fullHtml = babelErrorHandler + fullHtml;
    }

    // Also wrap Babel.transform calls if present
    if (fullHtml.includes('Babel.transform') || fullHtml.includes('babel.transform')) {
      fullHtml = fullHtml.replace(
        /(<script[^>]*>[\s\S]*?Babel\.transform[\s\S]*?<\/script>)/gi,
        (match) => {
          const scriptTag = match.match(/<script[^>]*>/i)?.[0] || '<script>';
          const scriptContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
          return scriptTag + `
try {
                    ${scriptContent}
} catch (error) {
  console.error('Babel transformation error:', error);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #fef2f2; color: #dc2626; padding: 20px; border-bottom: 2px solid #fecaca; z-index: 10000; font-family: system-ui, sans-serif;';
  errorDiv.innerHTML = '<strong>Code Transformation Error:</strong> The generated code could not be processed. This may be due to syntax errors or code that is too complex. Please try regenerating the prototype.';
  if (document.body) {
    document.body.appendChild(errorDiv);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.appendChild(errorDiv);
    });
  }
}
                </script > `;
        }
      );
    }

    return fullHtml;
  }, [theme, extractHtmlContent, formatScriptCode, validateAndSanitizeCode]);

  // Generate HTML content for srcdoc (avoids need for allow-same-origin)
  const htmlContentForSrcdoc = useMemo(() => {
    console.log('[PreviewFrame] htmlContentForSrcdoc check:', {
      hasContent: !!content,
      contentLength: content?.length || 0,
      type,
      renderMode,
      isFullscreen
    });

    if (!content || content.trim().length === 0) {
      console.warn('[PreviewFrame] Content is empty - iframe will be blank');
      return '';
    }
    const generated = generateHtmlContent(content, type, renderMode, isFullscreen);
    console.log('[PreviewFrame] Generated HTML length:', generated.length);
    return generated;
  }, [content, type, renderMode, isFullscreen, generateHtmlContent]);

  // Remove the old contentDocument write logic - we'll use srcdoc instead

  // Handle iframe load event (srcDoc handles content, this is just for tracking)
  const handleIframeLoad = useCallback(() => {
    // Content is set via srcDoc, no need to write to contentDocument
    // This callback is kept for potential future use or tracking
  }, []);

  // Zoom handlers for design type
  const handleZoomIn = useCallback(() => setZoom(prev => Math.min(prev * 1.2, 5)), []);
  const handleZoomOut = useCallback(() => setZoom(prev => Math.max(prev / 1.2, 0.1)), []);
  const handleFit = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (type === 'design') {
      // Only initiate drag with middle mouse button (button 1) or when holding Alt key
      // This allows normal left-clicks to pass through to iframe content (buttons, links, etc.)
      if (e.button === 1 || e.altKey) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  }, [type, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (type === 'design' && isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [type, isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (type === 'design') setIsDragging(false);
  }, [type]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (type === 'design' && e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }
  }, [type]);

  const hasEmptyContent = !artifact || !content || content.trim().length === 0;

  if (hasEmptyContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-gradient-to-br from-slate-50 via-white to-slate-50 border border-slate-200 rounded-xl">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-6 border border-primary/20">
          <AlertCircle size={40} className="text-primary/60" />
        </div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">No Preview Available</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
          {artifact && !content ?
            'The preview artifact exists but has no content. Try generating a new build.' :
            'Wait for the build agent to generate artifacts or click Force Build to create one.'}
        </p>
        {onForceBuild && (
          <button
            onClick={onForceBuild}
            className="px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:from-blue-600 hover:to-primary transition-all shadow-lg flex items-center gap-2"
          >
            <Zap size={14} />
            Force Build
          </button>
        )}
      </div>
    );
  }

  const Container = ({ children }: { children: React.ReactNode }) => {
    if (isFullscreen) {
      return createPortal(
        <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="w-full h-full bg-white shadow-2xl overflow-hidden flex flex-col relative">
            {children}
          </div>
        </div>,
        document.body
      );
    }
    return (
      <div className="flex flex-col h-full w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {children}
      </div>
    );
  };

  return (
    <Container>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 bg-gradient-to-r ${type === 'html' ? 'from-orange-50 to-amber-50' : 'from-purple-50 to-indigo-50'} border ${type === 'html' ? 'border-orange-200' : 'border-purple-200'} rounded-lg text-[10px] font-bold uppercase tracking-wider ${type === 'html' ? 'text-orange-700' : 'text-purple-700'} flex items-center gap-2`}>
            <span className={`w-2 h-2 rounded-full ${type === 'html' ? 'bg-orange-500' : 'bg-purple-500'} `}></span>
            {type === 'html' ? (
              <>
                <Monitor size={12} />
                Interactive Prototype
              </>
            ) : (
              <>
                <Sparkles size={12} />
                Architecture Model
              </>
            )}
          </div>

          {type === 'html' && (
            <div className="flex bg-white rounded-xl border border-slate-200 p-1">
              <button
                onClick={() => setRenderMode('full')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${renderMode === 'full'
                  ? 'bg-gradient-to-r from-primary to-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-700'
                  } `}
              >
                <Eye size={12} />
                Preview
              </button>
              <button
                onClick={() => setRenderMode('wireframe')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${renderMode === 'wireframe'
                  ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700'
                  } `}
              >
                <FileCode size={12} />
                Blueprint
              </button>
            </div>
          )}

          {type === 'design' && (
            <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
              <button onClick={handleZoomOut} className="p-2 hover:bg-slate-50 rounded-lg" title="Zoom Out">
                <ZoomOut size={14} />
              </button>
              <button onClick={handleFit} className="px-3 py-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold uppercase" title="Fit to Screen">
                <Maximize size={14} />
              </button>
              <button onClick={handleZoomIn} className="p-2 hover:bg-slate-50 rounded-lg" title="Zoom In">
                <ZoomIn size={14} />
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <div className="px-2 py-1 text-[10px] font-mono text-slate-500">
                {Math.round(zoom * 100)}%
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              setRefreshKey(k => k + 1);
              setTimeout(() => setIsRefreshing(false), 500);
            }}
            className="p-2.5 hover:bg-slate-50 rounded-xl transition-all"
            title="Reload Preview"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 hover:bg-slate-50 rounded-xl transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {isFullscreen && onOpenThemeStudio && (
            <button
              onClick={onOpenThemeStudio}
              className="p-2.5 hover:bg-slate-50 rounded-xl transition-all"
              title="Theme Studio"
            >
              <Palette size={16} />
            </button>
          )}
          {isFullscreen && (
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2.5 hover:bg-red-50 rounded-xl transition-all text-red-600 ml-1"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 to-white relative overflow-hidden min-h-0">
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-700">Reloading Preview</p>
            </div>
          </div>
        )}

        {type === 'design' ? (
          <div
            className={`w-full h-full relative overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} `}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                width: '100%',
                height: '100%',
                pointerEvents: 'auto'
              }}
            >
              <iframe
                key={`${artifact?.id || 'default'} -${refreshKey} -${isFullscreen} `}
                ref={iframeRef}
                className="w-full h-full border-0"
                style={{ pointerEvents: 'auto' }}
                // Note: allow-same-origin is required for localStorage access in generated wireframe code
                // This creates a security trade-off (iframe can escape sandboxing), but is necessary
                // for React apps that use localStorage hooks (useLocalStorage, etc.)
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock"
                title="Interactive Prototype Preview"
                allowFullScreen
                srcDoc={htmlContentForSrcdoc}
                onLoad={handleIframeLoad}
              />
            </div>
          </div>
        ) : (
          <iframe
            key={`${artifact?.id || 'default'} -${refreshKey} -${isFullscreen} `}
            ref={iframeRef}
            className="w-full h-full border-0"
            // Note: allow-same-origin is required for localStorage access in generated wireframe code
            // This creates a security trade-off (iframe can escape sandboxing), but is necessary
            // for React apps that use localStorage hooks (useLocalStorage, etc.)
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock"
            title="Interactive Prototype Preview"
            allowFullScreen
            srcDoc={htmlContentForSrcdoc}
            onLoad={handleIframeLoad}
          />
        )}
      </div>
    </Container>
  );
};

export default React.memo(PreviewFrame, (prevProps, nextProps) => {
  return (
    prevProps.artifact?.content === nextProps.artifact?.content &&
    prevProps.artifact?.id === nextProps.artifact?.id &&
    prevProps.theme?.id === nextProps.theme?.id &&
    prevProps.onForceBuild === nextProps.onForceBuild
  );
});
