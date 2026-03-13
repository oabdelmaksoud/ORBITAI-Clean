/**
 * Web App Prompt Builder
 * Specialized prompt construction for React web application generation
 * Extracted from enhancedPreviewGenerator.service.ts
 */

export interface WebAppPromptOptions {
    userGoal: string;
    features: string[];
    requirements: string[];
    brainstormingContext?: unknown;
    targetPlatforms?: string[];
    constraints?: string[];
    preferences?: string[];
    designInspiration?: string;
}

/**
 * Build React web application prompt
 */
export function buildWebAppPrompt(options: WebAppPromptOptions): string {
    const {
        userGoal,
        features,
        requirements,
        brainstormingContext,
        constraints = [],
        preferences = [],
        designInspiration = ''
    } = options;

    const featuresList = features.length > 0
        ? features.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : 'Core functionality';

    const requirementsList = requirements.length > 0
        ? requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')
        : 'No specific requirements';

    const constraintsList = constraints.length > 0
        ? constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')
        : '';

    const preferencesList = preferences.length > 0
        ? preferences.map((p, i) => `${i + 1}. ${p}`).join('\n')
        : '';

    return `Create a COMPLETE, PRODUCTION-LEVEL React web application as a single HTML file.

════════════════════════════════════════════════════════════════════
🎯 PROJECT GOAL: ${userGoal}
════════════════════════════════════════════════════════════════════

════════════════════════════════════════════════════════════════════
✨ REQUIRED FEATURES:
════════════════════════════════════════════════════════════════════
${featuresList}

════════════════════════════════════════════════════════════════════
📋 REQUIREMENTS:
════════════════════════════════════════════════════════════════════
${requirementsList}

${constraintsList ? `
════════════════════════════════════════════════════════════════════
⚠️ CONSTRAINTS:
════════════════════════════════════════════════════════════════════
${constraintsList}
` : ''}

${preferencesList ? `
════════════════════════════════════════════════════════════════════
💡 PREFERENCES:
════════════════════════════════════════════════════════════════════
${preferencesList}
` : ''}

${designInspiration ? `
════════════════════════════════════════════════════════════════════
🎨 DESIGN INSPIRATION:
════════════════════════════════════════════════════════════════════
${designInspiration}
` : ''}

${brainstormingContext ? `
════════════════════════════════════════════════════════════════════
💡 BRAINSTORMED IDEAS:
════════════════════════════════════════════════════════════════════
${formatBrainstormingForWebApp(brainstormingContext)}
` : ''}

════════════════════════════════════════════════════════════════════
🛠️ TECHNICAL REQUIREMENTS:
════════════════════════════════════════════════════════════════════
1. Single HTML file with inline React + Babel
2. Use React 18 (useState, useEffect, etc.)
3. Tailwind CSS for styling
4. Lucide icons for UI elements
5. Dark mode support
6. Responsive design (mobile-first)
7. Glassmorphism effects where appropriate
8. Smooth transitions and animations
9. Mock data for demonstrations
10. Toast notifications for user feedback

════════════════════════════════════════════════════════════════════
📦 REQUIRED CDN SCRIPTS (in this order):
════════════════════════════════════════════════════════════════════
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>

Output a COMPLETE, FUNCTIONAL React application. Start with <!DOCTYPE html>:`;
}

/**
 * Format brainstorming context for web app prompts
 */
function formatBrainstormingForWebApp(context: unknown): string {
    if (!context || typeof context !== 'object') return '';

    const ctx = context as Record<string, unknown>;
    const ideas = ctx.ideas as Array<{ label: string; description?: string; category?: string }> | undefined;

    if (!ideas || !Array.isArray(ideas)) return '';

    return ideas
        .filter(idea => idea.label)
        .map(idea => {
            const category = idea.category ? `[${idea.category}]` : '';
            return `- ${category} ${idea.label}${idea.description ? `: ${idea.description}` : ''}`;
        })
        .join('\n');
}

/**
 * Get web app system instruction with optional design context
 */
export function getWebAppSystemInstruction(designInspiration?: {
    colors: { colors: string[] };
    fonts: { heading: string; body: string };
    trends: string[];
}): string {
    if (designInspiration) {
        return `Output only HTML starting with <!DOCTYPE html>. No explanation. You are an expert React developer with excellent UI/UX skills.

DESIGN SYSTEM (use these exact values):
- Primary: ${designInspiration.colors.colors[0] || '#6366f1'}
- Secondary: ${designInspiration.colors.colors[1] || '#8b5cf6'}
- Accent: ${designInspiration.colors.colors[2] || '#ec4899'}
- Fonts: ${designInspiration.fonts.heading} / ${designInspiration.fonts.body}
Apply ${designInspiration.trends.slice(0, 3).join(', ')} design patterns.`;
    }

    return 'Output only HTML starting with <!DOCTYPE html>. No explanation. You are an expert React developer.';
}

/**
 * Build admin console prompt
 */
export function buildAdminConsolePrompt(options: {
    projectGoal: string;
    adminFeatures: string[];
    brainstormingContext?: unknown;
}): string {
    const { projectGoal, adminFeatures, brainstormingContext } = options;

    const featuresList = adminFeatures.length > 0
        ? adminFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : 'User Management, Dashboard, Settings';

    return `Create a COMPLETE, PRODUCTION-LEVEL React ADMIN CONSOLE as a single HTML file.

════════════════════════════════════════════════════════════════════
🎯 PROJECT CONTEXT: ${projectGoal}
════════════════════════════════════════════════════════════════════
This is the ADMINISTRATIVE INTERFACE used by staff/owners, NOT end-users.

════════════════════════════════════════════════════════════════════
🔧 REQUIRED ADMIN FEATURES:
════════════════════════════════════════════════════════════════════
${featuresList}

${brainstormingContext ? `
════════════════════════════════════════════════════════════════════
💡 BRAINSTORMED IDEAS:
════════════════════════════════════════════════════════════════════
${formatBrainstormingForWebApp(brainstormingContext)}
` : ''}

════════════════════════════════════════════════════════════════════
📐 ADMIN CONSOLE REQUIREMENTS:
════════════════════════════════════════════════════════════════════
1. Layout: Sidebar navigation (left), Top bar (search/profile), Main content area
2. Dashboard: High-level metrics (cards), Recent activity (list), Charts (mocked)
3. Data Management: Rich tables with pagination, search, filtering, row actions
4. Forms: Complex forms for creating/editing resources
5. Analytics: Visual representation of data (bar charts, line graphs)
6. Dark/Light mode toggle
7. Responsive design

════════════════════════════════════════════════════════════════════
🛠️ TECHNICAL REQUIREMENTS:
════════════════════════════════════════════════════════════════════
1. React 18 with hooks (useState, useEffect)
2. Tailwind CSS for styling
3. Lucide icons
4. Mock data for all tables/charts
5. Professional, clean design

Output a COMPLETE, FUNCTIONAL admin console. Start with <!DOCTYPE html>:`;
}
