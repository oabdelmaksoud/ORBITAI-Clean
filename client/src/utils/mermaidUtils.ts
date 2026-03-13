/**
 * Helper to clean Mermaid code
 */
export const cleanMermaidCode = (code: string | undefined | null | any) => {
    if (!code) return '';
    // Ensure code is a string
    if (typeof code !== 'string') {
        console.warn('[cleanMermaidCode] Received non-string value:', typeof code, code);
        // Try to convert to string if possible
        if (code && typeof code.toString === 'function') {
            code = code.toString();
        } else {
            return '';
        }
    }
    // Remove markdown code blocks
    let cleaned = code
        .replace(/```(?:mermaid|mmd)?/gi, '')
        .replace(/```/g, '');

    // Fix line breaks within strings (common issue from LLM generation)
    // Process character by character to handle escaped quotes properly
    let fixedCode = '';
    let inString = false;
    let stringChar: string | null = null;
    let i = 0;

    while (i < cleaned.length) {
        const char = cleaned[i];
        const prevChar = i > 0 ? cleaned[i - 1] : null;

        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            fixedCode += char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
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

    cleaned = fixedCode
        // Fix common syntax issues
        .replace(/Container_Component\(/g, 'Container(')
        .replace(/System_Backend\(/g, 'System(')
        .replace(/Container_/g, 'Container')
        .replace(/System_/g, 'System')
        // Fix HTML entities
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        // Remove leading/trailing whitespace and newlines
        .trim();

    // Ensure it starts with a valid Mermaid directive
    if (cleaned && !cleaned.match(/^(C4Container|C4System|C4Person|graph|flowchart|sequenceDiagram|classDiagram|erDiagram|gantt|pie|gitgraph|journey|stateDiagram|mindmap|timeline|requirement|quadrantChart|C4Context)/i)) {
        // Try to prepend C4Container if it looks like C4 diagram
        if (cleaned.includes('Container(') || cleaned.includes('System(') || cleaned.includes('Person(')) {
            cleaned = 'C4Container\n' + cleaned;
        }
    }

    // Validate C4 diagrams: if it's a C4 diagram, ensure it has actual content
    if (cleaned && cleaned.match(/^C4(Container|System|Person)/i)) {
        const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        // C4 diagrams must have at least the directive + one function call (Container, System, Person, Rel, etc.)
        const hasContent = lines.some(line =>
            /^(Container|System|Person|System_Ext|Container_Ext|Rel|SystemBoundary|ContainerBoundary|Person_Ext|UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig)\(/i.test(line)
        );

        if (!hasContent && lines.length <= 1) {
            // Diagram is incomplete - provide a fallback
            console.warn('[cleanMermaidCode] Incomplete C4 diagram detected, providing fallback');
            return `C4Container
Container(frontend, "Frontend Application", "React application providing user interface", "React")
Container(backend, "Backend API", "Node.js API server handling business logic", "Node.js")
ContainerDb(database, "Database", "PostgreSQL database storing application data", "PostgreSQL")
Rel(frontend, backend, "Makes API calls")
Rel(backend, database, "Reads from and writes to")`;
        }
    }

    return cleaned;
};
