import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import mermaid from 'mermaid';
import { AlertCircle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

interface MermaidDiagramProps {
  /**
   * The Mermaid diagram code (without markdown code blocks)
   */
  code: string;
  /**
   * Optional title for the diagram
   */
  title?: string;
  /**
   * Callback when diagram renders successfully
   */
  onRenderSuccess?: () => void;
  /**
   * Callback when diagram fails to render
   */
  onRenderError?: (error: Error) => void;
  /**
   * Enable fullscreen mode
   */
  allowFullscreen?: boolean;
  /**
   * Custom theme (default: 'base')
   */
  theme?: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
}

/**
 * A React component for rendering Mermaid diagrams
 * Based on open-source best practices and the official Mermaid.js library
 * 
 * This component:
 * - Uses the official mermaid npm package (not CDN)
 * - Renders directly in the DOM (not in iframe)
 * - Provides better error handling and stability
 * - Supports zoom, pan, and fullscreen
 */
const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  code,
  title,
  onRenderSuccess,
  onRenderError,
  allowFullscreen = true,
  theme = 'base'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramIdRef = useRef<string>(`mermaid-${Math.random().toString(36).substring(7)}`);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize Mermaid once
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme as 'default' | 'dark' | 'forest' | 'neutral' | 'base' | 'null',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#2563eb',
        lineColor: '#64748b',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#e2e8f0'
      }
    });
  }, [theme]);

  // Attempt to auto-fix common syntax errors - More aggressive multi-pass approach
  const attemptAutoFix = (code: string, errorMessage: string): string => {
    let fixed = code;

    // ===== PASS 1: Split C4Container/C4System/C4Person from function names =====
    // This must happen FIRST
    // Handle C4ContainerPerson -> C4Person (common concatenation error)
    fixed = fixed.replace(/C4ContainerPerson/gi, 'C4Person');
    // Handle C4ContainerSystem -> C4System
    fixed = fixed.replace(/C4ContainerSystem/gi, 'C4System');
    // Handle C4ContainerC4Context -> C4Container (C4Context is not a valid directive)
    fixed = fixed.replace(/C4ContainerC4Context/gi, 'C4Container');
    // Handle C4SystemC4Context -> C4System
    fixed = fixed.replace(/C4SystemC4Context/gi, 'C4System');
    // Handle C4PersonC4Context -> C4Person
    fixed = fixed.replace(/C4PersonC4Context/gi, 'C4Person');
    // Remove standalone invalid C4Context directives
    fixed = fixed.replace(/C4Context\s+/gi, '');
    fixed = fixed.replace(/\s+C4Context/gi, '');
    // Handle both uppercase and lowercase function names after directives
    fixed = fixed.replace(/C4Container([A-Z][a-zA-Z_]*\()/g, 'C4Container\n$1');
    fixed = fixed.replace(/C4Container([a-z][a-zA-Z_]*\()/g, (match, func) => {
      // Capitalize first letter of function name
      const capitalizedFunc = func.charAt(0).toUpperCase() + func.slice(1);
      return `C4Container\n${capitalizedFunc}`;
    });
    fixed = fixed.replace(/C4System([A-Z][a-zA-Z_]*\()/g, 'C4System\n$1');
    fixed = fixed.replace(/C4System([a-z][a-zA-Z_]*\()/g, (match, func) => {
      const capitalizedFunc = func.charAt(0).toUpperCase() + func.slice(1);
      return `C4System\n${capitalizedFunc}`;
    });
    fixed = fixed.replace(/C4Person([A-Z][a-zA-Z_]*\()/g, 'C4Person\n$1');
    fixed = fixed.replace(/C4Person([a-z][a-zA-Z_]*\()/g, (match, func) => {
      const capitalizedFunc = func.charAt(0).toUpperCase() + func.slice(1);
      return `C4Person\n${capitalizedFunc}`;
    });
    // Handle cases where C4Container is concatenated with lowercase text (like "C4Containerperson")
    fixed = fixed.replace(/C4Container([a-z]+)([A-Z])/g, 'C4Container\n$1$2');
    // Fix SystemBoundary truncated to SystemBoun
    fixed = fixed.replace(/SystemBoun(dary)?/gi, 'SystemBoundary');

    // ===== PASS 1.5: Fix arrow syntax in C4 diagrams =====
    // C4 diagrams use Rel() for relationships, not arrows
    // Convert ALL arrow syntax to Rel() format - be aggressive to catch all cases
    // Pattern: "A -> B" or "A -> B: Label" (with or without quotes, with complex labels)
    fixed = fixed.replace(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)(?:\s*:\s*([^,\n)]+))?/g, (match, source, target, label) => {
      if (label) {
        // Clean and escape the label
        let cleanLabel = label.trim();
        // Remove surrounding quotes if present
        cleanLabel = cleanLabel.replace(/^["']|["']$/g, '');
        // Escape any remaining quotes
        cleanLabel = cleanLabel.replace(/"/g, '\\"');
        return `Rel(${source}, ${target}, "${cleanLabel}")`;
      } else {
        return `Rel(${source}, ${target}, "")`;
      }
    });

    // ===== PASS 1.6: Remove Rel() calls that use C4 directives as identifiers =====
    // C4Person, C4Container, C4System are directives, not identifiers
    // Rel(C4Person, ...) is invalid - remove these calls completely
    // This must happen BEFORE other Rel() fixes to prevent processing invalid calls
    // Use a more aggressive approach that finds and removes entire Rel() calls
    // Find all Rel() calls and check if they contain C4 directives
    let searchIndex = 0;
    while (searchIndex < fixed.length) {
      const relIndex = fixed.indexOf('Rel(', searchIndex);
      if (relIndex < 0) break;

      // Find the matching closing paren for this Rel() call
      let parenCount = 1;
      let currentIndex = relIndex + 4; // Skip "Rel("

      while (currentIndex < fixed.length && parenCount > 0) {
        const char = fixed[currentIndex];
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        currentIndex++;
      }

      // Extract the Rel() call content
      const relCall = fixed.substring(relIndex, currentIndex);

      // Check if this Rel() call contains a C4 directive
      if (relCall.match(/C4(Person|Container|System)/i)) {
        // Remove this invalid Rel() call
        fixed = fixed.substring(0, relIndex) + fixed.substring(currentIndex);
        // Don't advance searchIndex - check the same position again in case there are more
      } else {
        searchIndex = currentIndex;
      }
    }

    // ===== PASS 1.6.5: Fix malformed Rel() calls with nested quotes =====
    // The error shows: Rel(C4Person, GameClient, "Plays the Gamesystem "Infinite Jumper Quest"
    // The nested quote breaks the syntax. We need to escape nested quotes.
    // Strategy: Find all Rel() calls and fix quotes inside the third parameter
    // Use a simpler approach without lookbehind (which may not be supported)
    fixed = fixed.replace(/Rel\(([^,]+),\s*([^,]+),\s*"([^"]*(?:"[^,)]*)*)"([^)]*)/g, (match, source, target, labelContent, rest) => {
      // If labelContent contains unescaped quotes, escape them
      // Process character by character to avoid lookbehind
      let escapedLabel = '';
      for (let i = 0; i < labelContent.length; i++) {
        if (labelContent[i] === '"' && (i === 0 || labelContent[i - 1] !== '\\')) {
          escapedLabel += '\\"';
        } else {
          escapedLabel += labelContent[i];
        }
      }
      // Check if rest has a closing paren
      if (rest.includes(')')) {
        return `Rel(${source}, ${target}, "${escapedLabel}")${rest}`;
      } else {
        // Missing closing paren - try to find it or add it
        return `Rel(${source}, ${target}, "${escapedLabel}")${rest})`;
      }
    });

    // ===== PASS 1.7: Fix unclosed Rel() calls =====
    // Find and fix Rel() calls that are missing closing parentheses
    // This is a more aggressive approach that processes the entire string
    let searchIndex2 = 0;
    while (searchIndex2 < fixed.length) {
      const relIndex = fixed.indexOf('Rel(', searchIndex2);
      if (relIndex < 0) break;

      // Find the matching closing paren for this Rel() call
      let parenCount = 1;
      let currentIndex = relIndex + 4; // Skip "Rel("

      while (currentIndex < fixed.length && parenCount > 0) {
        const char = fixed[currentIndex];
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        currentIndex++;
      }

      // If we didn't find a closing paren, add one
      if (parenCount > 0) {
        fixed = fixed.substring(0, currentIndex) + ')' + fixed.substring(currentIndex);
        searchIndex2 = currentIndex + 1;
      } else {
        searchIndex2 = currentIndex;
      }
    }

    // ===== PASS 2: Fix missing newlines between function calls =====
    // Pattern 1: ")FunctionName(" -> ")\nFunctionName("
    fixed = fixed.replace(/\)\s*([A-Z][a-zA-Z_]*\()/g, ')\n$1');

    // Pattern 2: ")"FunctionName(" -> ")\nFunctionName(" (quote between calls)
    fixed = fixed.replace(/\)"\s*([A-Z][a-zA-Z_]*\()/g, ')"\n$1');

    // Pattern 3: ")"text"FunctionName(" -> ")"text"\nFunctionName("
    fixed = fixed.replace(/\)"\s*"([^"]*)"\s*([A-Z][a-zA-Z_]*\()/g, ')"\n"$1"\n$2');

    // Pattern 4: Handle direct concatenation without quotes
    fixed = fixed.replace(/([A-Z][a-zA-Z_]*\))\s*([A-Z][a-zA-Z_]*\()/g, '$1\n$2');

    // ===== PASS 3: Fix function names =====
    fixed = fixed.replace(/SystemExt\(/gi, 'System_Ext(');
    fixed = fixed.replace(/Container_Component\(/g, 'Container(');
    fixed = fixed.replace(/System_Backend\(/g, 'System(');

    // ===== PASS 4: Split multi-function lines =====
    const lines = fixed.split('\n');
    const splitLines: string[] = [];

    for (const line of lines) {
      // Count function calls in this line
      const functionCalls = line.match(/([A-Z][a-zA-Z_]*\()/g);
      if (functionCalls && functionCalls.length > 1) {
        // Split the line at function boundaries
        // Find positions of function starts
        const parts: string[] = [];
        let lastIndex = 0;

        functionCalls.forEach((funcMatch, idx) => {
          const funcIndex = line.indexOf(funcMatch, lastIndex);
          if (idx === 0 && funcIndex > 0) {
            // There's text before the first function
            parts.push(line.substring(0, funcIndex));
          }

          // Find the matching closing paren for this function
          let parenCount = 0;
          let endIndex = funcIndex + funcMatch.length;
          for (let i = funcIndex; i < line.length; i++) {
            if (line[i] === '(') parenCount++;
            if (line[i] === ')') parenCount--;
            if (parenCount === 0 && i > funcIndex) {
              endIndex = i + 1;
              break;
            }
          }

          parts.push(line.substring(funcIndex, endIndex));
          lastIndex = endIndex;
        });

        // Add remaining text after last function
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }

        splitLines.push(...parts.filter(p => p.trim().length > 0));
      } else {
        splitLines.push(line);
      }
    }

    fixed = splitLines.join('\n');

    // ===== PASS 5: Fix missing quotes in parameters =====
    fixed = fixed.replace(/(Container|System|Person|SystemDb|SystemQueue|System_Ext)\(([^,)]+),\s*([^"')]+)\)/g, (match, func, id, desc) => {
      const trimmedDesc = desc.trim();
      if (!trimmedDesc.startsWith('"') && !trimmedDesc.startsWith("'")) {
        return `${func}(${id}, "${trimmedDesc.replace(/"/g, '\\"')}")`;
      }
      return match;
    });

    // ===== PASS 6: Fix unclosed parentheses =====
    const openParens = (fixed.match(/\(/g) || []).length;
    const closeParens = (fixed.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      fixed += ')'.repeat(openParens - closeParens);
    }

    // ===== PASS 7: Fix unclosed quotes =====
    const openQuotes = (fixed.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
      const lastQuoteIndex = fixed.lastIndexOf('"');
      if (lastQuoteIndex >= 0) {
        // Try to find where the quote should close
        const afterQuote = fixed.substring(lastQuoteIndex + 1);
        const nextFunction = afterQuote.match(/^([^A-Z]*)([A-Z][a-zA-Z_]*\()/);
        if (nextFunction) {
          // Insert closing quote before the next function
          fixed = fixed.substring(0, lastQuoteIndex + 1) + '"' + fixed.substring(lastQuoteIndex + 1);
        }
      }
    }

    // ===== PASS 8: Ensure C4Container is on its own line and fix title directive =====
    const pass8Lines = fixed.split('\n');
    if (pass8Lines.length > 0) {
      const firstLine = pass8Lines[0].trim();
      if (firstLine.match(/^C4Container/i) && firstLine.length > 10) {
        // C4Container is combined with other text
        const rest = firstLine.replace(/^C4Container/i, '').trim();
        if (rest) {
          // Check if rest contains "title" directive
          if (rest.match(/^title\s+/i)) {
            // Extract title text
            const titleMatch = rest.match(/^title\s+(.+)/i);
            if (titleMatch) {
              const titleText = titleMatch[1].trim();
              fixed = 'C4Container\ntitle ' + titleText + '\n' + pass8Lines.slice(1).join('\n');
            } else {
              fixed = 'C4Container\n' + rest + '\n' + pass8Lines.slice(1).join('\n');
            }
          } else {
            fixed = 'C4Container\n' + rest + '\n' + pass8Lines.slice(1).join('\n');
          }
        }
      } else if (!firstLine.match(/^(C4Container|C4System|C4Person)/i)) {
        // Check if we need to add C4Container
        if (fixed.includes('Container(') || fixed.includes('System(') || fixed.includes('Person(') || fixed.includes('System_Ext(')) {
          fixed = 'C4Container\n' + fixed;
        }
      }
    }

    // Fix title directive that might be on the same line as C4Container or other directives
    fixed = fixed.replace(/(C4Container|C4System|C4Person)\s+title\s+/gi, '$1\ntitle ');

    // ===== PASS 9: Fix unclosed Rel() calls and parentheses =====
    // Ensure all Rel() calls are properly closed
    const finalLines = fixed.split('\n');
    const fixedLines: string[] = [];
    for (const line of finalLines) {
      let fixedLine = line.trim();
      if (!fixedLine) continue;

      // Count parentheses in Rel() calls
      const relCalls = fixedLine.match(/Rel\([^)]*/g);
      if (relCalls) {
        relCalls.forEach(relCall => {
          const openParens = (relCall.match(/\(/g) || []).length;
          const closeParens = (relCall.match(/\)/g) || []).length;
          if (openParens > closeParens) {
            // Find where this Rel() call is in the line
            const relIndex = fixedLine.indexOf(relCall);
            if (relIndex >= 0) {
              // Look for the end of the Rel() call
              let endIndex = relIndex + relCall.length;
              let parenCount = openParens - closeParens;
              // Check if there's a closing paren after this
              while (parenCount > 0 && endIndex < fixedLine.length) {
                if (fixedLine[endIndex] === ')') {
                  parenCount--;
                } else if (fixedLine[endIndex] === '(') {
                  parenCount++;
                }
                endIndex++;
              }
              // If still unclosed, add closing parens
              if (parenCount > 0) {
                fixedLine = fixedLine.substring(0, endIndex) + ')'.repeat(parenCount) + fixedLine.substring(endIndex);
              }
            }
          }
        });
      }

      fixedLines.push(fixedLine);
    }
    fixed = fixedLines.join('\n');

    // ===== PASS 10: Final cleanup =====
    fixed = fixed
      .replace(/\n\n+/g, '\n') // Remove multiple newlines
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return fixed;
  };

  // Clean and validate Mermaid code - Multi-pass approach
  const cleanMermaidCode = (rawCode: string): string => {
    if (!rawCode) return '';

    let cleaned = rawCode;

    // ===== PASS 0: Detect and convert PlantUML to Mermaid =====
    // PlantUML (used by C4-PlantUML) is NOT compatible with Mermaid
    // If we detect PlantUML syntax, we need to strip it and convert to Mermaid C4
    const isPlantUML =
      cleaned.includes('!define') ||
      cleaned.includes('!include') ||
      cleaned.includes('@startuml') ||
      cleaned.includes('@enduml') ||
      cleaned.includes('$sprite') ||
      cleaned.includes('AddRelTag') ||
      cleaned.includes('LAYOUT_') ||
      /plantuml-icon-font-sprites/.test(cleaned) ||
      /C4-PlantUML/.test(cleaned);

    if (isPlantUML) {
      console.log('[MermaidDiagram] PlantUML detected - converting to Mermaid C4 format');

      // Remove PlantUML-specific directives
      cleaned = cleaned
        .replace(/!define\s+[^\n]+/g, '')           // Remove !define lines
        .replace(/!include\s+[^\n]+/g, '')          // Remove !include lines
        .replace(/!includeurl\s+[^\n]+/g, '')       // Remove !includeurl lines
        .replace(/@startuml[^\n]*/g, '')            // Remove @startuml
        .replace(/@enduml/g, '')                    // Remove @enduml
        .replace(/skinparam\s+[^\n]+/g, '')         // Remove skinparam lines
        .replace(/AddRelTag\([^)]+\)/g, '')         // Remove AddRelTag calls
        .replace(/LAYOUT_[A-Z_]+\(\)/g, '')         // Remove LAYOUT_* calls
        .replace(/SHOW_[A-Z_]+\(\)/g, '')           // Remove SHOW_* calls
        .replace(/UpdateLayoutConfig\([^)]+\)/g, '') // Remove UpdateLayoutConfig
        .replace(/\$sprite\s*=\s*[^,)]+/g, '')      // Remove $sprite parameters
        .replace(/,\s*\$sprite\s*=/g, '')           // Remove trailing sprite parameters
        .replace(/title\s+[^\n]+/g, (match) => {    // Convert PlantUML title to Mermaid title
          return match.replace('title ', 'title ');
        });

      // Normalize C4 function calls from PlantUML to Mermaid syntax
      // PlantUML: Container(id, "Name", "Tech", "Description")
      // Mermaid:  Container(id, "Name", "Description", "Tech") - same format, but let's clean up

      // Clean up empty lines and extra whitespace
      cleaned = cleaned
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

      // Ensure C4Container directive is at the start
      if (!cleaned.startsWith('C4Container') && !cleaned.startsWith('C4System') && !cleaned.startsWith('C4Person')) {
        if (cleaned.includes('Container(') || cleaned.includes('System(') || cleaned.includes('Person(')) {
          cleaned = 'C4Container\n' + cleaned;
        }
      }
    }

    // ===== PASS 1: Normalize whitespace and remove markdown =====
    cleaned = cleaned
      .replace(/```(?:mermaid|mmd)?/gi, '')
      .replace(/```/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/  +/g, ' ') // Normalize multiple spaces
      .trim();

    // ===== PASS 2: Split C4Container/C4System/C4Person from function names =====
    // This must happen BEFORE other processing
    // Handle C4ContainerPerson -> C4Person (common concatenation error)
    cleaned = cleaned.replace(/C4ContainerPerson/gi, 'C4Person');
    // Handle C4ContainerSystem -> C4System
    cleaned = cleaned.replace(/C4ContainerSystem/gi, 'C4System');
    // Handle C4ContainerC4Context -> C4Container (C4Context is not a valid directive)
    cleaned = cleaned.replace(/C4ContainerC4Context/gi, 'C4Container');
    // Handle C4SystemC4Context -> C4System
    cleaned = cleaned.replace(/C4SystemC4Context/gi, 'C4System');
    // Handle C4PersonC4Context -> C4Person
    cleaned = cleaned.replace(/C4PersonC4Context/gi, 'C4Person');
    // Remove standalone invalid C4Context directives
    cleaned = cleaned.replace(/C4Context\s+/gi, '');
    cleaned = cleaned.replace(/\s+C4Context/gi, '');
    // Handle both uppercase and lowercase function names after directives
    cleaned = cleaned
      .replace(/C4Container([A-Z][a-zA-Z_]*\()/g, 'C4Container\n$1')
      .replace(/C4Container([a-z][a-zA-Z_]*\()/g, (match, func) => {
        // Capitalize first letter of function name
        const capitalizedFunc = func.charAt(0).toUpperCase() + func.slice(1);
        return `C4Container\n${capitalizedFunc}`;
      })
      .replace(/C4System([A-Z][a-zA-Z_]*\()/g, 'C4System\n$1')
      .replace(/C4System([a-z][a-zA-Z_]*\()/g, (match, func) => {
        const capitalizedFunc = func.charAt(0).toUpperCase() + func.slice(1);
        return `C4System\n${capitalizedFunc}`;
      })
      .replace(/C4Person([A-Z][a-zA-Z_]*\()/g, 'C4Person\n$1')
      .replace(/C4Person([a-z][a-zA-Z_]*\()/g, (match, func) => {
        const capitalizedFunc = func.charAt(0).toUpperCase() + func.slice(1);
        return `C4Person\n${capitalizedFunc}`;
      });
    // Handle cases where C4Container is concatenated with lowercase text (like "C4Containerperson")
    cleaned = cleaned.replace(/C4Container([a-z]+)([A-Z])/g, 'C4Container\n$1$2');
    // Fix SystemBoundary truncated to SystemBoun
    cleaned = cleaned.replace(/SystemBoun(dary)?/gi, 'SystemBoundary');

    // ===== PASS 2.5: Fix arrow syntax in C4 diagrams =====
    // C4 diagrams use Rel() for relationships, not arrows
    // Pattern: "Person -> Container: Label" should become "Rel(Person, Container, \"Label\")"
    // Handle all arrow syntax patterns, including those with complex labels
    // Pattern 1: Simple arrow "A -> B" or "A -> B: Label"
    cleaned = cleaned.replace(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)(?:\s*:\s*"([^"]*)")?/g, (match, source, target, label) => {
      if (label) {
        // Escape quotes in label
        const escapedLabel = label.replace(/"/g, '\\"');
        return `Rel(${source}, ${target}, "${escapedLabel}")`;
      } else {
        return `Rel(${source}, ${target}, "")`;
      }
    });
    // Pattern 2: Arrow with unquoted label "A -> B: Label"
    cleaned = cleaned.replace(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)\s*:\s*"([^"]*)"([^,\n)]*)/g, (match, source, target, label, rest) => {
      // Handle cases where label might have nested quotes or other issues
      const cleanLabel = label.replace(/"/g, '\\"');
      return `Rel(${source}, ${target}, "${cleanLabel}")${rest}`;
    });
    // Pattern 3: Arrow without quotes "A -> B: Label"
    cleaned = cleaned.replace(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)\s*:\s*([^,\n)]+?)(?=\s*[,\n)]|$)/g, (match, source, target, label) => {
      const cleanLabel = label.trim().replace(/^["']|["']$/g, '').replace(/"/g, '\\"');
      return `Rel(${source}, ${target}, "${cleanLabel}")`;
    });

    // ===== PASS 2.6: Fix malformed Rel() calls =====
    // Fix Rel() calls with nested quotes or unclosed parentheses
    // Pattern: Rel(A, B, "Label with "nested" quotes")
    cleaned = cleaned.replace(/Rel\(([^,]+),\s*([^,]+),\s*"([^"]*)"([^)]*)/g, (match, source, target, label, rest) => {
      // Escape any quotes in the label
      const escapedLabel = label.replace(/"/g, '\\"');
      return `Rel(${source}, ${target}, "${escapedLabel}")${rest}`;
    });

    // Fix Rel() calls missing closing parentheses
    const relMatches = cleaned.match(/Rel\([^)]*(?![)])/g);
    if (relMatches) {
      relMatches.forEach(match => {
        // Count open and close parens in the match
        const openParens = (match.match(/\(/g) || []).length;
        const closeParens = (match.match(/\)/g) || []).length;
        if (openParens > closeParens) {
          // Find the position and add missing closing parens
          const matchIndex = cleaned.indexOf(match);
          if (matchIndex >= 0) {
            // Try to find where this Rel() call should end by looking for the next comma, newline, or end of string
            let endIndex = matchIndex + match.length;
            let parenCount = openParens - closeParens;
            // Look ahead for the end of the Rel() call
            while (parenCount > 0 && endIndex < cleaned.length) {
              if (cleaned[endIndex] === ')') {
                parenCount--;
              } else if (cleaned[endIndex] === '(') {
                parenCount++;
              }
              endIndex++;
            }
            // If we still have unclosed parens, add them
            if (parenCount > 0) {
              cleaned = cleaned.substring(0, endIndex) + ')'.repeat(parenCount) + cleaned.substring(endIndex);
            }
          }
        }
      });
    }

    // ===== PASS 3: Add newlines between function calls (handle all quote patterns) =====
    // Pattern 1: ")FunctionName(" -> ")\nFunctionName("
    cleaned = cleaned.replace(/\)\s*([A-Z][a-zA-Z_]*\()/g, ')\n$1');

    // Pattern 2a: ")FunctionName(" -> ")\nFunctionName(" (quote before closing paren, no space after)
    // This handles cases like: "playing the game.")SystemBoundary(
    cleaned = cleaned.replace(/"\)([A-Z][a-zA-Z_]*\()/g, '")\n$1');

    // Pattern 2b: ")FunctionName(" -> ")\nFunctionName(" (quote between calls, with optional space)
    cleaned = cleaned.replace(/\)"\s*([A-Z][a-zA-Z_]*\()/g, ')"\n$1');

    // Pattern 3: ")"text"FunctionName(" -> ")"text"\nFunctionName("
    cleaned = cleaned.replace(/\)"\s*"([^"]*)"\s*([A-Z][a-zA-Z_]*\()/g, ')"\n"$1"\n$2');

    // Pattern 4: Handle cases where function calls are directly concatenated
    cleaned = cleaned.replace(/([A-Z][a-zA-Z_]*\))\s*([A-Z][a-zA-Z_]*\()/g, '$1\n$2');

    // ===== PASS 4: Fix function names =====
    cleaned = cleaned
      .replace(/SystemExt\(/gi, 'System_Ext(')  // Fix SystemExt to System_Ext
      .replace(/Container_Component\(/g, 'Container(')
      .replace(/System_Backend\(/g, 'System(')
      .replace(/Container_/g, 'Container')
      .replace(/System_/g, 'System');

    // ===== PASS 5: Fix HTML entities =====
    cleaned = cleaned
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // ===== PASS 6: Split into lines and validate =====
    const lines = cleaned.split('\n').map(line => {
      line = line.trim();
      if (!line) return '';

      // Remove trailing commas
      line = line.replace(/,\s*$/, '');

      // Ensure proper spacing around parentheses
      line = line.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');

      return line;
    }).filter(line => line.length > 0);

    // ===== PASS 7: Validate and split multi-function lines =====
    const validatedLines: string[] = [];
    for (const line of lines) {
      // Check if line contains multiple function calls
      const functionMatches = line.match(/([A-Z][a-zA-Z_]*\()/g);
      if (functionMatches && functionMatches.length > 1) {
        // Split the line at each function call
        const parts = line.split(/([A-Z][a-zA-Z_]*\()/);
        let currentFunction = '';
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.match(/^[A-Z][a-zA-Z_]*\($/)) {
            // This is a function name start
            if (currentFunction) {
              validatedLines.push(currentFunction.trim());
            }
            currentFunction = part;
          } else if (currentFunction) {
            currentFunction += part;
            // Check if this completes the function call
            const openParens = (currentFunction.match(/\(/g) || []).length;
            const closeParens = (currentFunction.match(/\)/g) || []).length;
            if (openParens === closeParens && openParens > 0) {
              validatedLines.push(currentFunction.trim());
              currentFunction = '';
            }
          } else if (part.trim()) {
            validatedLines.push(part.trim());
          }
        }
        if (currentFunction) {
          validatedLines.push(currentFunction.trim());
        }
      } else {
        validatedLines.push(line);
      }
    }

    cleaned = validatedLines.join('\n');

    // ===== PASS 8: Ensure C4Container directive is on line 1 =====
    const cleanedLines = cleaned.split('\n');
    if (cleanedLines.length > 0) {
      const firstLine = cleanedLines[0].trim();
      // If first line doesn't start with C4Container but contains C4 functions, prepend C4Container
      if (!firstLine.match(/^(C4Container|C4System|C4Person)/i)) {
        if (cleaned.includes('Container(') || cleaned.includes('System(') || cleaned.includes('Person(') || cleaned.includes('System_Ext(') || cleaned.includes('SystemBoundary(')) {
          cleaned = 'C4Container\n' + cleaned;
        }
      } else if (firstLine.match(/^C4Container/i) && firstLine.length > 10) {
        // If C4Container is combined with other text, split it
        const rest = firstLine.replace(/^C4Container/i, '').trim();
        if (rest) {
          // Check if rest contains "title" directive
          if (rest.match(/^title\s+/i)) {
            // Extract title text
            const titleMatch = rest.match(/^title\s+(.+)/i);
            if (titleMatch) {
              const titleText = titleMatch[1].trim();
              cleaned = 'C4Container\ntitle ' + titleText + '\n' + cleanedLines.slice(1).join('\n');
            } else {
              cleaned = 'C4Container\n' + rest + '\n' + cleanedLines.slice(1).join('\n');
            }
          } else if (rest.match(/^[a-z]+/)) {
            // Check if rest starts with lowercase (like "person") and needs to be split
            // Split at first uppercase letter
            const splitMatch = rest.match(/^([a-z]+)([A-Z].*)/);
            if (splitMatch) {
              const [, lowercasePart, uppercasePart] = splitMatch;
              cleaned = 'C4Container\n' + lowercasePart.charAt(0).toUpperCase() + lowercasePart.slice(1) + '\n' + uppercasePart + '\n' + cleanedLines.slice(1).join('\n');
            } else {
              cleaned = 'C4Container\n' + rest.charAt(0).toUpperCase() + rest.slice(1) + '\n' + cleanedLines.slice(1).join('\n');
            }
          } else {
            cleaned = 'C4Container\n' + rest + '\n' + cleanedLines.slice(1).join('\n');
          }
        }
      }

      // Fix title directive that might be on the same line as C4Container or other directives
      cleaned = cleaned.replace(/(C4Container|C4System|C4Person)\s+title\s+/gi, '$1\ntitle ');
    }

    // Final cleanup: remove empty lines and normalize
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return cleaned;
  };

  // Handle zoom and fit to screen
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const svg = container.querySelector('svg');

    if (svg && svg.getBBox) {
      try {
        const svgBox = svg.getBBox();
        const containerRect = container.getBoundingClientRect();

        if (svgBox.width > 0 && svgBox.height > 0 && containerRect.width > 0 && containerRect.height > 0) {
          const padding = 40;
          const availableWidth = containerRect.width - padding * 2;
          const availableHeight = containerRect.height - padding * 2;

          // Calculate scale to fit within available space - enable overzoom for smaller diagrams
          const scaleX = availableWidth / svgBox.width;
          const scaleY = availableHeight / svgBox.height;
          // Enable overzoom: use Math.min to fit, but allow values > 1 for smaller diagrams
          // This allows zooming in beyond 100% when diagram is smaller than viewport
          const scale = Math.min(scaleX, scaleY);

          setZoom(scale);

          // With transformOrigin 'center center', pan(0,0) means the center of the transform wrapper
          // stays at the center of the container. We need to calculate the offset to center the SVG.

          // Get the SVG's center point in its coordinate system
          const svgCenterX = svgBox.x + svgBox.width / 2;
          const svgCenterY = svgBox.y + svgBox.height / 2;

          // Container center (in container coordinates)
          const containerCenterX = containerRect.width / 2;
          const containerCenterY = containerRect.height / 2;

          // With center-center transform origin, we need to offset by the difference
          // between where the SVG center is and where we want it (container center)
          // After scaling, the SVG center will be at (svgCenterX * scale, svgCenterY * scale)
          // We want it at (containerCenterX, containerCenterY)
          const panX = containerCenterX - (svgCenterX * scale);
          const panY = containerCenterY - (svgCenterY * scale);

          setPan({ x: panX, y: panY });
          return;
        }
      } catch (e) {
        // SVG might not be ready yet
        console.debug('[MermaidDiagram] Error fitting to screen:', e);
      }
    }

    // Fallback: reset to default (centered)
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Render the diagram
  useEffect(() => {
    if (!code || !containerRef.current) return;

    let cleanedCode = cleanMermaidCode(code);

    if (!cleanedCode || cleanedCode.trim().length === 0) {
      setError('Diagram code is empty after cleaning');
      return;
    }

    // Validate C4 diagrams: ensure they have actual content, not just the directive
    if (cleanedCode.match(/^C4(Container|System|Person)/i)) {
      const lines = cleanedCode.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const hasContent = lines.some(line =>
        /^(Container|System|Person|System_Ext|Container_Ext|Rel|SystemBoundary|ContainerBoundary|Person_Ext|UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig)\(/i.test(line)
      );

      if (!hasContent || lines.length <= 1) {
        // Diagram is incomplete - provide a fallback
        console.warn('[MermaidDiagram] Incomplete C4 diagram detected, using fallback');
        cleanedCode = `C4Container
Container(frontend, "Frontend Application", "React application providing user interface", "React")
Container(backend, "Backend API", "Node.js API server handling business logic", "Node.js")
ContainerDb(database, "Database", "PostgreSQL database storing application data", "PostgreSQL")
Rel(frontend, backend, "Makes API calls")
Rel(backend, database, "Reads from and writes to")`;
      }
    }

    setIsRendering(true);
    setError(null);

    // Clear previous content - find the transform wrapper inside container
    const container = containerRef.current;
    if (!container) return;

    // Find or create the transform wrapper div
    let transformWrapper = container.querySelector('.mermaid-transform-wrapper') as HTMLDivElement;
    if (!transformWrapper) {
      transformWrapper = document.createElement('div');
      transformWrapper.className = 'mermaid-transform-wrapper';
      transformWrapper.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
      container.appendChild(transformWrapper);
    }
    transformWrapper.innerHTML = '';

    // Create a unique ID for this diagram instance
    const diagramId = diagramIdRef.current;
    const diagramElement = document.createElement('div');
    diagramElement.id = diagramId;
    diagramElement.className = 'mermaid';
    diagramElement.textContent = cleanedCode;
    transformWrapper.appendChild(diagramElement);

    // Render the diagram with error handling
    mermaid.run({
      nodes: [diagramElement],
      suppressErrors: false
    }).then(() => {
      setIsRendering(false);
      onRenderSuccess?.();

      // Auto-fit diagram to screen after successful render
      setTimeout(() => {
        handleFitToScreen();
      }, 100);
    }).catch((err: Error) => {
      setIsRendering(false);

      // Try to extract more detailed error information
      let errorMessage = err.message || err.toString() || 'Unknown error';

      // If error mentions a specific line, try to show that line
      const lineMatch = errorMessage.match(/line (\d+)/i);
      if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]);
        const lines = cleanedCode.split('\n');
        if (lines[lineNum - 1]) {
          errorMessage += `\n\nProblematic line ${lineNum}: "${lines[lineNum - 1].substring(0, 100)}"`;
        }
      }

      // Try to auto-fix common issues and retry once
      const fixedCode = attemptAutoFix(cleanedCode, errorMessage);
      if (fixedCode !== cleanedCode) {
        console.log('[Mermaid] Attempting auto-fix and retry...');
        console.log('[Mermaid] Original code (first 200 chars):', cleanedCode.substring(0, 200));
        console.log('[Mermaid] Fixed code (first 200 chars):', fixedCode.substring(0, 200));

        // Clear and recreate the element with fixed code
        container.innerHTML = '';
        const fixedElement = document.createElement('div');
        fixedElement.id = diagramId;
        fixedElement.className = 'mermaid';
        fixedElement.textContent = fixedCode;
        container.appendChild(fixedElement);

        mermaid.run({
          nodes: [fixedElement],
          suppressErrors: false
        }).then(() => {
          setIsRendering(false);
          onRenderSuccess?.();

          // Auto-fit diagram to screen after successful render
          setTimeout(() => {
            handleFitToScreen();
          }, 100);
        }).catch((retryErr: Error) => {
          setIsRendering(false);
          const retryErrorMessage = retryErr.message || retryErr.toString() || 'Unknown error after auto-fix';
          setError(`${errorMessage}\n\nAuto-fix attempted but failed: ${retryErrorMessage}`);
          onRenderError?.(retryErr);
          console.error('[Mermaid] Rendering error after auto-fix:', retryErr);
          console.error('[Mermaid] Fixed code that failed (first 500 chars):', fixedCode.substring(0, 500));
        });
        return;
      }

      setError(errorMessage);
      onRenderError?.(err);
      console.error('[Mermaid] Rendering error:', err);
      console.error('[Mermaid] Problematic code:', cleanedCode.substring(0, 500));
    });
  }, [code, onRenderSuccess, onRenderError, handleFitToScreen]);

  // Handle pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Handle wheel zoom with zoom-to-cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 0.001;
    const delta = -e.deltaY * zoomFactor;
    const newZoom = Math.max(0.5, Math.min(3, zoom + delta));

    // Zoom to cursor position
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - pan.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - pan.y) * zoomRatio;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Handle fullscreen (custom overlay, not native API for better compatibility)
  const toggleFullscreen = () => {
    if (!allowFullscreen) return;
    setIsFullscreen(prev => {
      const newValue = !prev;
      // When entering fullscreen, re-fit the diagram after a short delay
      if (newValue) {
        setTimeout(() => {
          handleFitToScreen();
        }, 100);
      }
      return newValue;
    });
  };

  // Prevent background scroll when fullscreen overlay is active
  useEffect(() => {
    if (!isFullscreen || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // Handle ESC key to exit fullscreen overlay
  useEffect(() => {
    if (!isFullscreen || typeof window === 'undefined') return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-700 mb-2">Diagram Rendering Error</h3>
        <p className="text-sm text-red-600 mb-4 text-center max-w-md">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsRendering(false);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const diagramShell = (
    <div className={`relative w-full h-full bg-white rounded-lg border border-slate-200 overflow-hidden ${isFullscreen ? 'shadow-2xl' : ''}`} style={{ height: '100%', width: '100%', minHeight: isFullscreen ? '100%' : '100%' }}>
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-slate-200">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-2 hover:bg-slate-100 rounded transition-colors text-xs font-medium"
          title="Fit to Screen"
        >
          Fit
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
        {allowFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-slate-100 rounded transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Diagram Container */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none', height: '100%', width: '100%', minHeight: '100%' }}
      >
        {/* Transform wrapper for zoom and pan */}
        <div
          className="mermaid-transform-wrapper"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: '100%'
          }}
        >
          {isRendering && (
            <div className="flex items-center justify-center absolute inset-0 z-10 bg-white/80">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Rendering diagram...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      {title && (
        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
          {title}
        </div>
      )}
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 lg:p-10 flex flex-col gap-4">
        <div className="flex items-center justify-between text-white">
          <div className="text-base sm:text-lg font-semibold">
            {title || 'Architecture Diagram'}
          </div>
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center px-3 py-1.5 rounded-md border border-white/40 bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
          >
            Exit Fullscreen
          </button>
        </div>
        <div className="flex-1 min-h-0 relative">
          {diagramShell}
        </div>
      </div>,
      document.body
    );
  }

  return diagramShell;
};

export default MermaidDiagram;

