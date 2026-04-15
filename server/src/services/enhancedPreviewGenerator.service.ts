import { GeminiService } from './gemini.service.js';
import { logger } from '../utils/logger.js';
// import { Schema, Type } from '@google/genai'; // Unused
import { llmRouter } from './llm/LLMRouter.js';
import { generationStatusService } from './GenerationStatus.service.js';

import { usageTracker } from './llm/UsageTracker.js';
import { sdlcMatchingService } from './sdlcMatching.service.js';
import { standardsMatchingService } from './standardsMatching.service.js';
import { prototypeAssetGenerator } from './prototypeAssetGenerator.service.js';
import { featureCategorizationService } from './featureCategorization.service.js';
import { detectComplexGame, buildPhaserGamePrompt } from './phaserGameHelpers.js';
import designInspirationService, { formatInspirationForPrompt } from './designInspirationService.js';
import { prototypeLearningService } from './prototypeLearning.service.js';

export interface ExtractedRequirements {
  requirements: string[];
  features: string[];
  constraints: string[];
  preferences: string[];
  targetPlatforms: string[]; // e.g., ['Web', 'iOS', 'Android', 'Desktop']
  projectType: 'web' | 'mobile' | 'api' | 'desktop' | 'game' | 'unknown';
}

export interface PreviewGenerationProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface PreviewComponent {
  summary?: string;
  techStack?: string[];
  architectureDiagram?: string;
  wireframeCode?: string;
  risks?: string[];
  projectName?: string;
  recommendedMethodology?: string;
  recommendedStandards?: string[];
  // Multi-view support
  views?: {
    endUser?: {
      preview: string;
      wireframe?: string;
    };
    adminConsole?: {
      preview: string;
      wireframe?: string;
    };
  };
}

export class EnhancedPreviewGenerator {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Clean JSON response from LLM - strips markdown code blocks if present
   * Handles responses like: ```json\n{...}\n``` or ```\n{...}\n```
   */
  private cleanJsonResponse(text: string): string {
    if (!text) return '{}';

    let cleaned = text.trim();

    // Remove markdown code blocks with language specifier
    // Matches: ```json\n...\n``` or ```javascript\n...\n``` etc.
    const codeBlockMatch = cleaned.match(/^```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```$/i);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    // Also handle case where there might be text before/after the code block
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
   * - Fixes </la> → </label>, </bu> → </button>, etc.
   * - Fixes unclosed self-closing tags: <img> → <img />
   */
  private sanitizeJsx(code: string): string {
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
      '</li>': '</li>',
      '</ul>': '</ul>',
      '</sec>': '</section>',
      '</arti>': '</article>',
      '</heade>': '</header>',
      '</foote>': '</footer>',
      // Add anchor tag truncations
      '</an>': '</a>',
      '</anc>': '</a>',
    };

    // Fix truncated tags
    for (const [truncated, full] of Object.entries(truncatedTags)) {
      fixed = fixed.split(truncated).join(full);
    }

    // ROBUST FIX: Handle variations of </s> and truncated spans with regex (case insensitive, whitespace)
    // CRITICAL: Remove </s> patterns entirely as they are often EOS tokens, not broken spans
    fixed = fixed.replace(/<\/\s*s\s*>/gi, '');
    fixed = fixed.replace(/<\/\s*sp\s*>/gi, '</span>');
    fixed = fixed.replace(/<\/\s*spa\s*>/gi, '</span>');

    // Fix mismatched closing tags - handle patterns like <span>...</s> where </s> should be </span>
    // This regex finds opening tags and their corresponding mangled closing tags
    // Added 'a' to the pattern to handle anchor tags
    const openTagRegex = /<(a|span|label|button|div|p|section|article|header|footer|nav|main|aside|h[1-6]|li|ul|ol|td|th|tr|table|thead|tbody)(\s[^>]*)?>/gi;
    let match;
    while ((match = openTagRegex.exec(fixed)) !== null) {
      const tagName = match[1].toLowerCase();
      const shortClose = '</' + tagName.charAt(0) + '>';
      if (fixed.includes(shortClose)) {
        fixed = fixed.split(shortClose).join('</' + tagName + '>');
      }
    }

    // Fix common Arrow Function Syntax Error: `onChange={() = />` -> `onChange={() =>`
    // Matches `{() = />`, `{(e) = />`, `{ (event) = />` etc.
    fixed = fixed.replace(/\{\s*\(([^)]*)\)\s*=\s*\/>/g, '{($1) =>');

    // Fix invalid percentage in style objects: `width: {someVar}%` -> `width: `${someVar}%``
    // Matches patterns like: style={{ ... width: {someVar}% ... }} or just property: {var}%
    // We look for: : {variable}% inside matches.
    // Note: It's safer to target the specific syntax `: \s*\{([^}]+)\}\s*%` since standard JS doesn't allow % after }
    fixed = fixed.replace(/:\s*\{([^}]+)\}\s*%/g, ': `${$1}%`');

    // Fix invalid percentage with literals/vars: `width: 50%` (missing quotes) or `width: val%` (missing quotes/template)
    // This is harder to do safely globally, but we can try common CSS props expected in React native-ish or inline styles.
    // Focusing on the {val}% case identified above first.

    // Also fix `width: val%` where val is a variable name (no braces), followed by comma or closing brace
    // Regex: : \s*([a-zA-Z0-9_]+)%\s*([,}])
    fixed = fixed.replace(/:\s*([a-zA-Z0-9_]+)%\s*([,}])/g, ": `$1%`$2");

    // Fix specific pattern where </> is used to close a known tag with text content
    // Matches: <tag attributes>content</>
    // We capture the tag name, attributes, and content, then reconstruct it with the proper closing tag
    const specificFragmentPattern = /<(\w+)(\s+[^>]*)?>([^<]*?)<\/>/gi;
    fixed = fixed.replace(specificFragmentPattern, (_match, tagName, attrs, content) => {
      return `<${tagName}${attrs || ''}>${content}</${tagName}>`;
    });

    // Fix React fragment shortcut misuse: remaining </> that should be proper closing tags
    // This looks for patterns like <tagName>...</> where the previous regex didn't catch it (maybe nested)
    // Added 'a' to the pattern
    const fragmentPattern = /(<(a|label|span|p|div|button|h[1-6]|section|article|li|td|th)\b[^>]*>[^<]*)<\/>/gi;
    fixed = fixed.replace(fragmentPattern, (_match, content, tagName) => {
      return content + '</' + tagName + '>';
    });

    // Fix self-closing tags that are missing the /> (common in JSX)
    // Convert <img ...> to <img ... /> and similar for other void elements
    const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
    for (const tag of selfClosingTags) {
      // Match <tag ...> that doesn't end with /> and isn't already self-closed
      const selfCloseRegex = new RegExp(`<${tag}([^>]*[^/])>`, 'gi');
      fixed = fixed.replace(selfCloseRegex, (match, attrs) => {
        // Check if already has /> at end
        if (match.endsWith('/>')) return match;
        return `<${tag}${attrs} />`;
      });
      // Also handle <tag> with no attributes
      const simpleRegex = new RegExp(`<${tag}>`, 'gi');
      fixed = fixed.replace(simpleRegex, `<${tag} />`);
    }

    logger.debug(`[EnhancedPreview] JSX sanitized - original: ${code.length} chars, fixed: ${fixed.length} chars`);

    return fixed;
  }


  /**
   * Helper to strip XML tags from input text
   */
  private cleanXmlTags(text: any): string {
    if (!text) return '';
    // Handle non-string inputs (objects, arrays, etc.)
    if (typeof text !== 'string') {
      // If it's an object with a label property (like brainstormed ideas), extract the label
      if (text.label) {
        text = `${text.label}${text.description ? ': ' + text.description : ''}`;
      } else {
        text = String(text);
      }
    }
    return text.replace(/<[^>]+>/g, ' ');
  }

  /**
   * Format brainstorming context for LLM prompt with explicit constraints
   * Prevents hybrid prototypes by clearly specifying game type and anti-patterns
   * Uses the LLM's understanding of context rather than keyword matching
   */
  // @ts-ignore TS6133
  private _formatBrainstormingForPrompt(brainstormingContext: any, projectType: string): string {
    if (!brainstormingContext) return '';

    const sections: string[] = [];
    const ideas = brainstormingContext.ideas || [];

    // 1. Build HIERARCHICAL feature list (root features + their children)
    const rootIdeas = ideas.filter((idea: any) => idea.isRoot || !idea.parentId || idea.parentId === 'CENTER');
    const childIdeas = ideas.filter((idea: any) => !idea.isRoot && idea.parentId && idea.parentId !== 'CENTER');

    const hierarchicalFeatures: string[] = [];
    rootIdeas.forEach((root: any, index: number) => {
      const label = root.label || root.title || root.name || '';
      const desc = root.description || root.desc || '';
      if (label) {
        // Add root feature as major item
        hierarchicalFeatures.push(`${index + 1}. **${label}**${desc ? ': ' + desc : ''}`);

        // Find children of this root
        const children = childIdeas.filter((child: any) => child.parentId === root.id);
        children.forEach((child: any) => {
          const childLabel = child.label || child.title || child.name || '';
          const childDesc = child.description || child.desc || '';
          if (childLabel) {
            hierarchicalFeatures.push(`   - ${childLabel}${childDesc ? ': ' + childDesc : ''}`);
          }
        });
      }
    });

    // Add any orphan children not matched to a root
    const matchedChildIds = new Set(childIdeas.filter((c: any) =>
      rootIdeas.some((r: any) => c.parentId === r.id)
    ).map((c: any) => c.id));

    const orphanChildren = childIdeas.filter((c: any) => !matchedChildIds.has(c.id));
    if (orphanChildren.length > 0) {
      hierarchicalFeatures.push(`${rootIdeas.length + 1}. **Additional Features**`);
      orphanChildren.forEach((child: any) => {
        const label = child.label || child.title || '';
        if (label) {
          hierarchicalFeatures.push(`   - ${label}`);
        }
      });
    }

    // 2. Extract title/goal from brainstorming
    const projectTitle = brainstormingContext.title ||
      brainstormingContext.projectTitle ||
      brainstormingContext.goal ||
      brainstormingContext.userGoal || '';

    // 3. Build the constraint section - LET THE LLM UNDERSTAND THE CONTEXT
    sections.push(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  CRITICAL: BUILD EXACTLY WHAT WAS BRAINSTORMED - NO HYBRID GENRES       ║
║  PROMPT TEMPLATE VERSION: v2.1                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

**PROJECT TITLE FROM BRAINSTORMING:**
"${projectTitle}"

**PROJECT TYPE IDENTIFIED:**
${projectType || 'game/app'}

**BRAINSTORMED FEATURES (HIERARCHICAL - IMPLEMENT ALL):**
${hierarchicalFeatures.length > 0 ? hierarchicalFeatures.join('\n') : 'No specific features listed'}

**ANTI-HYBRID RULES (CRITICAL):**
Before generating, ANALYZE the project title and features above. Then STRICTLY follow these rules:

1. IF the project is a BOARD GAME (Chess, Checkers, Go, etc.):
   - Use CLICK-TO-SELECT then CLICK-TO-DESTINATION movement (NO drag-and-drop)
   - NO keyboard arrow controls for piece movement
   - NO Score/Health/Level/Lives system
   - Turn-based gameplay only
   - Proper board grid with visually distinct pieces
   - For Chess: Include castling, en passant, pawn promotion, stalemate detection
   - Visual feedback: Highlight selected piece, show valid moves, red highlight for check

2. IF the project is an ACTION GAME (Snake, Platformer, Shooter):
   - USE keyboard controls (arrows/WASD)
   - Score/Health/Level IS appropriate
   - Real-time gameplay with smooth animations

3. IF the project is a FORM/DASHBOARD/BUSINESS APP:
   - NO game mechanics whatsoever
   - Standard CRUD operations
   - Professional UI patterns with clear form validation

4. DO NOT MIX GENRES:
   - Chess should NOT have Score/Health/Level
   - Todo app should NOT have game controls
   - Snake game should NOT have click-to-move

**OUTPUT FORMAT REQUIREMENTS:**
- Wrap entire output in \`\`\`html code fence
- Generate a SINGLE self-contained HTML file
- Include ALL CSS in a <style> tag within <head>
- Include ALL JavaScript in a <script> tag before </body>
- Use modern ES6+ JavaScript syntax
- NO external dependencies except CDN links for icons (Lucide, Font Awesome)
- NO placeholder comments like "// TODO" or "// Add logic here"
- ALL functions must be fully implemented and working

**ASSET & RENDERING APPROACH:**
- Generate appropriate visual assets based on project type and context
- Create SVG graphics, CSS shapes, or styled HTML elements as appropriate
- Use professional design patterns that match the project's domain
- Icons and graphics should be self-contained (inline SVG or CSS)

**TECHNICAL REQUIREMENTS:**
- Use CSS Grid or Flexbox for layouts
- Add CSS transitions for smooth interactions (0.2s ease for hover, 0.15s for click feedback)
- Use semantic HTML5 elements (<main>, <section>, <button>)
- Include proper meta viewport for mobile responsiveness
- Add keyboard accessibility: tabindex, focus states, aria-labels on interactive elements
- All pieces/interactive elements must have descriptive aria-labels

**PERFORMANCE HINTS:**
- Use event delegation for repeated click handlers
- Avoid inline styles in JavaScript (use class toggling)
- Use requestAnimationFrame for animations
- Keep DOM queries minimal (cache element references)
- Use CSS transforms instead of top/left for animations

**EXPLICIT DO NOTs:**
- DO NOT use alert() for user feedback - use inline UI elements (modals, toasts)
- DO NOT use document.write()
- DO NOT leave empty onclick="" handlers
- DO NOT use deprecated HTML (center, font, marquee, etc.)
- DO NOT generate broken/partial code
- DO NOT add logger.info statements in production code
- DO NOT use var - always use const or let
- DO NOT use drag-and-drop for board games (must be click-click)

**VISUAL FEEDBACK REQUIREMENTS:**
- Selected elements: Visible highlight (border, background color, or glow)
- Hover states: Subtle color change or scale transform
- Valid moves: Green dots or highlighted squares
- Invalid actions: Red flash or shake animation
- Game end conditions: Clear overlay message (e.g., "Checkmate - White wins!")
- Loading states: Spinner or skeleton UI when appropriate

**TESTING EXPECTATIONS:**
The generated prototype MUST pass these basic tests:
1. Page loads without JavaScript errors in console
2. All buttons/links have click handlers that produce visible changes
3. Form inputs are functional and can be typed into
4. Visual feedback exists for ALL user interactions
5. Core feature flow is completable end-to-end
6. Game/app state persists correctly during interaction

**SUCCESS CRITERIA CHECKLIST:**
Before outputting, verify:
☐ Does it match the PROJECT TITLE exactly?
☐ Are ALL hierarchical features implemented (not just some)?
☐ Is the correct genre/type with no hybrid mixing?
☐ Is all JavaScript functional with no stubs or TODOs?
☐ Does it look polished with consistent styling?
☐ Are interactions responsive with proper feedback?
☐ Is accessibility implemented (aria-labels, keyboard nav)?`);

    // 4. Add key insights if available
    if (brainstormingContext.keyInsights && Array.isArray(brainstormingContext.keyInsights)) {
      sections.push(`\n**KEY INSIGHTS FROM BRAINSTORMING SESSION:**`);
      brainstormingContext.keyInsights.forEach((insight: string) => {
        sections.push(`- ${insight}`);
      });
    }

    // 5. Add selected standards if available
    if (brainstormingContext.selectedStandards && Array.isArray(brainstormingContext.selectedStandards)) {
      sections.push(`\n**REQUIRED STANDARDS TO FOLLOW:**`);
      brainstormingContext.selectedStandards.forEach((std: string) => {
        sections.push(`- ${std}`);
      });
    }

    return sections.join('\n');
  }

  /**
   * Helper to extract HTML from LLM response
   */
  private extractHtml(text: string): string {
    let code = text || '';

    // CRITICAL CHECK: If the response is the XML hierarchy, reject it immediately
    if (code.includes('<idea>') && code.includes('<category>')) {
      logger.warn('[EnhancedPreview] Detected XML hierarchy instead of HTML code. Rejecting.');
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

    return this.sanitizeJsx(code);
  }

  /**
   * Fix React dependencies in generated HTML to ensure proper loading
   * Replaces unreliable CDN sources with more reliable ones (jsDelivr)
   * and ensures proper script ordering
   */
  /**
   * Fix React dependencies in generated HTML to ensure proper loading
   * Enforces strict loading of React from jsDelivr before any app code executes.
   * NO FALLBACKS: Uses the most reliable single source to prevent complexity.
   */
  /**
   * Fix React dependencies in generated HTML to ensure proper loading
   * Enforces strict loading of React from jsDelivr before any app code executes.
   * NO FALLBACKS: Uses the most reliable single source to prevent complexity.
   * STRATEGY: Deferred Execution - Renames scripts to prevent early execution, 
   * then manually transforms and runs them after dependencies are ready.
   */
  private fixReactDependencies(html: string): string {
    if (!html) return html;

    // Check if the HTML uses React
    const usesReact = html.includes('React.') || html.includes('ReactDOM.') ||
      html.includes('react-dom') || html.includes('createRoot');

    if (!usesReact) return html;

    // Check if already has our fix marker
    if (html.includes('<!-- React Secure Loader -->')) {
      return html;
    }

    let fixed = html;

    // 1. STRIP: Remove any existing unreliable CDN links
    fixed = fixed.replace(/<script[^>]*src=["']https:\/\/unpkg\.com\/react[^"']*["'][^>]*><\/script>/g, '');
    fixed = fixed.replace(/<script[^>]*src=["']https:\/\/unpkg\.com\/react-dom[^"']*["'][^>]*><\/script>/g, '');
    // Also strip Babel to ensure we load our reliable version
    fixed = fixed.replace(/<script[^>]*src=["']https:\/\/unpkg\.com\/@babel[^"']*["'][^>]*><\/script>/g, '');

    // 2. DEFER: Rename all Babel scripts so the browser/Babel doesn't auto-execute them early
    // We change type="text/babel" to type="text/babel-deferred"
    // Using a more robust regex that handles variations in spacing, quoting, and other attributes
    fixed = fixed.replace(/<script\b([^>]*)\btype=["']text\/babel["']([^>]*)>/gi, (_match, p1, p2) => {
      return `<script${p1}type="text/babel-deferred"${p2}>`;
    });

    // 3. INJECT: Add reliable scripts + Bootstrapper
    const headIndex = fixed.indexOf('<head>');
    if (headIndex === -1) return fixed;

    const loaderScript = `
    <!-- React Secure Loader -->
    <!-- Preload for performance -->
    <link rel="preload" href="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js" as="script" crossorigin>
    <link rel="preload" href="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js" as="script" crossorigin>
    <link rel="preload" href="https://cdn.jsdelivr.net/npm/@babel/standalone@7.23.6/babel.min.js" as="script" crossorigin>
    
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
    `;

    const insertPos = headIndex + '<head>'.length;
    fixed = fixed.slice(0, insertPos) + loaderScript + fixed.slice(insertPos);

    // 4. BOOTSTRAP: Add script at the end to transform and execute deferred code
    const bodyEndIndex = fixed.lastIndexOf('</body>');
    if (bodyEndIndex !== -1) {
      const bootstrapper = `
      <script>
        // Bootstrapper: Wait for dependencies, then execute deferred scripts
        (async function() {
          try {
            await window.__ensureReact;
            logger.info('[ReactFix] Dependencies loaded. Executing application...');
            
            // Find all deferred scripts
            var scripts = document.querySelectorAll('script[type="text/babel-deferred"]');
            
            // Process each script
            for (var i = 0; i < scripts.length; i++) {
              var script = scripts[i];
              var code = script.textContent;
              
              // Transform with Babel
              var result = Babel.transform(code, {
                presets: ['react', 'env'],
                filename: 'script-' + i + '.js'
              });
              
              // Execute
              var newScript = document.createElement('script');
              newScript.text = result.code;
              document.body.appendChild(newScript);
            }
            
            // Signal ready for CUA
            setTimeout(function() {
               window.__reactReady = true;
               window.dispatchEvent(new CustomEvent('react-ready'));
            }, 100);
            
          } catch(e) {
             logger.error('[ReactFix] Bootstrap Failed:', e);
             document.body.innerHTML = '<div class="orbitai-bootstrap-error" data-error-type="bootstrap" style="color:#ef4444;padding:40px;text-align:center;font-family:sans-serif;"><h1>Application Error</h1><p class="error-message">Failed to initialize React application: ' + e.toString().substring(0, 300) + '</p><p style="color:#64748b;font-size:12px;margin-top:20px;">Try regenerating the prototype or check the browser console for details.</p></div>';
          }
        })();
      </script>
      `;
      fixed = fixed.slice(0, bodyEndIndex) + bootstrapper + fixed.slice(bodyEndIndex);
    }

    return fixed;
  }

  // Expose geminiService for internal use
  getGeminiService(): GeminiService {
    return this.geminiService;
  }

  /**
   * Extract and summarize key requirements from conversation
   */
  async extractRequirements(
    conversationHistory: Array<{ sender: string; text: string }>,
    userGoal: string,
    isRegeneration: boolean = false
  ): Promise<ExtractedRequirements> {
    try {
      // NO LIMIT on features - include full conversation to capture ALL user-selected features
      const conversationText = conversationHistory
        .map((m: any) => `${m.sender}: ${m.text}`)
        .join('\n')
        .substring(0, 50000); // Increased from 10K to 50K to capture all features

      const prompt = `Extract key requirements, features, constraints, and preferences from this conversation.

USER GOAL: "${userGoal.substring(0, 30000)}"

CONVERSATION:
${conversationText}

Analyze and extract:
1. **Requirements**: Specific functional requirements mentioned
2. **Features**: Features or capabilities the user wants
3. **Constraints**: Technical, business, or design constraints
4. **Preferences**: Technology preferences, style preferences, etc.
5. **Target Platforms**: Explicitly mentioned platforms (Web, iOS, Android, etc.)
6. **Project Type**: Detect if this is a web app, mobile app, API, desktop app, game, or unknown

Return JSON with these fields.`;

      // Schema definition removed as it was unused
      /*
      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
          preferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          targetPlatforms: { type: Type.ARRAY, items: { type: Type.STRING } },
          projectType: {
            type: Type.STRING,
            enum: ['web', 'mobile', 'api', 'desktop', 'game', 'unknown']
          }
        },
        required: ['requirements', 'features', 'constraints', 'preferences', 'targetPlatforms', 'projectType']
      };
      */

      // Use internal router for requirements extraction
      const result = await llmRouter.executeInternalTask({
        prompt,
        taskType: 'structured-output',
        agentRole: 'Requirements Analyst',
        requiredCapabilities: ['structuredOutput'],
        isUserFacing: false,
        isCritical: false,
        context: 'internal',
        config: {
          systemInstruction: 'You are a requirements analyst. Extract structured requirements from conversations. Respond only with valid JSON.',
          skipCache: isRegeneration
        }
      });

      // Parse structured output (internal router handles JSON mode)
      const extracted = JSON.parse(this.cleanJsonResponse(result.text || '{}'));

      logger.info('[EnhancedPreview] LLM extracted projectType:', {
        projectType: extracted.projectType,
        userGoal: userGoal.substring(0, 100)
      });

      // VALIDATION: Fix incorrect project type detection
      // The LLM sometimes misclassifies games, but we need to be VERY careful not to
      // misclassify business/web apps as games
      const combinedText = `${userGoal} ${conversationHistory.map(m => m.text).join(' ')}`.toLowerCase();

      // EXPLICIT game indicators (high confidence)
      const explicitGameKeywords = [
        'video game', 'gaming', 'gameplay', 'playable', 'arcade game',
        'platformer', 'rpg game', 'shooter game', 'puzzle game', 'racing game',
        'mario', 'sonic', 'zelda', 'pokemon', 'battlefield', 'fortnite',
        'unity game', 'unreal game', 'godot', 'phaser game', 'game engine',
        'game mechanics', 'game controls', 'game level', 'game character'
      ];

      // Ambiguous keywords that could be game OR non-game
      const ambiguousKeywords = ['player', 'level', 'score', 'character'];

      // Business/web app excluders (if these are present, likely NOT a game)
      const businessExcluders = [
        'platform', 'saas', 'service', 'business', 'enterprise', 'commerce',
        'ticket', 'booking', 'reservation', 'payment', 'checkout', 'cart',
        'dashboard', 'admin', 'management', 'crm', 'erp', 'marketplace',
        'social media', 'blog', 'cms', 'api', 'backend', 'database',
        'authentication', 'user account', 'subscription', 'billing'
      ];

      const hasExplicitGame = explicitGameKeywords.some(kw => combinedText.includes(kw));
      const hasBusinessTerm = businessExcluders.some(kw => combinedText.includes(kw));
      const hasAmbiguousTerm = ambiguousKeywords.some(kw => combinedText.includes(kw));

      // Only classify as game if:
      // 1. Has explicit game keywords, OR
      // 2. Has ambiguous keywords BUT no business terms AND LLM thinks it's a game
      const shouldBeGame = hasExplicitGame ||
        (hasAmbiguousTerm && !hasBusinessTerm && extracted.projectType === 'game');

      if (shouldBeGame && extracted.projectType !== 'game') {
        logger.warn('[EnhancedPreview] LLM misclassified game project - correcting', {
          llmDetected: extracted.projectType,
          correctedTo: 'game',
          matchedKeywords: explicitGameKeywords.filter(kw => combinedText.includes(kw))
        });
        extracted.projectType = 'game';
      } else if (!shouldBeGame && extracted.projectType === 'game') {
        logger.warn('[EnhancedPreview] LLM incorrectly detected game - correcting to web', {
          llmDetected: 'game',
          correctedTo: 'web',
          hasBusinessTerms: hasBusinessTerm,
          businessTerms: businessExcluders.filter(kw => combinedText.includes(kw))
        });
        extracted.projectType = 'web';
      }

      return {
        requirements: extracted.requirements || [],
        features: extracted.features || [],
        constraints: extracted.constraints || [],
        preferences: extracted.preferences || [],
        targetPlatforms: extracted.targetPlatforms || [],
        projectType: extracted.projectType || 'unknown'
      };
    } catch (error: unknown) {
      logger.warn('[EnhancedPreview] Requirements extraction failed, using fallback:', (error instanceof Error ? error.message : String(error)));
      // Fallback: simple detection
      // Be MORE SPECIFIC - don't mark as mobile just because it says "app"
      const goalLower = userGoal.toLowerCase();
      let projectType: ExtractedRequirements['projectType'] = 'unknown';

      // Only mobile if EXPLICITLY mentions mobile platforms
      if (goalLower.includes('mobile app') || goalLower.includes('ios') ||
        goalLower.includes('android') || goalLower.includes('flutter') ||
        goalLower.includes('react native')) {
        projectType = 'mobile';
      } else if (goalLower.includes('api') || goalLower.includes('backend') ||
        goalLower.includes('rest') || goalLower.includes('graphql')) {
        projectType = 'api';
      } else if (goalLower.includes('game')) {
        projectType = 'game';
      } else if (goalLower.includes('desktop') || goalLower.includes('electron')) {
        projectType = 'desktop';
      } else {
        // Default to web for platforms, apps, services, etc.
        projectType = 'web';
      }

      return {
        requirements: conversationHistory
          .filter(m => m.sender === 'user')
          .map(m => m.text)
          .filter(t => t.length > 20),
        features: [],
        constraints: [],
        preferences: [],
        targetPlatforms: [projectType === 'mobile' ? 'Mobile' : 'Web'],
        projectType
      };
    }
  }

  /**
   * Generate summary using fast model
   */
  async generateSummary(
    userGoal: string,
    requirements: ExtractedRequirements,
    researchContext: string = '',
    isRegeneration: boolean = false
  ): Promise<string> {
    try {
      const prompt = `Generate a concise, professional executive summary for this project.

USER GOAL: "${userGoal}"
REQUIREMENTS: ${requirements.requirements.join(', ')}
FEATURES: ${requirements.features.join(', ')}
${researchContext ? `RESEARCH INSIGHTS: ${researchContext.substring(0, 500)}` : ''}

Create a 2-3 sentence executive summary that captures the project's purpose, key features, and value proposition.`;

      // Use internal router for summary generation
      // Use LLMRouter with explicit model for speed (Stage 2 optimization)
      const result = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Solutions Architect',
          taskType: 'text-generation',
          systemInstruction: 'You are a solutions architect. Write concise, professional executive summaries.',
          skipCache: isRegeneration,
          model: 'gemini-2.5-flash'
        },
        requestType: 'generation',
        contextType: 'other',
        routerType: 'internal'
      });

      return result.text || 'No summary generated.';
    } catch (error: unknown) {
      logger.warn('[EnhancedPreview] Summary generation failed:', (error instanceof Error ? error.message : String(error)));
      return `${userGoal.substring(0, 200)}...`;
    }
  }

  /**
   * Generate tech stack using fast model
   */
  async generateTechStack(
    userGoal: string,
    requirements: ExtractedRequirements,
    researchContext: string = '',
    isRegeneration: boolean = false
  ): Promise<string[]> {
    try {
      const prompt = `Recommend the best modern tech stack for this project.

USER GOAL: "${userGoal}"
PROJECT TYPE: ${requirements.projectType}
FEATURES: ${requirements.features.join(', ')}
CONSTRAINTS: ${requirements.constraints.join(', ')}
PREFERENCES: ${requirements.preferences.join(', ')}
TARGET PLATFORMS: ${requirements.targetPlatforms.join(', ')}
${researchContext ? `RESEARCH INSIGHTS: ${researchContext.substring(0, 500)}` : ''}

Return a JSON array of recommended technologies (e.g., ["React", "Node.js", "PostgreSQL"]).
- IF TARGET IS MOBILE: Recommend React Native or Flutter.
- IF TARGET IS WEB: Recommend React, Next.js, etc.
Focus on modern, industry-standard tools appropriate for the project type.`;

      // Schema definition removed as it was unused
      /*
      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          techStack: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['techStack']
      };
      */

      // Use internal router for tech stack generation
      // Use LLMRouter with explicit model for speed
      const result = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Technology Consultant',
          taskType: 'structured-output',
          systemInstruction: 'You are a technology consultant. Recommend appropriate tech stacks. Respond only with valid JSON.',
          skipCache: isRegeneration,
          model: 'gemini-2.5-flash'
        },
        requestType: 'generation',
        contextType: 'other',
        routerType: 'internal'
      });

      const parsed = JSON.parse(this.cleanJsonResponse(result.text || '{}'));
      return parsed.techStack || ['React', 'Node.js'];
    } catch (error: unknown) {
      logger.warn('[EnhancedPreview] Tech stack generation failed:', (error instanceof Error ? error.message : String(error)));
      return ['React', 'Node.js', 'PostgreSQL'];
    }
  }

  /**
   * Generate architecture diagram using powerful model
   */
  async generateArchitecture(
    userGoal: string,
    requirements: ExtractedRequirements,
    techStack: string[],
    fullDescription: string,
    projectIdeas: string = '',
    brainstormingContext: any = null // Added brainstorming context
  ): Promise<string> {
    try {
      // enhance project ideas with brainstorming context
      let enhancedIdeas = projectIdeas;
      if (brainstormingContext) {
        if (brainstormingContext.ideas && Array.isArray(brainstormingContext.ideas)) {
          const brainstormed = brainstormingContext.ideas
            .map((i: any) => `- ${i.label}: ${i.description}`)
            .join('\n');
          enhancedIdeas += `\n\nBRAINSTORMED IDEAS:\n${brainstormed}`;
        }
        if (brainstormingContext.keyInsights && Array.isArray(brainstormingContext.keyInsights)) {
          enhancedIdeas += `\n\nKEY INSIGHTS:\n${brainstormingContext.keyInsights.join('\n')}`;
        }
        if (brainstormingContext.nextSteps) {
          enhancedIdeas += `\n\nPLANNED NEXT STEPS:\n${brainstormingContext.nextSteps}`;
        }
        if (brainstormingContext.selectedStandards && Array.isArray(brainstormingContext.selectedStandards)) {
          enhancedIdeas += `\n\nREQUIRED STANDARDS:\n${brainstormingContext.selectedStandards.join('\n')}`;
        }
      }

      // Prepare clean context for JSON dump (exclude huge message history)
      let contextJson = '';
      if (brainstormingContext) {
        const { messages, projectPreview, ...rest } = brainstormingContext;
        contextJson = JSON.stringify(rest, null, 2);
      }

      const prompt = `Generate a COMPREHENSIVE MermaidJS C4 Container diagram for this project (Level 2).
      
USER GOAL: "${userGoal.substring(0, 500)}..."
PROJECT TYPE: ${requirements.projectType}
TECH STACK: ${techStack.join(', ')}
REQUIREMENTS: ${requirements.requirements.join('; ')}
FEATURES: ${requirements.features.join('; ')}

${enhancedIdeas ? `SPECIFIC PROJECT IDEAS & FEATURES (Must be reflected in components):\n${enhancedIdeas.substring(0, 5000)}\n` : ''}

${contextJson ? `FULL BRAINSTORMING CONTEXT (CRITICAL - ALIGN ARCHITECTURE WITH THIS):
${contextJson}
` : ''}

DESCRIPTION:
${fullDescription.substring(0, 1000)}

Generate a DETAILED MermaidJS C4 Container diagram code.
The diagram MUST be "Level 2 Container" depth, showing the high-level software architecture and how responsibilities are distributed.

CRITICAL REQUIREMENTS:
1. **Directives**: Start with \`C4Container\`.
2. **System Boundary**: Use \`System_Boundary(c1, "${userGoal.substring(0, 50).replace(/"/g, '')}")\` to name the main system.
3. **Components**: Include ALL necessary containers based on the features:
   - **Frontend**: Specific named apps (e.g., "Runner Game Web App", "Admin Dashboard").
   - **Backend**: Specific services (e.g., "Game State API", "Scoreboard Service", "User Auth Service").
   - **Data**: Specific databases (e.g., "Player Profile DB", "High Scores Cache").
   - **External**: Specific external systems (e.g., "Google Auth", "Stripe API").
4. **Relationships**: Use \`Rel(from, to, label, technology)\` to show data flow.
   - Be specific: "sends JSON events", "queries data", "authenticates via".
   - Include protocols: "HTTPS/JSON", "gRPC", "SQL", "WSS".
5. **Naming**: USE DOMAIN-SPECIFIC NAMES.
   - ❌ BAD: "Backend API", "Database", "Frontend"
   - ✅ GOOD: "Order Processing Service", "Inventory DB", "Shopify Storefront", "Recommendation Engine"
   - **Mapping**: For every major feature listed in the PROJECT IDEAS, create a specific Component or Microservice.

Example Structure (adapt to THIS project):
C4Container
Person(user, "Player", "Game player")
System_Boundary(c1, "My Game Project") {
    Container(game, "Game Client", "React/Phaser", "The main game interface")
    Container(api, "Game Server", "Node.js", "Handles game logic and scores")
    ContainerDb(db, "Game DB", "PostgreSQL", "Stores player stats")
}
System_Ext(social, "Social Network", "Sharing scores")
Rel(user, game, "Plays", "HTTPS")
Rel(game, api, "Submits score", "WSS")

Return ONLY the raw Mermaid code. No markdown blocks.`;

      // Use LLM router's dynamic model selection for Architecture generation
      const result = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Software Architect',
          taskType: 'diagram-generation',
          systemInstruction: 'You are a software architect. Generate detailed, accurate, and COMPLEX MermaidJS C4 Container diagrams. Always include the C4Container directive followed by Container/System/Person function calls and Rel() relationships. Never return just the directive without content. Do not be lazy - show the full system complexity.'
        },
        requestType: 'generation',
        contextType: 'wizard',
        routerType: 'internal'
      });

      // Clean up markdown code blocks if present
      let diagram = result.text || '';

      // 1. Try to extract from mermaid code block with flexible regex
      const codeBlockMatch = diagram.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        diagram = codeBlockMatch[1].trim();
      } else {
        // 2. Fallback: Find the start of the C4Container directive
        const startIndex = diagram.search(/C4Container/i);
        if (startIndex !== -1) {
          diagram = diagram.substring(startIndex);
        }
      }

      // ALWAYS apply strict filtering to remove prose/garbage lines
      if (diagram) {
        const lines = diagram.split('\n');
        const validLines: string[] = [];

        // Strict C4/Mermaid line prefixes
        // Includes System_Ext, ContainerDb, etc. via prefix matching
        // Added checks for common C4 aliases just in case
        const validStartRegex = /^\s*(C4Container|title|accTitle|accDescr|Person|System|Container|Rel|Update|Boundary|Enterprise|Component|BiRel|Lay|subgraph|end|class|style|click|link|node|%%|\}|\{|\)|<|#|$)/i;

        for (const line of lines) {
          // Skip code block markers if they remain
          if (line.trim().startsWith('```')) continue;

          // Keep empty lines or valid syntax
          if (line.trim() === '' || validStartRegex.test(line)) {
            validLines.push(line);
          } else {
            logger.debug(`[EnhancedPreview] Dropping invalid Mermaid line: ${line.substring(0, 50)}...`);
          }
        }
        diagram = validLines.join('\n').trim();
      }

      // Validate the diagram is complete
      if (diagram.match(/^C4Container/i)) {
        const lines = diagram.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const hasContent = lines.some(line =>
          /^(Container|System|Person|System_Ext|Container_Ext|Rel|SystemBoundary|ContainerBoundary|Person_Ext|UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig)\(/i.test(line)
        );

        if (!hasContent || lines.length <= 1) {
          logger.warn('[EnhancedPreview] Generated architecture diagram is incomplete after filtering, retrying...');
          // No fallback - throw error to trigger retry
          throw new Error('Generated architecture was incomplete. Please regenerate.');
        }
      }

      logger.info(`[EnhancedPreview] Successfully generated architecture diagram (${diagram.length} chars)`);
      return diagram;
    } catch (error: unknown) {
      logger.error('[EnhancedPreview] Architecture generation failed:', (error instanceof Error ? error.message : String(error)));
      // Re-throw the error instead of using fallback
      throw error;
    }
  }

  /**
   * Build canvas-first game prompt - Prioritizes playable mechanics over UI
   * ULTRA-STRICT: Explicitly forbids dashboard/menu generation
   */
  private buildGamePrompt(
    cleanGoal: string,
    playerFeatures: string[],
    cleanRequirements: string[],
    brainstormingContext: any,
    targetPlatforms: string[]
  ): string {
    // Preprocess features to remove dashboard terminology
    const processedFeatures = playerFeatures.map(f =>
      f.replace(/dashboard/gi, 'HUD overlay')
        .replace(/menu/gi, 'game mode')
        .replace(/settings/gi, 'configuration')
        .replace(/panel/gi, 'display')
    );

    const featuresList = processedFeatures.length > 0
      ? processedFeatures.map((f, i) => `${i + 1}. ${f} → MUST be playable in-game mechanic with keyboard/mouse controls`).join('\n')
      : 'Basic game mechanics';

    const requirementsList = cleanRequirements.length > 0
      ? cleanRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
      : 'No specific requirements';

    return `🚨 CRITICAL GAME GENERATION RULES 🚨

YOU ARE CREATING A PLAYABLE VIDEO GAME, NOT A WEB APPLICATION OR DASHBOARD.

════════════════════════════════════════════════════════════════════
⛔ ABSOLUTE PROHIBITIONS - ANY OF THESE = INSTANT REJECTION:
════════════════════════════════════════════════════════════════════
❌ NEVER create tab navigation UI (e.g., Dashboard tab, Powers tab, Combat tab)
❌ NEVER create button grids for selecting abilities or powers
❌ NEVER use React (no React.createElement, useState, useEffect, JSX)
❌ NEVER use Tailwind CSS (no bg-, text-, flex-, grid-, hover- classes)
❌ NEVER create settings menus, configuration panels, or admin interfaces
❌ NEVER create form inputs (text inputs, dropdowns, sliders) for game configuration
❌ NEVER create static stat displays without gameplay
❌ NEVER put game content inside a sidebar layout
❌ NEVER create clickable cards or buttons as the main interface
❌ NEVER use <div> as the main game container - USE <canvas>

IF YOU GENERATE ANY OF THE ABOVE, THE OUTPUT WILL BE COMPLETELY REJECTED.

════════════════════════════════════════════════════════════════════
✅ MANDATORY REQUIREMENTS - MUST HAVE ALL OF THESE:
════════════════════════════════════════════════════════════════════
✅ HTML5 <canvas> element as the VERY FIRST element inside <body>
✅ Canvas dimensions: minimum 800x600px, ideally fullscreen
✅ Vanilla JavaScript ONLY (NO frameworks, NO React, NO libraries except maybe Three.js for 3D)
✅ requestAnimationFrame game loop running at 60 FPS
✅ WASD/Arrow key event listeners attached on page load
✅ BOTH 'w'/'a'/'s'/'d' AND 'ArrowUp'/'ArrowLeft'/'ArrowDown'/'ArrowRight' MUST work
✅ Support both lowercase (keys['w']) AND uppercase (keys['W']) for WASD
✅ Visible player character/entity drawn on canvas (rectangle, circle, sprite, or 3D model)
✅ Player responds to keyboard input - move when WASD OR Arrow keys pressed
✅ Player CANNOT escape canvas bounds - strict boundary collision required
✅ Game physics: velocity, acceleration, collision with canvas boundaries
✅ At least one type of enemy, obstacle, or interactive object
✅ Collision detection between player and enemies/objects
✅ Score system that increases based on gameplay actions
✅ Health/lives system with game over condition
✅ Game state flow: START → PLAYING → GAME_OVER → RESTART
✅ Visual feedback: particles, color changes, animations
✅ Audio feedback: sound effects for jumps, collisions, collectibles, game over
✅ Programmatic sound generation using Web Audio API (no external files required)

════════════════════════════════════════════════════════════════════
📖 HOW TO INTERPRET FEATURES AS GAMEPLAY MECHANICS:
════════════════════════════════════════════════════════════════════
When you see a feature like "Heat Vision" or "Flight", implement it as:

❌ WRONG: Create a button labeled "Heat Vision" that does nothing
❌ WRONG: Create a "Powers" tab with a list of abilities
❌ WRONG: Create a slider to configure heat vision intensity

✅ CORRECT: Add a key press (e.g., SPACEBAR) that shoots red projectiles from player
✅ CORRECT: Draw projectile sprites on canvas, move them via game loop
✅ CORRECT: Detect collision with enemies, reduce enemy health, show explosion effect
✅ CORRECT: Add cooldown timer (10 seconds), display as progress bar on HUD

FEATURE TRANSLATION EXAMPLES:
- "Flight" → Player can move vertically, add gravity/thrust physics
- "Combat" → Collision detection with enemies causes damage
- "Powers" → Key bindings for special abilities (Q, E, R keys)
- "Dashboard" → HUD overlay showing score, health, ammo (NOT a separate tab)
- "Inventory" → Item sprites that player collects on collision
- "Upgrade" → Power-up pickups that modify player stats in real-time

EVERY FEATURE MUST BE A PLAYABLE MECHANIC, NOT A MENU ITEM.

**PROJECT GOAL:**
${cleanGoal.substring(0, 5000)}

${brainstormingContext?.ideas ? `**BRAINSTORMED GAME IDEAS (Implement as gameplay features):**
${brainstormingContext.ideas.map((i: any) => `- ${i.label}: ${i.description}`).join('\n')}
` : ''}

**FEATURES TO IMPLEMENT AS GAMEPLAY MECHANICS:**
${featuresList}

**REQUIREMENTS:**
${requirementsList}

**TARGET PLATFORMS:** ${targetPlatforms.join(', ') || 'Web'}

**REQUIRED HTML STRUCTURE:**
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanGoal.substring(0, 50)} - Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: 'Arial', sans-serif;
      overflow: hidden;
    }
    #gameContainer {
      position: relative;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      border-radius: 8px;
      overflow: hidden;
    }
    canvas { 
      display: block;
      background: #0f3460;
      cursor: crosshair;
    }
    #ui { 
      position: absolute;
      top: 10px;
      left: 10px;
      color: white;
      font-size: 14px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      z-index: 10;
    }
    #gameOverScreen {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      color: white;
      text-align: center;
      z-index: 100;
    }
    #gameOverScreen.active { display: flex; }
    .btn {
      margin-top: 20px;
      padding: 12px 30px;
      background: #e94560;
      border: none;
      border-radius: 5px;
      color: white;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn:hover { background: #ff6b6b; transform: scale(1.05); }
  </style>
</head>
<body>
  <div id="gameContainer">
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div id="ui">
      <div id="score">Score: 0</div>
      <div id="health">Health: 100</div>
      <div id="level">Level: 1</div>
    </div>
    <div id="gameOverScreen">
      <h1>Game Over</h1>
      <p id="finalScore">Final Score: 0</p>
      <button class="btn" onclick="restartGame()">Play Again</button>
    </div>
  </div>
  
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Reset function to restart the game without page reload
    function restartGame() {
      // Reset game state
      game.state = 'PLAYING';
      game.score = 0;
      game.level = 1;
      game.player.x = canvas.width / 2;
      game.player.y = canvas.height / 2;
      game.player.vx = 0;
      game.player.vy = 0;
      game.player.health = game.player.maxHealth;
      
      // Update UI
      document.getElementById('score').textContent = 'Score: 0';
      document.getElementById('health').textContent = 'Health: 100';
      document.getElementById('level').textContent = 'Level: 1';
      
      // Hide game over screen
      document.getElementById('gameOverScreen').classList.remove('active');
      
      // TODO: Reset enemies, power-ups, and any other game entities
      // If your game has enemies array: enemies = [];
      // If your game has collectibles array: collectibles = [];
    }
    
    // Game state
    const game = {
      state: 'PLAYING', // START_SCREEN, PLAYING, GAME_OVER
      score: 0,
      level: 1,
      player: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: 0,
        vy: 0,
        width: 40,
        height: 40,
        health: 100,
        maxHealth: 100,
        speed: 5
      },
      enemies: [],
      particles: [],
      powerups: []
    };
    
    // 🔴 CRITICAL: Keyboard input handling - DO NOT MODIFY THIS SECTION
    // MUST support BOTH WASD and Arrow keys (uppercase + lowercase)
    const keys = {};
    window.addEventListener('keydown', e => {
      keys[e.key.toLowerCase()] = true;  // lowercase 'w','a','s','d'
      keys[e.key] = true;                // uppercase 'W','A','S','D' and 'ArrowUp', etc.
    });
    window.addEventListener('keyup', e => {
      keys[e.key.toLowerCase()] = false;
      keys[e.key] = false;
    });
    
    // 🔴 CRITICAL: Audio system - DO NOT REMOVE
    // Programmatic sound generation using Web Audio API (no external files needed)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    const sounds = {
      // Jump sound - short upward pitch sweep
      jump: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
      },
      // Collect sound - pleasant chime
      collect: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
      },
      // Hit/damage sound - low harsh tone
      hit: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.2);
      },
      // Game over sound - descending tone
      gameOver: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
      }
    };
    
    // 🔴 CRITICAL: Admin Dashboard Integration - DO NOT REMOVE
    // PostMessage API for real-time control from admin dashboard
    window.addEventListener('message', (event) => {
      // Security: In production, validate event.origin
      
      if (event.data.type === 'UPDATE_VAR') {
        // Update game variable in real-time
        const {var: path, value} = event.data.payload;
        const parts = path.split('.');
        
        // Navigate object path and set value
        let obj = game;
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]]) obj = obj[parts[i]];
        }
        if (obj) {
          obj[parts[parts.length - 1]] = value;
          
          // Send confirmation back to admin
          if (event.source) {
            event.source.postMessage({
              type: 'UPDATE_SUCCESS',
              payload: {var: path, value}
            }, '*');
          }
        }
      }
      
      else if (event.data.type === 'LOAD_LEVEL') {
        // Load custom level from level editor
        loadCustomLevel(event.data.payload);
        event.source.postMessage({type: 'LEVEL_LOADED'}, '*');
      }
      
      else if (event.data.type === 'REQUEST_STATE') {
        // Send current game state to admin dashboard
        event.source.postMessage({
          type: 'STATE_UPDATE',
          payload: {
            score: game.score,
            health: game.player.health,
            level: game.level,
            state: game.state
          }
        }, '*');
      }
    });
    
    // Custom level loading function
    function loadCustomLevel(levelData) {
      // Clear existing entities
      game.enemies = [];
      game.powerups = [];
      
      // Load platforms if provided
      if (levelData.platforms) {
        // For now, just add to existing platforms or replace
        levelData.platforms.forEach(p => {
          // Add platform to game (implementation depends on game structure)
        });
      }
      
      // Load enemies
      if (levelData.enemies) {
        levelData.enemies.forEach(e => {
          game.enemies.push({
            x: e.x || 300,
            y: e.y || 200,
            width: e.width || 32,
            height: e.height || 32,
            vx: 2,
            vy: 0,
            health: e.health || 100
          });
        });
      }
      
      // Reset player to spawn point or default
      if (levelData.spawn) {
        game.player.x = levelData.spawn.x;
        game.player.y = levelData.spawn.y;
      }
      
      // Resume game
      game.state = 'PLAYING';
    }
    
    
    
    // Initialize game entities
    function init() {
      // TODO: Spawn initial enemies
      // TODO: Set up level-specific configuration
      // TODO: Initialize power systems specific to ${cleanGoal}
    }
    
    // Update game logic
    function update(deltaTime) {
      if (game.state !== 'PLAYING') return;
      
      // 🔴 CRITICAL: Player movement - MUST support BOTH control schemes
      // DO NOT remove any of these key checks
      game.player.vx = 0;
      game.player.vy = 0;
      
      // Check BOTH WASD (lowercase/uppercase) AND Arrow keys
      if (keys['w'] || keys['W'] || keys['ArrowUp']) game.player.vy = -game.player.speed;
      if (keys['s'] || keys['S'] || keys['ArrowDown']) game.player.vy = game.player.speed;
      if (keys['a'] || keys['A'] || keys['ArrowLeft']) game.player.vx = -game.player.speed;
      if (keys['d'] || keys['D'] || keys['ArrowRight']) game.player.vx = game.player.speed;
      
      // Normalize diagonal movement
      if (game.player.vx !== 0 && game.player.vy !== 0) {
        const magnitude = Math.sqrt(game.player.vx ** 2 + game.player.vy ** 2);
        game.player.vx = (game.player.vx / magnitude) * game.player.speed;
        game.player.vy = (game.player.vy / magnitude) * game.player.speed;
      }
      
      game.player.x += game.player.vx;
      game.player.y += game.player.vy;
      
      // 🔴 CRITICAL: Boundary collision - player CANNOT escape canvas
      // DO NOT remove or modify these lines
      game.player.x = Math.max(0, Math.min(canvas.width - game.player.width, game.player.x));
      game.player.y = Math.max(0, Math.min(canvas.height - game.player.height, game.player.y));
      
      // TODO: Update enemies (movement, AI, spawning)
      // TODO: Check collisions between player and enemies
      // TODO: Update power-ups and collectibles
      // TODO: Update particles and visual effects
      // TODO: Check win/loss conditions
      
      // Example: Simple enemy AI would go here
      
      // Game over condition
      if (game.player.health <= 0) {
        gameOver();
      }
    }
    
    // Render everything
    function render() {
      // Clear canvas
      ctx.fillStyle = '#0f3460';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw background elements (stars, grid, etc.)
      // TODO: Add themed background for ${cleanGoal}
      
      // Draw player with CHARACTER DESIGN (not just a rectangle!)
      // Use gradients, shadows, and shapes to create a distinct character
      const px = game.player.x + game.player.width / 2;
      const py = game.player.y + game.player.height / 2;
      
      // Player shadow for depth
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(px, py + game.player.height / 2 + 5, game.player.width / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Player body with gradient
      const playerGradient = ctx.createRadialGradient(px - 5, py - 5, 5, px, py, game.player.width / 2);
      playerGradient.addColorStop(0, '#00ffcc');
      playerGradient.addColorStop(0.7, '#00dd99');
      playerGradient.addColorStop(1, '#008866');
      
      ctx.fillStyle = playerGradient;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ffcc';
      ctx.beginPath();
      ctx.arc(px, py, game.player.width / 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Player face/details (eyes, etc.)
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(px - 8, py - 5, 4, 0, Math.PI * 2);
      ctx.arc(px + 8, py - 5, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(px - 8, py - 5, 2, 0, Math.PI * 2);
      ctx.arc(px + 8, py - 5, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // TODO: Draw enemies
      // TODO: Draw power-ups
      // TODO: Draw particles and effects
      // TODO: Draw visual feedback for powers/abilities
      
      // Update UI elements
      document.getElementById('score').textContent = \`Score: \${game.score}\`;
      document.getElementById('health').textContent = \`Health: \${Math.max(0, game.player.health)}\`;
      document.getElementById('level').textContent = \`Level: \${game.level}\`;
    }
    
    // Game over state
    function gameOver() {
      game.state = 'GAME_OVER';
      document.getElementById('finalScore').textContent = \`Final Score: \${game.score}\`;
      document.getElementById('gameOverScreen').classList.add('active');
    }
    
    // Main game loop
    let lastTime = performance.now();
    function gameLoop(timestamp) {
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      
      update(deltaTime);
      render();
      
      requestAnimationFrame(gameLoop);
    }
    
    // Start the game
    init();
    requestAnimationFrame(gameLoop);
    
    logger.info('Game initialized. Use WASD or Arrow keys to move.');
  </script>
</body>
</html>

**YOUR TASK:**
0. 🔴 **CRITICAL**: All code sections marked with "🔴 CRITICAL" in the template above MUST be kept EXACTLY as written. You may ADD to them but NEVER remove or modify the existing code.
1. EXPAND this template with game-specific mechanics for "${cleanGoal}"
2. Implement ALL features from the list above AS GAMEPLAY MECHANICS
3. Add enemies with AI behavior (movement patterns, spawning logic)
4. Add collision detection for all entities
5. Add visual effects (particles on hit, trails, explosions)
6. Add power/ability system with cooldowns
7. Add scoring system tied to gameplay objectives
8. 🔴 **USE SOUND EFFECTS**: Call sounds.jump() when jumping, sounds.collect() for pickups, sounds.hit() for damage, sounds.gameOver() when game ends
9. Make it IMMEDIATELY PLAYABLE - no broken mechanics

**GRAPHICS QUALITY REQUIREMENTS:**

🎨 **PROFESSIONAL VISUALS - NOT BASIC SHAPES!**

**Enemies:**
- Use gradients (createLinearGradient or createRadial Gradient) for depth
- Add eyes, mouths, or character features
- Animate with rotation, pulsing, or bouncing
- Add glow effects with ctx.shadowBlur
- Different colors/designs for different enemy types

**Platforms/Environment:**
- Use gradients for 3D depth effect (light on top, dark on bottom)  
- Add edge highlights with brighter colors
- For grass platforms: green gradient with texture
- For metal platforms: gray gradient with shine
- Add background layers (sky gradient, clouds, stars)

**Collectibles (Coins/Power-ups):**
- Use radial gradients for metallic shine
- Animate rotation (ctx.rotate())
- Add sparkle particles around them
- Pulsing glow effect with changing shadowBlur

**Particles/Effects:**
- Jump: dust particles below player
- Attack: trail particles following projectiles
- Hit: explosion particles with random velocities
- Collect: sparkle burst particles
- Each particle: gradient fill, alpha fade-out over time


**FOCUS SPLIT:** 80% gameplay code, 20% UI/styling. Prioritize PLAYABILITY with PROFESSIONAL GRAPHICS.

Start with <!DOCTYPE html>:`;
  }

  /**
   * Build standard web app prompt - React UI focused
   */
  private buildWebAppPrompt(
    cleanGoal: string,
    playerFeatures: string[],
    cleanRequirements: string[],
    brainstormingContext: any,
    targetPlatforms: string[],
    constraints: string[],
    preferences: string[],
    designInspirationSection?: string // NEW: AI-generated design inspiration
  ): string {
    const featuresList = playerFeatures.length > 0
      ? playerFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')
      : 'No specific features listed';

    const requirementsList = cleanRequirements.length > 0
      ? cleanRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
      : 'No specific requirements listed';

    return `Create a COMPLETE, PRODUCTION-LEVEL React prototype as a single HTML file.

**PROJECT GOAL:**
${cleanGoal.substring(0, 10000)}

${brainstormingContext?.ideas ? `**BRAINSTORMED IDEAS (Implement these specific features):**
${brainstormingContext.ideas.map((i: any) => `- ${i.label}: ${i.description}`).join('\n')}
` : ''}

${designInspirationSection ? `${designInspirationSection}

` : ''}**CRITICAL: IMPLEMENT ALL PLAYER-FACING FEATURES BELOW**
You MUST implement UI components and functionality for EVERY feature listed.
**DO NOT include admin features like analytics, moderation, user management, or backend dashboards**.
This is the END-USER/PLAYER prototype, not the admin console.

${featuresList}

**REQUIREMENTS TO ADDRESS:**
${requirementsList}

**TARGET PLATFORMS:** ${targetPlatforms.join(', ') || 'Web'}

**CONSTRAINTS:** ${constraints.join(', ') || 'None specified'}
**PREFERENCES:** ${preferences.join(', ') || 'None specified'}

===== PRODUCTION-LEVEL QUALITY REQUIREMENTS =====

🎨 **VISUAL DESIGN EXCELLENCE:**
${designInspirationSection ? '- USE THE AI-GENERATED COLOR PALETTE AND FONTS FROM ABOVE' : '- Use modern UI: glassmorphism (backdrop-blur-xl bg-white/10), subtle shadows, smooth gradients'}
- Color system: Define CSS variables (--primary, --secondary, --accent) in a <style> block
- Include DARK MODE toggle: useState for theme, apply dark: classes throughout
- Animations: Add transition-all duration-300 to interactive elements
- Polish: Rounded corners (rounded-xl), proper spacing, visual hierarchy

📷 **HIGH-QUALITY ASSETS:**
- Images: Use Placehold.co (https://placehold.co/800x600?text=Description) - DO NOT use Unsplash.
- Icons: Use Lucide (<i data-lucide="icon-name"></i>)
- Avatars: https://placehold.co/100x100?text=User

📊 **MOCK FUNCTIONALITY (for build phase):**
- Create REALISTIC mock data arrays (10+ items with real names, prices, dates)
- Use useState for ALL interactive features (toggles, forms, selections)
- Add localStorage persistence: useEffect to save/load state
- Implement loading states: const [isLoading, setIsLoading] = useState(false)
- Add error handling with user-friendly error messages

⚡ **INTERACTIVITY & FEEDBACK:**
- Hover effects on ALL clickable elements (hover:scale-105, hover:shadow-lg)
- Click feedback with active states
- Toast notifications for actions (add a simple toast component)
- Modal dialogs for confirmations
- Form validation with inline error messages

🏗️ **BUILD PHASE MARKERS (Critical!):**
Add these TODO comments where real implementation is needed:
- // TODO: Replace mock data with API call to /api/...
- // TODO: Implement authentication check
- // TODO: Connect to database
- // TODO: Add payment processing
- // TODO: Implement file upload to cloud storage
- logger.info('ACTION:', data) for all form submissions and button clicks

♿ **ACCESSIBILITY:**
- All buttons/inputs have aria-label attributes
- Include role attributes where needed
- Keyboard navigation: tabIndex, onKeyDown handlers
- Focus visible: focus:ring-2 focus:ring-blue-500
- Semantic HTML: <header>, <main>, <nav>, <footer>, <article>, <section>

📱 **RESPONSIVE DESIGN:**
- Mobile-first approach using Tailwind breakpoints
- Stack layouts on mobile (flex-col), grid on desktop (md:grid-cols-2, lg:grid-cols-3)
- Touch-friendly: Minimum 44px touch targets
- Hide/show elements: hidden md:block for desktop-only content
- Responsive typography: text-sm md:text-base lg:text-lg

Output this exact format:
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanGoal.substring(0, 50)} - Prototype</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { fontFamily: { sans: ['Inter', 'sans-serif'] } } }
    }
  </script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root { --primary: #3b82f6; --secondary: #8b5cf6; --accent: #ec4899; }
    .glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.1); }
  </style>
</head>
<body class="font-sans antialiased">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useCallback } = React;
    
    // Toast notification component
    function Toast({ message, type, onClose }) {
      useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
      return (
        <div className={\`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg \${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white\`}>
          {message}
        </div>
      );
    }
    
    function App() {
      const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
      const [toast, setToast] = useState(null);
      
      useEffect(() => { 
        if(window.lucide) window.lucide.createIcons();
        localStorage.setItem('darkMode', darkMode);
        document.documentElement.classList.toggle('dark', darkMode);
      }, [darkMode]);
      
      const showToast = (message, type = 'success') => setToast({ message, type });
      
      // TODO: Replace mock data with API calls
      // TODO: Implement authentication
      // Implement ALL features here with proper state management
      
      return (
        <div className={\`min-h-screen \${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}\`}>
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg z-50"
            aria-label="Toggle dark mode"
          >
            <i data-lucide={darkMode ? 'sun' : 'moon'} className="w-5 h-5 text-gray-800 dark:text-white"></i>
          </button>
          
          {/* YOUR COMPLETE UI WITH ALL FEATURES HERE */}
          
          {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        </div>
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
  </script>
</body>
</html>

Start with <!DOCTYPE html>:`;
  }

  /**
   * Generate wireframe code - CLEAN IMPLEMENTATION
   * Forces LLM to output a single complete HTML document with inline React
   * @param viewType - Type of view being generated: 'endUser' (strict game validation) or 'adminConsole' (allow dashboards)
   */
  async generateWireframe(
    userGoal: string,
    requirements: ExtractedRequirements,
    _techStack: string[],
    _architecture: string,
    _fullPrompt: string,
    _isRegeneration: boolean = false,
    brainstormingContext: any = null, // Added brainstorming context
    viewType: 'endUser' | 'adminConsole' = 'endUser' // NEW: View type parameter
  ): Promise<string> {
    const startTime = Date.now();
    logger.info('[EnhancedPreview] Starting wireframe generation...');

    try {
      // Clean inputs to avoid XML contamination from chat history or ideation
      const cleanGoal = this.cleanXmlTags(userGoal);
      const cleanFeatures = requirements.features.map(f => this.cleanXmlTags(f));
      const cleanRequirements = requirements.requirements.map(r => this.cleanXmlTags(r));

      // FEATURE CATEGORIZATION: Separate player-facing from admin features
      const categorized = featureCategorizationService.categorizeFeatures(
        cleanFeatures,
        requirements.projectType
      );

      logger.info(`[EnhancedPreview] Feature categorization: Player=${categorized.playerFacing.length}, Admin=${categorized.adminFacing.length}, Common=${categorized.common.length}`);

      // ONLY use player-facing + common features for the main prototype
      const playerFeatures = [...categorized.playerFacing, ...categorized.common];

      // FORK: Use different prompt builders based on project type
      // Primary: Check requirements.projectType (from LLM extraction)
      let isGame = requirements.projectType === 'game';

      // FALLBACK: If LLM didn't detect game, check userGoal for explicit game keywords
      // This handles cases where requirements extraction failed or returned incorrect type
      if (!isGame) {
        const goalLower = cleanGoal.toLowerCase();
        const gameKeywords = [
          'game', 'gaming', 'gameplay', 'playable', 'arcade', 'platformer', 'rpg',
          'shooter', 'puzzle', 'racing', 'phaser', 'godot', 'unity', 'unreal'
        ];
        const hasGameKeyword = gameKeywords.some(kw => goalLower.includes(kw));
        if (hasGameKeyword) {
          logger.warn(`[EnhancedPreview] FALLBACK: Detected game from userGoal keywords despite requirements.projectType='${requirements.projectType}'. Forcing isGame=true`);
          isGame = true;
        }
      }

      // Detect if game complexity requires Phaser framework
      const usePhaser = isGame && detectComplexGame(playerFeatures, cleanRequirements);
      if (usePhaser) {
        logger.info('[EnhancedPreview] Complex game detected - using Phaser framework');
      }

      // ======================================================================
      // DESIGN INSPIRATION: Fetch AI-generated colors, fonts, and trends
      // ======================================================================
      let designInspiration = null;
      let inspirationPromptSection = '';

      if (!isGame) {
        // Only fetch design inspiration for web apps (games have their own style systems)
        try {
          designInspiration = await designInspirationService.getDesignInspiration({
            projectType: requirements.projectType,
            mood: brainstormingContext?.style || 'modern',
            style: brainstormingContext?.style || 'modern'
          });
          inspirationPromptSection = formatInspirationForPrompt(designInspiration);
          logger.info(`[EnhancedPreview] Design inspiration loaded: ${designInspiration.colors.colors.length} colors, ${designInspiration.fonts.heading}/${designInspiration.fonts.body} fonts`);
        } catch (err: unknown) {
          logger.warn('[EnhancedPreview] Failed to load design inspiration, proceeding without:', err);
        }
      }

      const finalPrompt = usePhaser
        ? buildPhaserGamePrompt(
          cleanGoal,
          playerFeatures,
          cleanRequirements,
          brainstormingContext,
          requirements.targetPlatforms || []
        )
        : isGame
          ? this.buildGamePrompt(
            cleanGoal,
            playerFeatures,
            cleanRequirements,
            brainstormingContext,
            requirements.targetPlatforms || []
          )
          : this.buildWebAppPrompt(
            cleanGoal,
            playerFeatures,
            cleanRequirements,
            brainstormingContext,
            requirements.targetPlatforms || [],
            requirements.constraints || [],
            requirements.preferences || [],
            inspirationPromptSection // Pass design inspiration to prompt builder
          );

      // Use game-specific system instruction for games
      // For web apps, include design inspiration context
      const systemInstruction = usePhaser
        ? 'You are an expert Phaser 3 game developer. Output ONLY complete playable Phaser games with physics and sprites, NOT menu interfaces. Focus on GAMEPLAY FIRST. Start with <!DOCTYPE html>.'
        : isGame
          ? 'You are an expert HTML5 game developer. Output ONLY complete playable canvas games with game loops, NOT menu interfaces or button grids. Focus on GAMEPLAY FIRST. Start with <!DOCTYPE html>.'
          : designInspiration
            ? `Output only HTML starting with <!DOCTYPE html>. No explanation. You are an expert React developer with excellent UI/UX skills.

DESIGN SYSTEM (use these exact values):
- Primary: ${designInspiration.colors.colors[0]}
- Secondary: ${designInspiration.colors.colors[1]}
- Accent: ${designInspiration.colors.colors[2]}
- Fonts: ${designInspiration.fonts.heading} / ${designInspiration.fonts.body}
Apply ${designInspiration.trends.slice(0, 3).join(', ')} design patterns.`
            : 'Output only HTML starting with <!DOCTYPE html>. No explanation. You are an expert React developer.';

      logger.info(`[EnhancedPreview] Sending ${usePhaser ? 'PHASER' : isGame ? 'CANVAS' : 'WEB APP'} wireframe request via LLM router...${designInspiration ? ' [with design inspiration]' : ''}`);

      const result = await Promise.race([
        llmRouter.executeWithFallback({
          prompt: finalPrompt,
          context: {
            agentRole: isGame ? 'HTML5 Game Developer' : 'React Developer',
            taskType: 'code-generation',
            systemInstruction
          },
          requestType: 'generation',
          contextType: 'wizard',
          routerType: 'internal'
        }),
        new Promise<any>((_, reject) => {
          // Increased timeout to 180s (3 mins) to allow for complex full-page code generation
          setTimeout(() => reject(new Error('Wireframe generation timed out after 180s')), 180000);
        })
      ]);

      const elapsed = Date.now() - startTime;
      logger.info(`[EnhancedPreview] Gemini responded in ${elapsed}ms`);
      const text = result.text || '';
      let htmlContent = this.extractHtml(text);

      // Fix React dependencies to prevent blank screen issues
      htmlContent = this.fixReactDependencies(htmlContent);

      // Enhanced Validation
      if (!htmlContent) {
        throw new Error('Generated content was empty or rejected as invalid XML');
      }

      if (!htmlContent.toLowerCase().includes('<!doctype html') && !htmlContent.toLowerCase().includes('<html')) {
        throw new Error('Generated content does not appear to be a valid HTML document (missing DOCTYPE or html tag)');
      }

      // Log validation parameters BEFORE checking
      logger.info('[EnhancedPreview] 🎮 GAME VALIDATION CHECK:', {
        isGame,
        viewType,
        willRunValidation: isGame && viewType === 'endUser',
        htmlLength: htmlContent.length
      });

      //  STRICT GAME VALIDATION: Reject dashboards, ensure playable game
      // BUT ONLY FOR END-USER VIEW - Admin console is ALLOWED to be a dashboard
      if (isGame && viewType === 'endUser') {
        logger.info('[EnhancedPreview] 🔍 Running strict game validation...');
        // Phase 1: Check for REQUIRED game elements
        const hasCanvas = htmlContent.includes('<canvas');
        const hasGameLoop = htmlContent.includes('requestAnimationFrame');
        const hasKeyboard = htmlContent.includes('keydown') || htmlContent.includes('addEventListener');

        logger.info('[EnhancedPreview] Phase 1 - Required Elements:', {
          hasCanvas,
          hasGameLoop,
          hasKeyboard
        });

        // Phase 2: Check for FORBIDDEN dashboard patterns
        const hasReact = htmlContent.includes('React.') ||
          htmlContent.includes('useState') ||
          htmlContent.includes('useEffect') ||
          htmlContent.includes('ReactDOM.');

        const tailwindMatches = (htmlContent.match(/class="[^"]*\b(bg-|text-|flex-|grid-|hover:)/g) || []).length;
        const hasTailwind = tailwindMatches > 15; // Allow minimal utility classes for HUD

        const hasTabs = htmlContent.includes('role="tablist"') ||
          htmlContent.includes('data-tab') ||
          htmlContent.match(/<button[^>]*>(?:Dashboard|Powers|Combat|Settings|Missions)/i);

        const buttonCount = (htmlContent.match(/<button/g) || []).length;
        const hasButtonGrid = buttonCount > 12; // Allow a few buttons for start/restart

        const hasFormInputs = (htmlContent.match(/<input|<select|<textarea/g) || []).length > 2;

        logger.info('[EnhancedPreview] Phase 2 - Forbidden Patterns:', {
          hasReact,
          hasTailwind,
          tailwindMatches,
          hasTabs: !!hasTabs,
          buttonCount,
          hasButtonGrid,
          hasFormInputs
        });

        // REJECTION: If any dashboard pattern found, throw error
        const dashboardPatterns = [];
        if (hasReact) dashboardPatterns.push('React framework detected');
        if (hasTailwind) dashboardPatterns.push(`Excessive Tailwind usage (${tailwindMatches} instances)`);
        if (hasTabs) dashboardPatterns.push('Tab navigation UI detected');
        if (hasButtonGrid) dashboardPatterns.push(`Button grid detected (${buttonCount} buttons)`);
        if (hasFormInputs) dashboardPatterns.push('Form inputs detected (configuration UI)');

        if (dashboardPatterns.length > 0) {
          logger.error('[EnhancedPreview] DASHBOARD DETECTED - Rejecting output:', {
            patterns: dashboardPatterns,
            buttonCount,
            tailwindMatches
          });
          throw new Error(
            `Generated output is a DASHBOARD/UI interface, not a playable game. ` +
            `Detected patterns: ${dashboardPatterns.join(', ')}. ` +
            `This will trigger LLM retry with stricter instructions.`
          );
        }

        // REQUIREMENT: Ensure all game elements present
        if (!hasCanvas || !hasGameLoop || !hasKeyboard) {
          logger.warn('[EnhancedPreview] Game prototype missing essential elements:', {
            hasCanvas,
            hasGameLoop,
            hasKeyboard
          });
          throw new Error(
            `Game prototype incomplete - missing: ${[
              !hasCanvas && 'canvas element',
              !hasGameLoop && 'requestAnimationFrame game loop',
              !hasKeyboard && 'keyboard controls'
            ].filter(Boolean).join(', ')}`
          );
          // RELAXED VALIDATION: Allow DOM-based games if they have some interactive elements
          // Don't throw error, just warn and proceed
          logger.warn('[EnhancedPreview] Proceeding with DOM-based game despite missing Canvas/GameLoop');
        }

        logger.info('[EnhancedPreview] \u2705 Game validation PASSED - No dashboard patterns, all game elements present');
      }

      logger.info(`[EnhancedPreview] ${isGame ? 'GAME' : 'WEB APP'} wireframe generated successfully via Router (${htmlContent.length} chars)`);
      return htmlContent;

    } catch (error: unknown) {
      logger.error(`[EnhancedPreview] Wireframe generation failed: ${(error instanceof Error ? error.message : String(error))}`);

      // Detailed logging for debugging
      if ((error as any).lastModel) {
        logger.error(`[EnhancedPreview] Failed model: ${(error as any).lastModel}`);
      }

      // Re-throw error instead of using fallback - no more placeholders
      throw error;
    }
  }

  /**
   * Generate a fallback dashboard template when LLM generation fails/times out
   * This ensures the dashboard always loads with basic functionality
   */
  private generateFallbackDashboard(gameGoal: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game Dashboard - ${gameGoal.substring(0, 30)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root { --primary: #6366f1; --secondary: #8b5cf6; --accent: #ec4899; }
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
    .glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.1); }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 min-h-screen">
  <div id="root"></div>
  <script>
    // PostMessage communication with game iframe
    function sendGameUpdate(variable, value) {
      window.parent.postMessage({
        type: 'UPDATE_VAR',
        payload: { var: variable, value: value }
      }, '*');
      logger.info('📤 Sent to game:', variable, '=', value);
    }

    function requestGameState() {
      window.parent.postMessage({ type: 'REQUEST_STATE' }, '*');
    }

    // Listen for state updates from game
    window.addEventListener('message', (e) => {
      if (e.data.type === 'STATE_UPDATE') {
        logger.info('📥 Game state received:', e.data.payload);
        updateGameStats(e.data.payload);
      }
    });

    function updateGameStats(state) {
      const statsEl = document.getElementById('game-stats');
      if (statsEl && state) {
        statsEl.innerHTML = \`
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-indigo-500/20 p-2 rounded">
              <div class="text-xs text-indigo-300">Score</div>
              <div class="text-lg font-bold text-white">\${state.score || 0}</div>
            </div>
            <div class="bg-purple-500/20 p-2 rounded">
              <div class="text-xs text-purple-300">Level</div>
              <div class="text-lg font-bold text-white">\${state.level || 1}</div>
            </div>
            <div class="bg-pink-500/20 p-2 rounded">
              <div class="text-xs text-pink-300">Lives</div>
              <div class="text-lg font-bold text-white">\${state.lives || 3}</div>
            </div>
            <div class="bg-cyan-500/20 p-2 rounded">
              <div class="text-xs text-cyan-300">Health</div>
              <div class="text-lg font-bold text-white">\${state.health || 100}%</div>
            </div>
          </div>
        \`;
      }
    }

    // Request initial state
    setTimeout(() => requestGameState(), 500);
    setInterval(() => requestGameState(), 2000);

    // Render dashboard
    const app = \`
      <div class="container mx-auto p-6 max-w-4xl">
        <div class="bg-slate-800/60 backdrop-blur-lg rounded-2xl shadow-2xl border border-indigo-500/20 overflow-hidden">
          <!-- Header -->
          <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
            <h1 class="text-2xl font-bold text-white flex items-center gap-3">
              <i data-lucide="gamepad-2" class="w-8 h-8"></i>
              Game Dashboard
            </h1>
            <p class="text-indigo-100 text-sm mt-1">${gameGoal.substring(0, 100)}</p>
          </div>

          <!-- Controls Section -->
          <div class="p-6 space-y-6">
            <div class="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <i data-lucide="sliders" class="w-5 h-5 text-indigo-400"></i>
                Game Controls
              </h2>
              
              <!-- Player Speed -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Player Speed: <span id="speed-value" class="text-indigo-400">300</span>
                </label>
                <input type="range" min="100" max="500" value="300" 
                  class="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  oninput="document.getElementById('speed-value').textContent = this.value; sendGameUpdate('player.speed', parseFloat(this.value))">
              </div>

              <!-- Jump Height -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Jump Height: <span id="jump-value" class="text-purple-400">400</span>
                </label>
                <input type="range" min="200" max="600" value="400"
                  class="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  oninput="document.getElementById('jump-value').textContent = this.value; sendGameUpdate('player.jumpHeight', parseFloat(this.value))">
              </div>

              <!-- Enemy Spawn Rate -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Enemy Spawn Rate (per second)
                </label>
                <input type="number" min="0.5" max="5" step="0.5" value="2"
                  class="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  oninput="sendGameUpdate('enemySpawnRate', parseFloat(this.value))">
              </div>

              <!-- Difficulty -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Difficulty Level
                </label>
                <select class="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  onchange="sendGameUpdate('game.difficulty', this.value)">
                  <option value="easy">Easy</option>
                  <option value="normal" selected>Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <!-- Reset Button -->
              <button onclick="sendGameUpdate('game.reset', true); alert('Game reset signal sent!');"
                class="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2">
                <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                Reset to Defaults
              </button>
            </div>

            <!-- Live Stats -->
            <div class="bg-slate-700/50 rounded-xl p-5 border border-slate-600">
              <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <i data-lucide="activity" class="w-5 h-5 text-cyan-400"></i>
                Live Game Stats
              </h2>
              <div id="game-stats" class="text-slate-400 text-sm">
                Waiting for game data...
              </div>
            </div>

            <!-- Instructions -->
            <div class="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
              <p class="text-sm text-indigo-200">
                <i data-lucide="info" class="w-4 h-4 inline mr-1"></i>
                <strong>How it works:</strong> Adjust the controls above to modify game behavior in real-time. 
                Changes are sent to the game via PostMessage API.
              </p>
            </div>
          </div>
        </div>
      </div>
    \`;

    document.getElementById('root').innerHTML = app;
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

    logger.info('✅ Fallback game dashboard loaded successfully');
  </script>
</body>
</html>`;
  }

  /**
   * Generate fallback admin console for business platforms
   */
  private generateFallbackAdminConsole(projectGoal: string, adminFeatures: string[]): string {
    const projectName = projectGoal.substring(0, 50) || 'Admin Console';
    const featuresDesc = adminFeatures.length > 0
      ? adminFeatures.slice(0, 3).join(', ')
      : 'Management Dashboard';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Admin Console</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;

    function AdminConsole() {
      const [activeSection, setActiveSection] = useState('dashboard');
      
      // Sample data
      const metrics = [
        { label: 'Total Items', value: '1,234', change: '+12%', icon: 'package' },
        { label: 'Active Users', value: '567', change: '+8%', icon: 'users' },
        { label: 'Revenue', value: '$12,345', change: '+15%', icon: 'dollar-sign' },
        { label: 'Pending', value: '23', change: '-5%', icon: 'clock' }
      ];

      const recentItems = [
        { id: '001', name: 'Sample Item 1', status: 'Active', date: '2024-01-15' },
        { id: '002', name: 'Sample Item 2', status: 'Pending', date: '2024-01-14' },
        { id: '003', name: 'Sample Item 3', status: 'Active', date: '2024-01-13' },
        { id: '004', name: 'Sample Item 4', status: 'Completed', date: '2024-01-12' }
      ];

      return (
        <div className="flex h-screen bg-slate-50">
          {/* Sidebar */}
          <aside className="w-64 bg-slate-900 text-white flex flex-col">
            <div className="p-6 border-b border-slate-700">
              <h1 className="text-xl font-bold">${projectName}</h1>
              <p className="text-xs text-slate-400 mt-1">Admin Console</p>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
                { id: 'manage', label: 'Management', icon: 'settings' },
                { id: 'analytics', label: 'Analytics', icon: 'bar-chart-2' },
                { id: 'users', label: 'Users', icon: 'users' },
                { id: 'settings', label: 'Settings', icon: 'sliders' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={\`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors \${
                    activeSection === item.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }\`}
                >
                  <i data-lucide={item.icon} className="w-5 h-5"></i>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <i data-lucide="user" className="w-5 h-5"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Admin User</p>
                  <p className="text-xs text-slate-400">admin@example.com</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">${featuresDesc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                    <i data-lucide="plus" className="w-4 h-4"></i>
                    <span>New Item</span>
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-lg">
                    <i data-lucide="bell" className="w-5 h-5 text-slate-600"></i>
                  </button>
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((metric, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-600 font-medium">{metric.label}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</p>
                        <p className={\`text-sm mt-2 \${
                          metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                        }\`}>{metric.change} from last month</p>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-lg">
                        <i data-lucide={metric.icon} className="w-6 h-6 text-indigo-600"></i>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                  <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {recentItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-900">{item.id}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.name}</td>
                          <td className="px-6 py-4">
                            <span className={\`px-3 py-1 text-xs font-medium rounded-full \${
                              item.status === 'Active' ? 'bg-green-100 text-green-700' :
                              item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }\`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{item.date}</td>
                          <td className="px-6 py-4 text-sm">
                            <button className="text-indigo-600 hover:text-indigo-700 font-medium">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      );
    }

    ReactDOM.render(<AdminConsole />, document.getElementById('root'));
    
    // Initialize Lucide icons
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 100);
  </script>
</body>
</html>`;
  }

  /**
   * Generate Admin Console wireframe - Specialized for data management
   */
  async generateAdminWireframe(
    userGoal: string,
    requirements: ExtractedRequirements,
    _techStack: string[],
    _architecture: string,
    _fullPrompt: string, // Unused, we build a specific one
    _isRegeneration: boolean = false,
    brainstormingContext: any = null
  ): Promise<string> {
    const startTime = Date.now();
    logger.info('[EnhancedPreview] Starting ADMIN CONSOLE wireframe generation...');

    // Declare variables outside try-catch so they're accessible in error handling
    let isGame = false;
    let adminFeatures: string[] = [];
    let cleanGoal = '';

    try {
      // Clean inputs
      cleanGoal = this.cleanXmlTags(userGoal);
      const cleanFeatures = requirements.features.map(f => this.cleanXmlTags(f));

      // Use feature categorization service instead of manual filtering
      const categorized = featureCategorizationService.categorizeFeatures(
        cleanFeatures,
        requirements.projectType
      );

      adminFeatures = categorized.adminFacing;
      isGame = requirements.projectType === 'game';

      // SMART ADMIN DETECTION: Some project types ALWAYS need admin consoles
      // even if explicit admin features weren't mentioned
      const needsAdminConsole = isGame || adminFeatures.length > 0 ||
        this.shouldAutoGenerateAdmin(cleanGoal, requirements.features);

      if (!needsAdminConsole) {
        logger.info('[EnhancedPreview] No admin features detected and project doesn\'t need admin console - skipping');
        return '';
      }

      // If no explicit admin features but we need an admin console, infer them
      if (adminFeatures.length === 0) {
        adminFeatures = this.inferAdminFeatures(cleanGoal, requirements.features);
        logger.info(`[EnhancedPreview] Auto-inferred ${adminFeatures.length} admin features for business platform`);
      }

      const featuresList = adminFeatures.length > 0
        ? adminFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : 'Game management features (powers, stats, configuration)';

      // Game-specific prompt or generic admin prompt
      const prompt = isGame
        ? `Create a COMPLETE, PRODUCTION-LEVEL React GAME DASHBOARD as a single HTML file.

**PROJECT CONTEXT:**
The user is building: "${cleanGoal.substring(0, 500)}"
This is the **GAME DASHBOARD/MANAGEMENT INTERFACE** for that game, used to configure powers, view stats, and manage game settings.

**GAME DASHBOARD FEATURES:**
${featuresList}

${brainstormingContext?.ideas ? `**BRAINSTORMED GAME FEATURES (Create dashboard controls for these):**
${brainstormingContext.ideas.map((i: any) => `- ${i.label}: ${i.description}`).join('\n')}
` : ''}

**GAME DASHBOARD REQUIREMENTS:**
1.  **🔴 CRITICAL: Interactive Controls - MUST BE FUNCTIONAL**:
    - ALL controls (sliders, inputs, toggles) MUST update the game in real-time
    - Use PostMessage API to send updates to game iframe: 
      \`parent.postMessage({ type: 'UPDATE_VAR', payload: { var: 'player.speed', value: 300 } }, '*')\`
    - Game variables to expose: player.speed, player.jumpHeight, player.health, enemySpawnRate, game.difficulty
    - Add visual feedback when updates succeed (green flash, checkmark, etc.)
2.  **Layout**: Tab-based navigation (Controls, Powers, Combat, Stats, Configuration, etc.)
3.  **Controls Section** (🔴 MOST IMPORTANT):
    - Player Speed slider (100-500, default 300)
    - Jump Height slider (200-600, default 400)
    - Enemy Spawn Rate input (0.5-5.0 enemies per second, default 2)
    - Game Difficulty dropdown (Easy/Normal/Hard, default Normal)
    - "Reset to Defaults" button
4.  **Live Stats Dashboard**:
    - Real-time game statistics display (score, level, lives, health)
    - Request state via: \`parent.postMessage({ type: 'REQUEST_STATE' }, '*')\`
    - Listen for: \`window.addEventListener('message', e => { if (e.data.type === 'STATE_UPDATE') { ... } })\`
    - Update display every 2 seconds
    - Simple grid layout with stat cards

**DESIGN STYLE:**
- **Gaming Aesthetic**: Dark theme with purple/indigo/cyan gradient background
- **Simple & Fast**: Focus on functionality over complex visuals
- **Icons**: Use Lucide icons (gamepad-2, sliders, activity, rotate-ccw, info)

**PRODUCTION QUALITY:**
- Use **Lucide React** icons.
- Use **Tailwind CSS** for all styling.
- Use **React 18** (useState, useEffect) for logic.
- **Mock Data**: Generate realistic game data (power levels, stats, achievements)

**OUTPUT FORMAT:**
Exact same single-file HTML format as the main app (React+Tailwind+Babel).
Start with <!DOCTYPE html>:`
        : `Create a COMPLETE, PRODUCTION-LEVEL React ADMIN CONSOLE as a single HTML file.

**PROJECT CONTEXT:**
The user is building: "${cleanGoal.substring(0, 500)}"
This is the **ADMINISTRATIVE INTERFACE** for that project, used by staff/owners, NOT end-users.

**REQUIRED ADMIN FEATURES:**
${featuresList}

${brainstormingContext?.ideas ? `**BRAINSTORMED FEATURES (Include relevant Admin ones):**
${brainstormingContext.ideas.map((i: any) => `- ${i.label}: ${i.description}`).join('\n')}
` : ''}

**ADMIN CONSOLE REQUIREMENTS:**
1.  **Layout**: Sidebar navigation (left), Top bar (search/profile), Main content area.
2.  **Dashboard**: High-level metrics (cards), Recent activity (list), Charts (mocked).
3.  **Data Management**: Rich tables with:
    - Pagination, Search, Filtering
    - Row actions (Edit, Delete, View)
    - Bulk actions
4.  **Forms**: Complex forms for creating/editing resources (tabs, validation).
5.  **Analytics**: Visual representation of data (bar charts, line graphs using CSS/SVG or mocked components).
6.  **Settings**: Global configuration toggles and inputs.

**DESIGN STYLE:**
- **Professional & Clean**: High density data display, clear hierarchy.
- **Theme**: Dark Sidebar, Light Content (or Full Dark Mode support).
- **Accents**: Use professional blues, purples, or brand colors.
- **Interactivity**: Hover states, dropdowns, modal dialogs for critical actions.

**PRODUCTION QUALITY:**
- Use **Lucide React** icons.
- Use **Tailwind CSS** for all styling.
- Use **React 18** (useState, useEffect) for logic.
- **Mock Data**: Generate realistic dummy data for tables/charts.

**OUTPUT FORMAT:**
Exact same single-file HTML format as the main app (React+Tailwind+Babel).
Start with <!DOCTYPE html>.
`;

      logger.info(`[EnhancedPreview] Sending ADMIN ${isGame ? 'GAME DASHBOARD' : 'CONSOLE'} request via LLM router...`);
      logger.info(`[EnhancedPreview] Admin features count: ${adminFeatures.length}, isGame: ${isGame}`);

      const result = await Promise.race([
        llmRouter.executeWithFallback({
          prompt,
          context: {
            agentRole: 'Admin UI Developer',
            taskType: 'code-generation',
            systemInstruction: 'Output only HTML starting with <!DOCTYPE html>. You are an expert Admin UI developer.'
          },
          requestType: 'generation',
          contextType: 'wizard',
          routerType: 'internal'
        }),
        new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('Admin generation timed out after 90s')), 90000);
        })
      ]);

      const elapsed = Date.now() - startTime;
      logger.info(`[EnhancedPreview] Admin generation finished in ${elapsed}ms`);

      // Extract and validate HTML
      let extractedHtml = this.extractHtml(result.text || '');

      // Fix React dependencies to prevent blank screen issues
      extractedHtml = this.fixReactDependencies(extractedHtml);

      if (!extractedHtml || extractedHtml.trim().length === 0) {
        logger.error('[EnhancedPreview] ❌ CRITICAL: Admin wireframe extraction resulted in EMPTY content!', {
          hasResult: !!result,
          hasText: !!result.text,
          textLength: result.text?.length || 0,
          textPreview: result.text?.substring(0, 200) || 'NO TEXT'
        });
        throw new Error('Admin wireframe generation returned empty HTML content');
      }

      if (!extractedHtml.toLowerCase().includes('<!doctype html') && !extractedHtml.toLowerCase().includes('<html')) {
        logger.error('[EnhancedPreview] ❌ CRITICAL: Admin wireframe does not appear to be valid HTML!', {
          contentLength: extractedHtml.length,
          contentPreview: extractedHtml.substring(0, 200)
        });
        throw new Error('Admin wireframe generation returned invalid HTML');
      }

      logger.info(`[EnhancedPreview] ✅ Admin wireframe generated successfully (${extractedHtml.length} chars)`);
      return extractedHtml;

    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      logger.error(`[EnhancedPreview] ❌ Admin generation FAILED: ${(error instanceof Error ? error.message : String(error))}`, {
        errorName: (error instanceof Error ? error.name : 'Error'),
        errorStack: (error instanceof Error ? error.stack : undefined)?.split('\n').slice(0, 3).join('\n'),
        isGameProject: isGame,
        adminFeaturesCount: adminFeatures?.length || 0,
        elapsedTime: elapsed
      });

      // For games, use fallback dashboard template instead of returning empty string
      if (isGame) {
        logger.warn('[EnhancedPreview] ⚠️  Using FALLBACK dashboard template for game');
        const fallbackHtml = this.generateFallbackDashboard(cleanGoal);
        logger.info(`[EnhancedPreview] ✅ Fallback dashboard generated (${fallbackHtml.length} chars)`);
        return fallbackHtml;
      }

      // For non-game admin consoles, use fallback business admin template
      logger.warn('[EnhancedPreview] ⚠️  Using FALLBACK admin console template for business platform');
      const fallbackHtml = this.generateFallbackAdminConsole(cleanGoal, adminFeatures);
      logger.info(`[EnhancedPreview] ✅ Fallback admin console generated (${fallbackHtml.length} chars)`);
      return fallbackHtml;
    }
  }

  /**
   * Determine if a project should auto-generate an admin console
   * based on its description and type
   */
  private shouldAutoGenerateAdmin(userGoal: string, features: string[]): boolean {
    const goalLower = userGoal.toLowerCase();
    const featuresText = features.join(' ').toLowerCase();
    const combinedText = `${goalLower} ${featuresText}`;

    // Business platforms that inherently need admin consoles
    const businessPlatformKeywords = [
      'ecommerce', 'e-commerce', 'marketplace', 'store', 'shop',
      'ticket', 'ticketing', 'event',
      'booking', 'reservation', 'appointment',
      'rental', 'listing',
      'saas', 'platform', 'service',
      'food delivery', 'delivery service',
      'ride sharing', 'transportation',
      'hotel', 'accommodation',
      'restaurant', 'dining'
    ];

    return businessPlatformKeywords.some(keyword => combinedText.includes(keyword));
  }

  /**
   * Infer admin features based on user goal and existing features
   */
  private inferAdminFeatures(userGoal: string, _features: string[]): string[] {
    const goalLower = userGoal.toLowerCase();
    const adminFeatures: string[] = [];

    // E-commerce/Marketplace admin features
    if (goalLower.includes('shop') || goalLower.includes('store') ||
      goalLower.includes('ecommerce') || goalLower.includes('marketplace')) {
      adminFeatures.push(
        'Product catalog management',
        'Order management dashboard',
        'Inventory tracking',
        'Sales analytics and reports',
        'Customer management'
      );
    }

    // Event/Ticketing admin features
    if (goalLower.includes('ticket') || goalLower.includes('event')) {
      adminFeatures.push(
        'Event management dashboard',
        'Ticket sales tracking',
        'Attendee management',
        'Revenue analytics',
        'Organizer tools'
      );
    }

    // Booking/Reservation admin features
    if (goalLower.includes('booking') || goalLower.includes('reservation') ||
      goalLower.includes('appointment')) {
      adminFeatures.push(
        'Booking management system',
        'Schedule/calendar management',
        'Customer booking history',
        'Availability configuration',
        'Cancellation management'
      );
    }

    // SaaS/Platform admin features
    if (goalLower.includes('saas') || goalLower.includes('platform') ||
      goalLower.includes('service')) {
      adminFeatures.push(
        'User management console',
        'Subscription management',
        'Usage analytics',
        'Configuration settings',
        'System monitoring'
      );
    }

    // If nothing specific matched, add generic admin features
    if (adminFeatures.length === 0) {
      adminFeatures.push(
        'Administrative dashboard',
        'User management',
        'Content management',
        'Analytics and reporting',
        'System configuration'
      );
    }

    return adminFeatures;
  }

  /**
   * Detect project domain/subtype for better prompt customization
   */
  private _detectProjectDomain(userGoal: string, projectType: string): string {
    const goalLower = userGoal.toLowerCase();

    // E-commerce detection
    if (goalLower.includes('shop') || goalLower.includes('store') || goalLower.includes('ecommerce') ||
      goalLower.includes('e-commerce') || goalLower.includes('marketplace') || goalLower.includes('cart') ||
      goalLower.includes('checkout') || goalLower.includes('product') || goalLower.includes('buy')) {
      return 'ecommerce';
    }

    // Dashboard detection
    if (goalLower.includes('dashboard') || goalLower.includes('analytics') || goalLower.includes('metrics') ||
      goalLower.includes('statistics') || goalLower.includes('report') || goalLower.includes('monitor')) {
      return 'dashboard';
    }

    // Social media detection
    if (goalLower.includes('social') || goalLower.includes('facebook') || goalLower.includes('twitter') ||
      goalLower.includes('instagram') || goalLower.includes('feed') || goalLower.includes('post')) {
      return 'social';
    }

    // Blog/CMS detection
    if (goalLower.includes('blog') || goalLower.includes('cms') || goalLower.includes('content management') ||
      goalLower.includes('article') || goalLower.includes('news')) {
      return 'blog';
    }

    // Portfolio detection
    if (goalLower.includes('portfolio') || goalLower.includes('showcase') || goalLower.includes('gallery')) {
      return 'portfolio';
    }

    // Game detection - use EXPLICIT game keywords only
    const explicitGameKeywords = [
      'video game', 'gaming', 'gameplay', 'playable', 'arcade game',
      ' game ', // with spaces to avoid matching "management", "engagement"
      'platformer', 'rpg', 'shooter', 'simulation game', 'puzzle game',
      'unity', 'unreal', 'godot', 'pygame', 'phaser', 'three.js game',
      'game engine', 'game mechanics', 'game development'
    ];

    const businessExcluders = [
      'platform', 'ticket', 'booking', 'commerce', 'marketplace',
      'dashboard', 'management', 'service', 'saas'
    ];

    const hasExplicitGame = explicitGameKeywords.some(keyword => goalLower.includes(keyword));
    const hasBusinessTerm = businessExcluders.some(keyword => goalLower.includes(keyword));

    if (hasExplicitGame && !hasBusinessTerm) {
      return 'game';
    }

    return projectType; // Return base type if no specific domain detected
  }

  /**
   * Get domain-specific prompt templates
   */
  // @ts-ignore TS6133
  private __getDomainSpecificPrompt(projectType: string, userGoal: string): string {
    const domain = this._detectProjectDomain(userGoal, projectType);

    const DRIBBBLE_STANDARDS = `
**✨ DRIBBBLE & ENVATO LEVEL DESIGN STANDARDS (MANDATORY) ✨**:
You are a World-Class UI/UX Designer aiming for a "Site of the Day" award. 

1. **MODERN AESTHETICS (2025 TRENDS)**:
   - **Bento Grids**: Use \`grid grid-cols-1 md:grid-cols-3 gap-6\` with varying row/col spans for cards.
   - **Glassmorphism 2.0**: Use \`backdrop-blur-xl bg-white/60 border border-white/20\` for overlays/cards.
   - **Swiss Typography**: Use large, tight-tracking headings: \`font-bold tracking-tight text-slate-900\`.
   - **Aurora Gradients**: Use subtle, moving mesh gradients for backgrounds (e.g., \`bg-gradient-to-br from-indigo-50 via-white to-cyan-50\`).
   - **Soft Shadows**: \`shadow-[0_8px_30px_rgb(0,0,0,0.06)]\` - avoid harsh default shadows.

2. **COLOR PALETTE (SOPHISTICATED)**:
   - **Primary**: \`indigo-600\` or \`violet-600\` (Vibrant but professional).
   - **Secondary**: \`slate-500\` (Muted text).
   - **Background**: \`slate-50\` or \`zinc-50\` (Avoid pure white #ffffff for main backgrounds).
   - **Accents**: \`rose-500\` or \`amber-500\` for small details.
   - **Dark Mode Compatibility**: Always use \`dark:bg-slate-900 dark:text-white\` classes for future proofing.

3. **MICRO-INTERACTIONS (FEEL)**:
   - **Buttons**: \`hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-indigo-500/25\`.
   - **Cards**: \`hover:-translate-y-1 hover:shadow-2xl transition-all duration-500 group\`.
   - **Inputs**: \`focus:ring-4 focus:ring-indigo-100 transition-all\`.

4. **LAYOUT & SPACING**:
   - **Whitespace**: Use \`p-8\` or \`p-12\` for sections. Breathable layouts are key.
   - **Rounded Corners**: Use \`rounded-2xl\` or \`rounded-3xl\`. Avoid small radii.
   - **Container**: \`max-w-7xl mx-auto\`.

5. **CONTENT REALISM**:
   - Use **Unsplash** styled images (via picsum or placeholders) that fit the theme.
   - Use realistic names, prices, and copy. NO "Lorem Ipsum".
`;

    const baseGuidelines = `
${DRIBBBLE_STANDARDS}

**PRODUCTION-READY CODE REQUIREMENTS**:
- Use React 18+ with hooks (useState, useEffect, useCallback, useMemo)
- Implement proper error handling and loading states
- Ensure responsive design (mobile-first)
- Include accessibility features (ARIA labels, keyboard navigation)
- Use Tailwind CSS for styling
- Include high-quality assets (images, icons, graphics)
- NO placeholder text - use real, relevant content
`;

    switch (domain) {
      case 'ecommerce':
        return `${baseGuidelines}
**ECOMMERCE APPLICATION GUIDELINES**:
- Include product catalog with images and prices
- Implement shopping cart functionality
- Add product search and filtering
- Include checkout flow with form validation
- Display product reviews and ratings
- Show related products and recommendations
- Include payment integration UI (simulated)
- Add wishlist/favorites functionality`;

      case 'dashboard':
        return `${baseGuidelines}
**DASHBOARD APPLICATION GUIDELINES**:
- Include data visualizations (charts, graphs, metrics)
- Implement filtering and date range selectors
- Add real-time data updates (simulated with polling)
- Include export functionality
- Display tables with sorting and pagination
- Show KPIs and summary statistics
- Add customizable widgets/cards
- Implement dark mode support`;

      case 'social':
        return `${baseGuidelines}
**SOCIAL MEDIA APPLICATION GUIDELINES**:
- Include feed with posts, images, videos
- Add user profiles with avatars
- Implement like, comment, share functionality
- Include messaging/chat interface
- Add notifications system
- Show trending topics or hashtags
- Include user authentication UI`;

      case 'blog':
        return `${baseGuidelines}
**BLOG/CMS APPLICATION GUIDELINES**:
- Include article listing with thumbnails
- Add article detail pages with rich content
- Implement search and category filtering
- Include author profiles
- Add comment system
- Show related articles
- Include RSS feed or newsletter signup`;

      case 'portfolio':
        return `${baseGuidelines}
**PORTFOLIO APPLICATION GUIDELINES**:
- Include project showcases with images
- Add project detail pages
- Implement filtering by category/technology
- Include about/contact sections
- Add smooth animations and transitions
- Show case studies with before/after
- Include testimonials section`;

      case 'web':
        return `${baseGuidelines}
**WEB APPLICATION GUIDELINES**:
- Implement modern UI/UX patterns
- Include navigation, routing, and state management
- Add proper form validation and submission
- Include interactive components (modals, dropdowns, tabs)
- Implement data persistence (localStorage/IndexedDB)
- Add loading skeletons and error boundaries`;

      case 'game':
        return `**GAME DEVELOPMENT REQUIREMENTS (CRITICAL)**:
- **Engine/Tech**: Use HTML5 Canvas API within a customized React component.
- **Performance**: Implement a requestAnimationFrame game loop for smooth 60FPS rendering.
- **Graphics**: Use high-quality colorful shapes, gradients, or emoji sprites if external assets aren't available. AVOID plain black/white boxes.
- **Gameplay**:
  - Implement full WASD/Arrow Key movement.
  - Add "juicy" game feel: screen shake, particle effects on collision, smooth transitions.
  - Track Score, High Score (persist in localStorage), and Level.
  - Create a "Start Screen", "Game Over Screen", and "Pause Menu".
- **Visual Style**:
  - Use a modern specific style (e.g., "Neon Cyberpunk", "Pastel Cozy", "Retro Pixel (simulated)").
  - Add background music/sound placeholders (commented out or mocked).
- **Architecture**:
  - Separate GameEngine logic from React UI.
  - Use a clean state machine for game states (MENU, PLAYING, GAMEOVER).
`;

      case 'mobile':
        return `${baseGuidelines}
**MOBILE APPLICATION GUIDELINES**:
- **Visuals**: Use "App-like" aesthetics:
  - Large click targets (min 44px).
  - Bottom navigation bars or Tab bars.
  - "Card-based" layouts with soft shadows: shadow-sm, rounded-xl.
  - Transitions: transition-all duration-300 active:scale-95.
  - Use system-like fonts (font-sans).
- **Behaviors**:
  - Simulated "Pull to refresh".
  - Swipe gestures for lists (if possible).
  - Toast notifications for actions.
`;
      case 'api':
        return `${baseGuidelines}
** API APPLICATION GUIDELINES **:
        - Create API documentation interface
          - Include endpoint testing interface
            - Show request / response examples
              - Add authentication / authorization UI
                - Display API usage statistics
                  - Include code examples for integration`;

      default:
        // Default "Responsive Web App" - works on ALL platforms
        return `${baseGuidelines}
**RESPONSIVE WEB APPLICATION GUIDELINES (Cross-Platform)**:
- **Mobile-First Responsive Design**:
  * Use Tailwind breakpoints: sm: (640px), md: (768px), lg: (1024px), xl: (1280px)
  * Start with mobile-optimized layout, enhance for larger screens
  * Example: \`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3\`
- **Navigation**:
  * Desktop: Top horizontal nav bar with dropdowns
  * Mobile/Tablet: Hamburger menu OR bottom tab bar
  * Use responsive classes: \`hidden md:block\` / \`md:hidden\`
- **Touch-Friendly + Mouse-Friendly**:
  * All interactive elements minimum 44x44px for touch
  * Add hover states for desktop: \`hover:bg-slate-100\`
  * Add active states for mobile: \`active:scale-95\`
- **Layout Adaptation**:
  * Sidebar → Drawer/Bottom tabs on small screens
  * Multi-column grids → Stack vertically on mobile
  * Large spacing → Compact spacing on mobile
- **Typography Scaling**:
  * Use responsive text: \`text-xl md:text-2xl lg:text-4xl\`
  * Ensure readability: minimum 16px base font
- **Aesthetics (Modern, Premium)**:
  * Typography: 'Inter', 'Plus Jakarta Sans', or 'Outfit' fonts
  * Colors: Sophisticated palettes (Indigo, Teal, Slate) - avoid basic red/blue
  * Glassmorphism: \`backdrop-blur-md bg-white/70 border border-white/20\`
  * Soft shadows: \`shadow-[0_8px_30px_rgb(0,0,0,0.04)]\`
  * Rounded corners: \`rounded-2xl\` or \`rounded-3xl\`
- **Interactivity**:
  * Smooth transitions: \`transition-all duration-300\`
  * Loading skeletons instead of spinners
  * Micro-animations on hover/click
  * Keyboard navigation support
`;
    }
  }

  /**
   * Map SDLC service methodology recommendations to supported project methodologies
   */
  private mapToSupportedMethodology(sdlcMethodology: string): 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD' {
    if (sdlcMethodology === 'LangGraph') {
      return 'Agile';
    }
    const supportedMethodologies = ['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Iterative', 'Prototyping', 'RAD', 'Scrum', 'Lean', 'ASD'];
    if (supportedMethodologies.includes(sdlcMethodology)) {
      return sdlcMethodology as 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD';
    }
    return 'V-Model';
  }

  /**
   * Fallback standards matching based on keywords when database matching fails
   */
  private getFallbackStandards(description: string, userGoal: string): string[] {
    const text = `${description} ${userGoal} `.toLowerCase();
    const standards: string[] = [];

    if (text.includes('web') || text.includes('website') || text.includes('frontend')) {
      standards.push('wcag', 'w3c');
    }
    if (text.includes('api') || text.includes('rest') || text.includes('graphql')) {
      standards.push('rest', 'openapi');
    }
    if (text.includes('mobile') || text.includes('ios') || text.includes('android')) {
      standards.push('mobile-accessibility');
    }
    if (text.includes('data') || text.includes('privacy') || text.includes('personal information')) {
      if (text.includes('eu') || text.includes('europe')) {
        standards.push('gdpr');
      }
      if (text.includes('california') || text.includes('ca')) {
        standards.push('ccpa');
      }
    }
    if (text.includes('security') || text.includes('secure') || text.includes('encryption') ||
      text.includes('authentication') || text.includes('cyber')) {
      standards.push('owasp', 'iso27001');
    }

    return Array.from(new Set(standards)).slice(0, 5);
  }

  /**
   * Generate full project preview (orchestrates the entire process)
   */
  async generatePreview(
    userGoal: string,
    conversationHistory: any[],
    useInternet: boolean = false,
    progressCallback: (stage: string, progress: number, message: string) => void = () => { },
    userId?: string,
    projectId?: string,
    isRegeneration: boolean = false,
    brainstormingContext: any = null, // Added brainstorming context
    generationSessionId?: string // Added for real-time status updates
  ): Promise<PreviewComponent> {
    const startTime = Date.now();
    logger.info(`[EnhancedPreview] Starting generation userGoal = "${userGoal.substring(0, 50)}..." useInternet = ${useInternet} `);

    // Check semantic cache first (for similar projects)
    // Initial status update
    if (generationSessionId) {
      generationStatusService.emitProcessStage(generationSessionId, 'Initializing request...', { stage: 'init' });
    }

    // Skip if no progress callback provided (likely background job which handles cache separately)
    // or if explicitly disabled (logic can be added)
    // Note: Background service handles cache separately, so we won't force it here if it's already done
    // But for direct calls, we might want it. For now, matching llm.routes.ts logic which checks cache outside
    // Actually, llm.routes.ts logic checked cache BEFORE calling parallel steps.
    // I will COPY the orchestration logic here.

    // Stage 1: Extract requirements and perform research (0-20%)
    progressCallback('Stage 1', 0, 'Extracting requirements and performing research...');
    logger.info('[EnhancedPreview] Stage 1: Extracting requirements...');

    if (generationSessionId) {
      generationStatusService.emitProcessStage(generationSessionId, 'Requirements Analysis', { stage: 'stage_1', progress: 0 });
      generationStatusService.emitProgress(generationSessionId, 5, 'Analyzing user request...');
      if (useInternet) {
        generationStatusService.emitAIThought(generationSessionId, 'Conducting online research for industry standards and best practices...');
      }
    }

    const [requirements, researchContext] = await Promise.all([
      this.extractRequirements(conversationHistory || [], userGoal, isRegeneration),
      useInternet ? (async () => {
        try {
          const researchPrompt = `Research the latest information about building a project like: "${userGoal}"

Focus on:
        1. Current industry best practices
        2. Recommended technologies and frameworks(latest versions)
        3. Common implementation patterns
        4. Important considerations and potential challenges
        5. Relevant standards or compliance requirements

Keep the research concise and focused on actionable insights.`;

          const researchResult = await llmRouter.executeWithFallback({
            prompt: researchPrompt,
            context: { agentRole: 'Research Agent', taskType: 'research', skipCache: isRegeneration },
            routingContext: { userId },
            requestType: 'research',
            contextType: 'wizard',
            useInternet: true
          });

          return (researchResult.text || '').substring(0, 2000);
        } catch (error: unknown) {
          logger.warn('[EnhancedPreview] Research failed:', (error instanceof Error ? error.message : String(error)));
          return '';
        }
      })() : Promise.resolve('')
    ]);

    // Run SDLC and Standards matching in parallel
    if (generationSessionId) {
      generationStatusService.emitAIThought(generationSessionId, `Identified ${requirements.requirements.length} core requirements and ${requirements.features.length} key features.`);
      generationStatusService.emitAIThought(generationSessionId, `Project Type detected: ${requirements.projectType}`);
      generationStatusService.emitProgress(generationSessionId, 15, 'Requirements extracted');
    }
    const projectName = userGoal.substring(0, 50).trim() || 'New Project';
    const conversationText = (conversationHistory || []).map((m: any) => `${m.sender}: ${m.text} `).join('\n');
    const fullDescription = `${userGoal} \n\n${conversationText.substring(0, 1500)} `;

    const [sdlcResult, standardsResult] = await Promise.allSettled([
      (async () => {
        try {
          // Initialize if needed (idempotent usually)
          // await sdlcMatchingService.initialize(); // Assuming it might be needed, but usually service init handles it
          // Based on llm.routes.ts, it calls initialize().
          if (sdlcMatchingService.initialize) await sdlcMatchingService.initialize();

          const sdlcRecommendation = await sdlcMatchingService.recommendMethodology({
            name: projectName,
            description: fullDescription,
            requirements: requirements.requirements
          });
          return {
            methodology: this.mapToSupportedMethodology(sdlcRecommendation.methodology),
            reasoning: sdlcRecommendation.reasoning
          };
        } catch (error: unknown) {
          logger.warn('SDLC matching failed:', (error instanceof Error ? error.message : String(error)));
          return null;
        }
      })(),
      (async () => {
        try {
          if (standardsMatchingService.initialize) await standardsMatchingService.initialize();

          const enrolledStandards = await standardsMatchingService.autoEnrollStandards({
            name: projectName,
            description: fullDescription,
            methodology: 'V-Model'
          }, {
            autoEnrollRequired: true,
            autoEnrollRecommended: true,
            maxStandards: 5
          });
          return enrolledStandards.length > 0 ? enrolledStandards : null;
        } catch (error: unknown) {
          logger.warn('Standards matching failed:', (error instanceof Error ? error.message : String(error)));
          return null;
        }
      })()
    ]);

    let recommendedMethodology = 'V-Model';
    let recommendedStandards: string[] = [];

    if (sdlcResult.status === 'fulfilled' && sdlcResult.value) {
      recommendedMethodology = sdlcResult.value.methodology;
    }

    if (standardsResult.status === 'fulfilled' && standardsResult.value) {
      recommendedStandards = standardsResult.value;
    } else {
      recommendedStandards = this.getFallbackStandards(fullDescription, userGoal);
    }

    // Stage 2: Generate summary and tech stack (20-50%)
    progressCallback('Stage 2', 20, 'Generating summary and tech stack...');
    logger.info('[EnhancedPreview] Stage 2: Generating summary and tech stack...');

    if (generationSessionId) {
      generationStatusService.emitProcessStage(generationSessionId, 'System Architecture Design', { stage: 'stage_2', progress: 20 });
      generationStatusService.emitAIThought(generationSessionId, 'Selecting optimal technology stack for ' + requirements.projectType + ' application...');
    }

    const [summary, techStack] = await Promise.all([
      this.retryWithBackoff(
        () => this.generateSummary(userGoal, requirements, researchContext, isRegeneration),
        3,
        'Summary generation'
      ),
      this.retryWithBackoff(
        () => this.generateTechStack(userGoal, requirements, researchContext, isRegeneration),
        3,
        'Tech stack generation'
      )
    ]);

    // Emit progress after Stage 2 completes
    if (generationSessionId) {
      generationStatusService.emitProgress(generationSessionId, 35, 'Summary and tech stack generated');
    }

    // Stage 3: Generate complex components (50-90%)
    progressCallback('Stage 3', 50, 'Generating architecture and wireframe code...');
    logger.info('[EnhancedPreview] Stage 3: Generating architecture and wireframe in parallel...');

    if (generationSessionId) {
      generationStatusService.emitProcessStage(generationSessionId, 'Visual Prototyping', { stage: 'stage_3', progress: 50 });
      generationStatusService.emitAIThought(generationSessionId, 'Creating C4 architecture diagrams and interactive wireframes...');
      generationStatusService.emitModelSelection(generationSessionId, 'Gemini 2.0 Flash', 'Google', 'Selected for high-speed code generation');
    }

    // Helper to build explicit prompt
    const buildFullPrompt = (methodology: string, standards: string[]): string => {
      const researchSection = researchContext
        ? `\n\n ** INTERNET RESEARCH RESULTS **: \n${researchContext} \n`
        : '';

      // Generate project-type-specific UI requirements
      const getProjectTypeInstructions = (projectType: string): string => {
        switch (projectType?.toLowerCase()) {
          case 'game':
            return `
🎮 **GAME-SPECIFIC UI REQUIREMENTS**:
- Include a CANVAS element for game rendering (id="gameCanvas")
- Add game controls (arrow keys, WASD, space bar)
- Include score display, health/lives, level indicator
- Add Start Game, Pause, Restart buttons
- Include game-over modal with final score
- Use requestAnimationFrame for game loop
- Add sound toggle button
`;
          case 'todo':
          case 'task':
            return `
📝 **TODO/TASK APP REQUIREMENTS**:
- Include task input field with Add button
- Task list with checkboxes and delete buttons
- Mark complete/incomplete functionality
- Filter buttons (All, Active, Completed)
- Task counter and Clear Completed button
- LocalStorage persistence for tasks
`;
          case 'ecommerce':
          case 'shop':
          case 'store':
            return `
🛒 **E-COMMERCE REQUIREMENTS**:
- Product grid with images, prices, ratings
- Shopping cart sidebar/modal
- Add to Cart buttons on products
- Cart quantity controls (+/-)
- Cart total calculation
- Checkout button and form
- Product search/filter functionality
`;
          case 'dashboard':
          case 'analytics':
            return `
📊 **DASHBOARD REQUIREMENTS**:
- Key metric cards with numbers
- Charts/graphs (use Chart.js or CSS bars)
- Data tables with sorting
- Date range filters
- Export functionality
- Real-time update simulation
`;
          case 'social':
          case 'chat':
            return `
💬 **SOCIAL/CHAT REQUIREMENTS**:
- Message input with send button
- Message list with sender info
- User avatars and timestamps
- Like/reaction buttons
- Notification indicators
- User presence status
`;
          case 'form':
          case 'survey':
            return `
📋 **FORM REQUIREMENTS**:
- Multiple form fields (text, email, select, checkbox, radio)
- Form validation with error messages
- Submit button with loading state
- Success/error feedback
- Form reset functionality
`;
          default:
            return '';
        }
      };

      const projectTypeInstructions = getProjectTypeInstructions(requirements.projectType);

      return `You are an ELITE UI/UX Developer creating a **FULLY FUNCTIONAL, INTERACTIVE DEMO**.

╔══════════════════════════════════════════════════════════════════════════════╗
║  🎯 PROJECT CONTEXT - READ THIS FIRST AND BUILD EXACTLY THIS                ║
╚══════════════════════════════════════════════════════════════════════════════╝

**USER'S PROJECT**: "${userGoal}"

**PROJECT TYPE**: ${requirements.projectType}
**REQUIRED FEATURES**: ${requirements.features.join(', ')}
**CORE REQUIREMENTS**: ${requirements.requirements.join(', ')}
${researchSection}
**METHODOLOGY**: ${methodology}
**STANDARDS**: ${standards.join(', ')}

⚠️ **CRITICAL**: Your prototype MUST be about "${userGoal.substring(0, 100)}..."
DO NOT generate a generic demo. Build what the user described above.
${projectTypeInstructions}
═══════════════════════════════════════════════════════════════════════════════

=== TECHNOLOGY STACK (MANDATORY) ===
- **HTML5** for structure
- **Tailwind CSS** via CDN for styling  
- **Vanilla JavaScript** for interactivity
- **Lucide Icons** via CDN for icons

⚠️ **FORBIDDEN**: React, JSX, Vue, Angular, Babel, TypeScript, ES6 imports

=== CDN SETUP (COPY EXACTLY INTO <head>) ===
\`\`\`html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: '#6366f1',
          secondary: '#8b5cf6', 
          accent: '#22d3ee',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444'
        }
      }
    }
  }
</script>
\`\`\`

=== LUCIDE ICONS (MUST WORK) ===
1. Use: \`<i data-lucide="icon-name" class="w-5 h-5"></i>\`
2. Initialize at end of body: \`<script>lucide.createIcons();</script>\`
3. Common icons: home, settings, user, star, heart, play, pause, plus, minus, check, x, menu, search, bell, mail, calendar, clock, map-pin, phone, globe, camera, image, video, music, file, folder, download, upload, share, link, edit, trash, copy, save, refresh, filter, grid, list, chevron-left, chevron-right, chevron-down, chevron-up, arrow-left, arrow-right, arrow-up, arrow-down

=== COLOR PALETTE (USE CONSISTENTLY) ===
- **Primary Actions**: bg-indigo-600 hover:bg-indigo-700 text-white
- **Secondary Actions**: bg-purple-600 hover:bg-purple-700 text-white
- **Success States**: bg-emerald-500, text-emerald-600
- **Warning States**: bg-amber-500, text-amber-600
- **Error States**: bg-red-500, text-red-600
- **Backgrounds**: bg-slate-50, bg-slate-100, bg-white
- **Text**: text-slate-900, text-slate-700, text-slate-500
- **Borders**: border-slate-200, border-slate-300
- **Cards**: bg-white rounded-xl shadow-lg border border-slate-200

=== INTERACTIVITY REQUIREMENTS (ALL MUST WORK) ===

**Navigation/Tabs:**
\`\`\`javascript
document.querySelectorAll('[data-tab]').forEach(tab => {
  tab.addEventListener('click', function() {
    // Hide all panels
    document.querySelectorAll('[data-panel]').forEach(p => p.classList.add('hidden'));
    // Remove active from all tabs
    document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('bg-indigo-600', 'text-white'));
    t.classList.add('text-slate-600');
    // Show selected panel
    document.querySelector('[data-panel="' + this.dataset.tab + '"]').classList.remove('hidden');
    // Mark tab active
    this.classList.add('bg-indigo-600', 'text-white');
    this.classList.remove('text-slate-600');
  });
});
\`\`\`

**Buttons with Feedback:**
\`\`\`javascript
button.addEventListener('click', function() {
  // Visual feedback
  this.classList.add('scale-95');
  setTimeout(() => this.classList.remove('scale-95'), 150);
  // Show toast notification
  showToast('Action completed successfully!', 'success');
});
\`\`\`

**Toast Notification System (INCLUDE THIS):**
\`\`\`javascript
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-indigo-500', warning: 'bg-amber-500' };
  toast.className = \`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white shadow-xl transform translate-y-0 opacity-100 transition-all duration-300 \${colors[type]}\`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('translate-y-2', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}
\`\`\`

**Modal System:**
\`\`\`javascript
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('flex');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById(id).classList.remove('flex');
}
\`\`\`

=== MOCK DATA (USE REALISTIC DATA) ===
Generate 10-20 realistic data items. Example:
\`\`\`javascript
const mockData = [
  { id: 1, name: 'John Smith', email: 'john@example.com', status: 'active', avatar: 'https://i.pravatar.cc/150?u=1' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah@example.com', status: 'pending', avatar: 'https://i.pravatar.cc/150?u=2' },
  // ... more items
];
\`\`\`

=== VISUAL POLISH (MANDATORY) ===
- **Hover Effects**: All clickable elements need hover:bg-slate-100 or hover:scale-105
- **Transitions**: Add \`transition-all duration-200\` to interactive elements
- **Focus States**: focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
- **Active States**: active:scale-95 for buttons
- **Shadows**: Use shadow-sm, shadow-md, shadow-lg, shadow-xl appropriately
- **Rounded Corners**: rounded-lg or rounded-xl for cards, rounded-full for avatars
- **Spacing**: Use consistent p-4, p-6, gap-4, gap-6, space-y-4

╔══════════════════════════════════════════════════════════════════════════════╗
║  🎯 FINAL REMINDER: BUILD EXACTLY WHAT THE USER REQUESTED                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

Your output MUST be the interactive prototype for: "${userGoal.substring(0, 150)}"
Include all the FEATURES and REQUIREMENTS mentioned at the start.
Make sure the UI elements, layout, and functionality match the user's project description.

=== OUTPUT FORMAT ===
Output ONLY a single valid HTML file starting with <!DOCTYPE html>.
NO Markdown code fences.
NO explanations or comments outside the code.
The file MUST be immediately runnable in a browser.
`;
    };

    const explicitPrompt = buildFullPrompt(recommendedMethodology, recommendedStandards);

    const architectureWithTimeout = Promise.race([
      this.retryWithBackoff(
        () => this.generateArchitecture(userGoal, requirements, techStack, fullDescription, '', brainstormingContext),
        1,
        'Architecture generation'
      ),
      new Promise<string>((resolve) => {
        setTimeout(() => {
          logger.warn('[EnhancedPreview] Architecture generation timed out, using fallback');
          resolve(`C4Container
title System Architecture for ${userGoal.substring(0, 30)}...
        Person(user, "User", "End User")
        System_Boundary(c1, "System") {
          Container(web, "Web App", "React", "Frontend Interface")
          Container(api, "API Service", "Node.js", "Backend Logic")
          ContainerDb(db, "Database", "MongoDB", "Data Storage")
        }
        Rel(user, web, "Uses")
        Rel(web, api, "API Requests")
        Rel(api, db, "Reads/Writes")`);
        }, 60000); // 60 second timeout for complex diagrams
      })
    ]);

    progressCallback('wireframe', 70, 'Generating interactive prototype...');

    // Emit progress for wireframe generation start
    if (generationSessionId) {
      generationStatusService.emitProgress(generationSessionId, 55, 'Starting wireframe generation...');
    }

    const wireframeCode = await this.retryWithBackoff(
      () => this.generateWireframeV2(userGoal, requirements, explicitPrompt, isRegeneration, brainstormingContext),
      2,
      'Wireframe generation (parallel)'
    );

    // Emit progress after wireframe completes
    if (generationSessionId) {
      generationStatusService.emitProgress(generationSessionId, 75, 'Interactive prototype generated');
    }

    progressCallback('wireframe', 95, 'Finalizing prototype...');

    const [architecture] = await Promise.all([
      architectureWithTimeout
    ]);

    // Stage 3.5: Generate AI assets (optional, but enhances prototype quality)
    progressCallback('assets', 92, 'Generating custom assets...');

    if (generationSessionId) {
      generationStatusService.emitProcessStage(generationSessionId, 'Asset Generation', { stage: 'stage_3_5', progress: 92 });
      generationStatusService.emitAIThought(generationSessionId, 'Creating custom visual assets for the prototype...');
    }
    let finalWireframeCode = wireframeCode;

    try {
      // Check if image generation is available (Gemini API key configured)
      const enableAssetGeneration = process.env.ENABLE_PROTOTYPE_ASSETS !== 'false';

      if (enableAssetGeneration) {
        // Analyze what assets are needed
        const requiredAssets = prototypeAssetGenerator.analyzeRequiredAssets(
          projectName,
          requirements.projectType,
          userGoal,
          requirements.features
        );

        if (requiredAssets.length > 0) {
          logger.info(`[EnhancedPreview] Generating ${requiredAssets.length} custom assets...`);

          // Generate assets with timeout (max 2 assets to avoid delays)
          const assetResult = await prototypeAssetGenerator.generateAssets(
            requiredAssets.slice(0, 3), // Limit to 3 assets (increased for audio/video)
            1, // Sequential to avoid rate limits
            30000 // Increased timeout for multi-step generation
          );

          if (assetResult.assets.length > 0) {
            // Save assets to disk if projectId is available
            let finalAssets = assetResult.assets;

            if (projectId) {
              try {
                finalAssets = await prototypeAssetGenerator.saveAssetsToDisk(finalAssets, projectId);
                logger.info(`[EnhancedPreview] Persisted ${finalAssets.length} assets to project folder`);
              } catch (saveErr: any) {
                logger.error(`[EnhancedPreview] Failed to save assets to disk: ${saveErr.message}`);
                // Continue with memory assets if save fails
              }
            }

            // Inject asset variables into the wireframe HTML
            const assetScript = prototypeAssetGenerator.createAssetVariables(finalAssets);

            // Insert assets script right before closing </head>
            if (finalWireframeCode.includes('</head>')) {
              finalWireframeCode = finalWireframeCode.replace(
                '</head>',
                `${assetScript}\n</head>`
              );
              logger.info(`[EnhancedPreview] Injected ${finalAssets.length} custom assets`);
            }
          }
        }
      }
    } catch (assetError: any) {
      logger.warn('[EnhancedPreview] Asset generation failed, using fallbacks:', assetError.message);
      // Continue with original wireframe - assets are optional enhancement
    }

    // Stage 4: Finalize (90-100%)
    progressCallback('Stage 4', 95, 'Finalizing and validating preview...');

    // Emit progress before Stage 4
    if (generationSessionId) {
      generationStatusService.emitProgress(generationSessionId, 90, 'Finalizing preview...');
    }

    if (generationSessionId) {
      generationStatusService.emitProcessStage(generationSessionId, 'Final Review', { stage: 'stage_4', progress: 95 });
      generationStatusService.emitComplete(generationSessionId);
    }

    const risks = ['Technical complexity', 'Integration challenges', 'Scalability considerations'];

    // Stage 4: Generate Multi-View Previews in parallel
    progressCallback('Stage 4', 92, 'Generating admin console and wireframes...');


    // Stage 4: Generate Multi-View Previews
    if (generationSessionId) {
      generationStatusService.emitProgress(generationSessionId, 92, 'Generating multi-view previews...');
    }

    // Generate Admin Console and Wireframes in parallel
    let adminConsolePreview: string | undefined;
    let endUserWireframe: string | undefined;
    let adminConsoleWireframe: string | undefined;

    try {
      const [adminResult, endUserWfResult] = await Promise.allSettled([
        this.generateAdminConsolePreview(userGoal, requirements, techStack, architecture, isRegeneration, brainstormingContext), // REFACTORED CALL
        this.generateWireframeVersion(finalWireframeCode, 'endUser', userGoal)
      ]);

      if (adminResult.status === 'fulfilled') {
        adminConsolePreview = adminResult.value;
        logger.info(`[EnhancedPreview] Admin Console generated (${adminConsolePreview.length} chars)`);

        // Generate Admin Console wireframe
        try {
          adminConsoleWireframe = await this.generateWireframeVersion(adminConsolePreview, 'adminConsole', userGoal);
          logger.info(`[EnhancedPreview] Admin wireframe generated (${adminConsoleWireframe.length} chars)`);
        } catch (wfError: any) {
          logger.warn('[EnhancedPreview] Admin wireframe generation failed:', wfError.message);
        }
      } else {
        logger.warn('[EnhancedPreview] Admin Console generation failed:', adminResult.reason);
      }

      if (endUserWfResult.status === 'fulfilled') {
        endUserWireframe = endUserWfResult.value;
        logger.info(`[EnhancedPreview] End User wireframe generated (${endUserWireframe.length} chars)`);
      } else {
        logger.warn('[EnhancedPreview] End User wireframe generation failed:', endUserWfResult.reason);
      }
    } catch (multiViewError: any) {
      logger.warn('[EnhancedPreview] Multi-view generation error:', multiViewError.message);
    }

    if (generationSessionId) {
      generationStatusService.emitProgress(generationSessionId, 98, 'Building final preview...');
    }

    const preview: PreviewComponent = {
      projectName,
      summary,
      techStack,
      architectureDiagram: architecture,
      wireframeCode: finalWireframeCode,
      risks,
      recommendedMethodology,
      recommendedStandards,
      // Multi-view structure
      views: {
        endUser: {
          preview: finalWireframeCode,
          wireframe: endUserWireframe
        },
        adminConsole: adminConsolePreview ? {
          preview: adminConsolePreview,
          wireframe: adminConsoleWireframe
        } : undefined
      }
    };

    // Track usage if userId provided
    if (userId) {
      try {
        await usageTracker.trackUsage({
          userId: userId,
          projectId: projectId,
          modelId: 'enhanced-multi-model',
          provider: 'gemini',
          modelIdentifier: 'enhanced-multi-model',
          inputTokens: 0,
          outputTokens: 0,
          requestType: 'project-preview-enhanced',
          context: 'wizard',
          success: true,
          latencyMs: Date.now() - startTime
        });
      } catch (trackError) {
        logger.error('Failed to track usage:', trackError);
      }
    }

    progressCallback('Complete', 100, 'Preview generation complete');

    if (generationSessionId) {
      generationStatusService.emitComplete(generationSessionId);
    }
    return preview;
  }

  /**
   * Validate preview quality
   */
  async validatePreview(preview: PreviewComponent): Promise<{
    score: number;
    issues: Array<{ field: string; severity: 'critical' | 'warning' | 'info'; reason: string }>;
  }> {
    const issues: Array<{ field: string; severity: 'critical' | 'warning' | 'info'; reason: string }> = [];
    let score = 1.0;

    // Check summary
    if (!preview.summary || preview.summary.trim().length < 50) {
      issues.push({ field: 'summary', severity: 'critical', reason: 'Summary is too short or missing' });
      score -= 0.2;
    }

    // Check tech stack
    if (!preview.techStack || preview.techStack.length === 0) {
      issues.push({ field: 'techStack', severity: 'critical', reason: 'Tech stack is empty' });
      score -= 0.2;
    }

    // Check architecture
    if (!preview.architectureDiagram || preview.architectureDiagram.trim().length < 50) {
      issues.push({ field: 'architectureDiagram', severity: 'critical', reason: 'Architecture diagram is too short or missing' });
      score -= 0.2;
    }

    // Check wireframe
    if (!preview.wireframeCode || preview.wireframeCode.trim().length < 500) {
      issues.push({ field: 'wireframeCode', severity: 'critical', reason: 'Wireframe code is too short or missing' });
      score -= 0.4;
    } else {
      // Check if wireframe is valid HTML
      if (!preview.wireframeCode.includes('<!DOCTYPE') && !preview.wireframeCode.includes('<html')) {
        issues.push({ field: 'wireframeCode', severity: 'warning', reason: 'Wireframe may not be valid HTML' });
        score -= 0.1;
      }
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Retry wrapper with exponential backoff
   * NOTE: Reduced retries and delay for faster "Ready to Go" response
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2, // Reduced from 3 for faster response
    operationName: string = 'operation'
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        if (attempt === maxRetries) {
          logger.error(`[EnhancedPreview] ${operationName} failed after ${maxRetries} attempts: `, (error instanceof Error ? error.message : String(error)));
          throw error;
        }

        const delay = 500 * Math.pow(2, attempt - 1); // Reduced base delay from 1000ms to 500ms
        logger.warn(`[EnhancedPreview] ${operationName} failed(attempt ${attempt} / ${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`${operationName} failed after ${maxRetries} attempts`);
  }

  /**
   * Refactored wireframe generation using LLMRouter (V2)
   */
  async generateWireframeV2(
    userGoal: string,
    _requirements: ExtractedRequirements,
    fullPrompt: string,
    isRegeneration: boolean = false,
    brainstormingContext: any = null
  ): Promise<string> {
    // const startTime = Date.now(); // Unused
    logger.info('[EnhancedPreview] Starting wireframe generation (V2)...');

    try {
      const qualityInstructions = `
===== FINAL QUALITY CHECKLIST - VERIFY ALL BEFORE OUTPUT =====

✅ JSX SYNTAX VALIDATION (CRITICAL - PREVENTS RUNTIME ERRORS):
- EVERY opening tag MUST have a corresponding closing tag
- SCAN your output to verify ALL tags are properly closed
- Common unclosed tag errors that CRASH the app:
  - ❌ <a href="#">Link     ← MISSING </a> - WILL CRASH
  - ❌ <button onClick={...}>  ← MISSING </button> - WILL CRASH
  - ❌ <span className="...">  ← MISSING </span> - WILL CRASH
  - ✅ <a href="#">Link</a>
  - ✅ <button onClick={...}>Click</button>
  - ✅ <span className="...">text</span>
- Self-closing tags MUST use /> syntax:
  - ❌ <img src="...">      ← MISSING /> - WILL CRASH
  - ❌ <input type="text">  ← MISSING /> - WILL CRASH
  - ❌ <br>                 ← MISSING /> - WILL CRASH
  - ✅ <img src="..." />
  - ✅ <input type="text" />
  - ✅ <br />
- BEFORE outputting: mentally trace each <tag> to its </tag>
- Pay special attention to: <a>, <button>, <span>, <div>, <li>, <td>, <th>

✅ NO APP CRASHES:
- Handle errors gracefully (Try/Catch in handlers)
- Division by Zero? Return 0 or Infinity, DO NOT throw Error
- Missing data? Show loading state or default value
- Never let the entire app crash due to a runtime error

✅ ICONS MUST WORK:
- CDN: <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
- Usage: <i data-lucide="home" class="w-5 h-5"></i>
- CRITICAL: Add <script>lucide.createIcons();</script> at END of <body>

✅ EVERY BUTTON MUST HAVE A CLICK HANDLER:
- All buttons need onclick or addEventListener
- Show visual feedback (toast notifications, state changes)
- Example: btn.addEventListener('click', () => showToast('Done!'));

✅ TOAST NOTIFICATION FUNCTION (INCLUDE THIS):
function showToast(msg, type='success') {
  const colors = {success:'bg-emerald-500',error:'bg-red-500',info:'bg-indigo-500'};
  const t = document.createElement('div');
  t.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white shadow-xl z-50 ' + colors[type];
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

✅ COLOR CONSISTENCY:
- Primary: bg-indigo-600 hover:bg-indigo-700
- Secondary: bg-purple-600 hover:bg-purple-700
- Background: bg-slate-50 or bg-white
- Text: text-slate-900 (headings), text-slate-600 (body)
- Cards: bg-white rounded-xl shadow-lg p-6

✅ MOCK DATA (15-20 ITEMS):
- Use realistic names, dates, and content
- Avatars: https://i.pravatar.cc/150?u=1
- Images: https://picsum.photos/400/300?random=1

✅ ALL ELEMENTS NEED:
- transition-all duration-200
- hover:scale-105 or hover:bg-slate-100
- rounded-lg or rounded-xl
- Proper spacing (p-4, gap-4, space-y-4)

✅ REACT & BABEL CONFIGURATION (CRITICAL):
- MUST include: <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
- MUST include: <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
- MUST include: <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
- ALL custom scripts MUST utilize: <script type="text/babel">
- NO "import" or "export" statements (use React.useState, React.useEffect, etc.)
- NO "require" statements
- NO standard <script> tags for React code (will fail to parse)

Output ONLY valid HTML starting with <!DOCTYPE html>.
NO Markdown. NO explanations.
`;

      // Prepare refined context using reasoning LLM
      let refinedContext = '';
      if (brainstormingContext) {
        refinedContext = await this.refineBrainstormingContext(brainstormingContext);
      }

      // Query learnings from past fixes (scoped by project type)
      let learningsSection = '';
      try {
        const projectType = _requirements?.projectType || 'webapp';
        const genre = brainstormingContext?.genre;
        const learnings = await prototypeLearningService.getRelevantLearnings(projectType, genre, 5);
        if (learnings.length > 0) {
          learningsSection = '\n\n### KNOWN ISSUES TO AVOID (from past projects):\n';
          learnings.forEach(l => {
            learningsSection += `- Issue: "${l.issuePattern}" → Fix: "${l.fix}"\n`;
          });
          logger.info(`[EnhancedPreview] Applied ${learnings.length} learnings from past projects`);
        }
      } catch (learnErr: any) {
        logger.warn(`[EnhancedPreview] Failed to query learnings: ${learnErr.message}`);
      }

      const prompt = `
${fullPrompt}

${qualityInstructions}

${refinedContext}
${learningsSection}
`;

      logger.info(`[EnhancedPreview] Conversing with LLMRouter(Regen: ${isRegeneration})...`);

      // Use LLMRouter for reliable execution with fallback
      // UPGRADE: Use gemini-2.5-flash for faster generation to avoid timeouts

      const result = await Promise.race([
        llmRouter.executeWithFallback({
          prompt: prompt,
          context: {
            agentRole: 'UI/UX Designer',
            taskType: 'code-generation',
            systemInstruction: 'Output only HTML starting with <!DOCTYPE html>. No explanation. No Markdown.',
            skipCache: isRegeneration,
            model: 'gemini-2.5-flash', // Using stable model (gemini-3-flash-preview not yet available)
            disableStreaming: true
          },
          routingContext: {
            // we don't have userId/projectId easily accessible in this method signature currently,
            // but llmRouter handles undefined gracefully.
          },
          requestType: 'generation',
          contextType: 'wizard'
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => {
            logger.error('[EnhancedPreview] DEBUG: Wireframe V2 timeout fired after 300s!');
            reject(new Error('Wireframe generation timed out after 300s'));
          }, 300000)
        )
      ]);
      logger.info(`[EnhancedPreview] DEBUG: Promise.race resolved with result type: ${typeof result} `);
      logger.info(`[EnhancedPreview] LLMRouter returned result.Text length: ${result.text?.length || 0} `);

      const text = result.text || '';
      let htmlContent = this.extractHtml(text);

      // Fix React dependencies to prevent blank screen issues
      htmlContent = this.fixReactDependencies(htmlContent);

      if (!htmlContent || htmlContent.length < 50) {
        throw new Error('Generated content is too short or invalid HTML');
      }

      logger.info(`[EnhancedPreview] Wireframe generated successfully via Router V2(${htmlContent.length} chars)`);
      return htmlContent;

    } catch (error: unknown) {
      logger.error(`[EnhancedPreview] Wireframe V2 generation failed: ${(error instanceof Error ? error.message : String(error))}`);

      if ((error as any).lastModel) {
        logger.error(`[EnhancedPreview] Failed model: ${(error as any).lastModel}`);
      }

      // Return fallback template instead of throwing - prevent blank screens
      logger.warn('[EnhancedPreview] Using fallback wireframe template');
      return this.generateFallbackWireframe(userGoal);
    }
  }

  /**
   * Refine the raw brainstorming context using a reasoning LLM.
   * Returns a concise markdown block that can be inserted into the generation prompt.
   */
  private async refineBrainstormingContext(_context: any): Promise<string> {
    const reasoningPrompt = `You are given a JSON brainstorming context. Extract only the essential information for generating a prototype:\n- The exact game genre (e.g., Chess, Snake)\n- Core mechanics that must be implemented\n- Anti‑hybrid constraints that must NOT appear.\nReturn a short markdown snippet that can be appended to the generation prompt. Do not include any explanations.`;
    try {
      const result = await llmRouter.executeWithFallback({
        prompt: reasoningPrompt,
        context: {
          model: 'gemini-2.5-pro', // Using stable model (gemini-3-pro-preview for reasoning when available)
          taskType: 'analysis',
          agentRole: 'assistant',
          systemInstruction: 'Return only the refined markdown, no extra text.',
          skipCache: true,
          disableStreaming: true,
        },
        routingContext: {},
        requestType: 'generation',
        contextType: 'wizard',
      });
      return result.text?.trim() ?? '';
    } catch (e: unknown) {
      logger.warn('[EnhancedPreview] Reasoning step failed, falling back to raw context');
      return '';
    }
  }


  /**
   * Generate Admin Console/Dashboard preview
   * Creates a management dashboard UI with data tables, charts, and admin controls
   */
  async generateAdminConsolePreview(
    userGoal: string,
    requirements: ExtractedRequirements,
    _techStack: string[],
    _architecture: string,
    isRegeneration: boolean = false,
    brainstormingContext: any = null
  ): Promise<string> {
    // const _startTime = Date.now();
    logger.info('[EnhancedPreview] Generating Admin Console preview (REFACTORED)...');

    // Declare variables for error context
    let isGame = false;
    let adminFeatures: string[] = [];
    let cleanGoal = '';

    try {
      // 1. INPUT PREP & FEATURE ANALYSIS
      cleanGoal = this.cleanXmlTags(userGoal);
      const cleanFeatures = requirements.features.map(f => this.cleanXmlTags(f));

      // Use feature categorization service
      const categorized = featureCategorizationService.categorizeFeatures(
        cleanFeatures,
        requirements.projectType
      );

      adminFeatures = categorized.adminFacing;
      isGame = requirements.projectType === 'game';

      // 2. FORCE ADMIN GENERATION
      // Always generate an admin console, inferring features if needed
      if (adminFeatures.length === 0) {
        adminFeatures = this.inferAdminFeatures(cleanGoal, requirements.features);
        logger.info(`[EnhancedPreview] Auto-inferred ${adminFeatures.length} admin features for business platform`);
      }

      const featuresList = adminFeatures.length > 0
        ? adminFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : 'User Management, Content Management, System Settings, Activity Logs';

      // 3. BUILD ROBUST PROMPT (Ported from generateAdminWireframe)
      const prompt = isGame
        ? `Create a COMPLETE, PRODUCTION-LEVEL React GAME DASHBOARD as a single HTML file.

**PROJECT CONTEXT:**
The user is building: "${cleanGoal.substring(0, 500)}"
This is the **GAME DASHBOARD/MANAGEMENT INTERFACE** for that game, used to configure powers, view stats, and manage game settings.

**GAME DASHBOARD FEATURES:**
${featuresList}

${brainstormingContext?.ideas ? `**BRAINSTORMED GAME FEATURES (Create dashboard controls for these):**
${brainstormingContext.ideas.map((i: any) => `- ${i.label}: ${i.description}`).join('\n')}
` : ''}

**GAME DASHBOARD REQUIREMENTS (CRITICAL):**
1.  **Direct Game Control (PostMessage)**:
    - ALL sliders/inputs MUST send real-time updates to the game iframe.
    - Usage: \`parent.postMessage({ type: 'UPDATE_VAR', payload: { var: 'player.speed', value: 300 } }, '*')\`
    - Variables: player.speed, jumpHeight, health, keyItems, enemyCount.
    - VISUAL FEEDBACK: Show a green "Updated!" toast when values change.
2.  **Live Game Stats (Listener)**:
    - Listen for updates: \`window.addEventListener('message', e => { if (e.data.type === 'STATE_UPDATE') updateStats(e.data.payload) })\`
    - Display Score, Level, Lives in real-time cards.
3.  **UI Components**:
    - "God Mode" toggle switch.
    - "Spawn Enemy" button.
    - "Reset Level" button.

**DESIGN:** Dark gaming theme (purple/indigo), Lucide icons (gamepad, zap), React+Tailwind.

**OUTPUT:** Single HTML file starting with <!DOCTYPE html>. NO MARKDOWN.`
        : `Create a COMPLETE, PRODUCTION-LEVEL React ADMIN CONSOLE as a single HTML file.

**PROJECT CONTEXT:**
The user is building: "${cleanGoal.substring(0, 500)}"
This is the **ADMINISTRATIVE BACKOFFICE** for that project.

**REQUIRED ADMIN FEATURES:**
${featuresList}

**ADMIN CONSOLE REQUIREMENTS:**
1.  **Structure**: Professional Sidebar + Top Navbar + Content Area.
2.  **Dashboard**: Key Metrics (Cards), Charts (Chart.js), Activity Feed.
3.  **Data Tables**:
    - Sortable/Filterable tables for Users/Content.
    - "Edit" modals for rows.
4.  **Connection Simulation**:
    - Include a "Simulate Live Connection" toggle.
    - When active, update graph data randomly every 3s to simulate activity.

**DESIGN:**
- Professional SaaS look (Slate/Gray/Indigo).
- Solid typography (Inter/System fonts).
- Responsive grid layouts.

**TECH:** React, Tailwind CSS, Lucide Icons, Chart.js.

**OUTPUT:** Single HTML file starting with <!DOCTYPE html>. NO MARKDOWN.`;

      // 4. EXECUTE GENERATION
      const result = await llmRouter.executeWithFallback({
        prompt: prompt,
        context: {
          agentRole: 'Admin UI Developer',
          taskType: 'code-generation',
          systemInstruction: 'Output only HTML starting with <!DOCTYPE html>. No explanation. No Markdown.',
          skipCache: isRegeneration,
          model: 'gemini-2.5-flash'
        },
        requestType: 'generation',
        contextType: 'wizard'
      });

      // 5. EXTRACT & VALIDATE
      let html = this.extractHtml(result.text || '');

      // Fix React dependencies to prevent blank screen issues
      html = this.fixReactDependencies(html);

      if (!html || html.length < 100) {
        throw new Error('Generated Admin HTML is empty or too short');
      }

      logger.info(`[EnhancedPreview] Admin Console generated successfully (${html.length} chars)`);
      return html;

    } catch (error: unknown) {
      logger.error('[EnhancedPreview] Admin Console generation failed:', error);

      // 6. ROBUST FALLBACK
      // If validation/generation fails, return a safe fallback template
      if (isGame) {
        return this.generateFallbackDashboard(cleanGoal);
      } else {
        return this.generateFallbackAdminConsole(cleanGoal, adminFeatures);
      }
    }
  }

  /**
   * Generate low-fidelity wireframe version of a preview
   * Creates grayscale, annotated, placeholder-based wireframe
   */
  async generateWireframeVersion(
    originalPreview: string,
    viewType: 'endUser' | 'adminConsole',
    userGoal: string
  ): Promise<string> {
    logger.info(`[EnhancedPreview] Generating wireframe for ${viewType}...`);

    try {
      const prompt = `
Convert the following HTML into a LOW-FIDELITY WIREFRAME version.

ORIGINAL HTML (${viewType === 'adminConsole' ? 'Admin Console' : 'End User'} view):
${originalPreview.substring(0, 5000)}... [truncated for brevity]

PROJECT: ${userGoal}

WIREFRAME REQUIREMENTS:
1. **GRAYSCALE ONLY**:
   - Background: bg-gray-100 or bg-gray-200
   - Elements: bg-gray-300, bg-gray-400, bg-gray-500
   - Text: text-gray-700, text-gray-800
   - NO colors (no blue, green, red, etc.)

2. **PLACEHOLDER BOXES**:
   - Images → Gray rectangles with "Image Placeholder" text
   - Icons → Simple squares with icon name
   - Avatars → Gray circles with initials

3. **ANNOTATIONS**:
   - Add HTML comments like <!-- Header Section --> 
   - Add visible labels for sections: "[Navigation]", "[Hero Banner]", "[Data Table]"
   - Use dashed borders: border-dashed border-2 border-gray-400

4. **SIMPLIFIED STYLING**:
   - Remove shadows, gradients, animations
   - Use simple rectangular shapes
   - Keep layout structure intact
   - Add rounded corners: rounded-lg

5. **VISIBLE GRID LINES**:
   - Show layout structure with visible borders
   - Add grid gaps visibly

6. **KEEP FUNCTIONAL**:
   - Still include basic JavaScript for interactivity
   - Placeholder text for all content

Output ONLY valid HTML starting with <!DOCTYPE html>.
NO Markdown. NO explanations.
`;

      const result = await llmRouter.executeWithFallback({
        prompt: prompt,
        context: {
          agentRole: 'UI/UX Designer',
          taskType: 'code-generation',
          systemInstruction: 'Output only wireframe HTML. Grayscale only. No colors.',
          model: 'gemini-2.5-flash'
        },
        requestType: 'generation',
        contextType: 'wizard'
      });

      const wireframe = result.text || '';
      logger.info(`[EnhancedPreview] Wireframe generated for ${viewType} (${wireframe.length} chars)`);
      return wireframe;

    } catch (error: unknown) {
      logger.error(`[EnhancedPreview] Wireframe generation failed for ${viewType}:`, error);
      // Return simplified grayscale version as fallback
      return this.createSimpleWireframeFallback(viewType, userGoal);
    }
  }

  /**
   * Fallback Admin Console when generation fails
   */
  // @ts-ignore TS6133
  private _getFallbackAdminConsole(userGoal: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Console - ${userGoal.substring(0, 30)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
</head>
<body class="bg-gray-100">
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-64 bg-slate-800 text-white">
      <div class="p-6">
        <h1 class="text-xl font-bold">Admin Console</h1>
      </div>
      <nav class="mt-6">
        <a href="#" class="block px-6 py-3 bg-slate-700">Dashboard</a>
        <a href="#" class="block px-6 py-3 hover:bg-slate-700">Users</a>
        <a href="#" class="block px-6 py-3 hover:bg-slate-700">Settings</a>
      </nav>
    </div>
    <!-- Main Content -->
    <div class="flex-1 p-8">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl p-6 shadow">
          <h3 class="text-gray-500">Total Users</h3>
          <p class="text-3xl font-bold">1,234</p>
        </div>
        <div class="bg-white rounded-xl p-6 shadow">
          <h3 class="text-gray-500">Active Sessions</h3>
          <p class="text-3xl font-bold">56</p>
        </div>
        <div class="bg-white rounded-xl p-6 shadow">
          <h3 class="text-gray-500">Revenue</h3>
          <p class="text-3xl font-bold">$12,345</p>
        </div>
      </div>
    </div>
  </div>
  <script>lucide.createIcons();</script>
</body>
</html>`;
  }

  /**
   * Simple wireframe fallback
   */
  private createSimpleWireframeFallback(viewType: string, userGoal: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireframe - ${viewType}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-200 p-8">
  <div class="max-w-4xl mx-auto">
    <!-- [HEADER] -->
    <div class="bg-gray-300 h-16 rounded-lg mb-6 border-2 border-dashed border-gray-400 flex items-center px-4">
      <span class="text-gray-600 font-mono">[Navigation Bar]</span>
    </div>
    
    <!-- [MAIN CONTENT] -->
    <div class="bg-gray-100 rounded-lg p-6 border-2 border-dashed border-gray-400">
      <div class="text-gray-600 font-mono mb-4">[${viewType === 'adminConsole' ? 'Admin Dashboard' : 'End User'} View]</div>
      <div class="text-gray-500 text-sm">${userGoal.substring(0, 100)}</div>
      
      <!-- [Content Grid] -->
      <div class="grid grid-cols-3 gap-4 mt-6">
        <div class="bg-gray-300 h-32 rounded border-2 border-dashed border-gray-400 flex items-center justify-center">
          <span class="text-gray-500 text-xs">[Card 1]</span>
        </div>
        <div class="bg-gray-300 h-32 rounded border-2 border-dashed border-gray-400 flex items-center justify-center">
          <span class="text-gray-500 text-xs">[Card 2]</span>
        </div>
        <div class="bg-gray-300 h-32 rounded border-2 border-dashed border-gray-400 flex items-center justify-center">
          <span class="text-gray-500 text-xs">[Card 3]</span>
        </div>
      </div>
    </div>
    
    <!-- [FOOTER] -->
    <div class="bg-gray-300 h-12 rounded-lg mt-6 border-2 border-dashed border-gray-400 flex items-center px-4">
      <span class="text-gray-600 font-mono text-sm">[Footer]</span>
    </div>
  </div>
</body>
</html>`;
  }


  private generateFallbackWireframe(projectGoal: string): string {
    const projectName = projectGoal.substring(0, 60) || 'Loading';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${projectName}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center"><h1 class="text-2xl font-bold mb-4">${projectName}</h1><p class="text-slate-600 mb-6">Generating your prototype...</p><button onclick="location.reload()" class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Retry</button></div></body></html>`;
  }
}
