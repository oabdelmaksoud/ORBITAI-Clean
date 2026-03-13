/**
 * Preview Services - Barrel Export
 * Provides clean import paths for preview generation utilities
 */

// Types
export * from './previewTypes.js';

// HTML Utilities
export {
    cleanJsonResponse,
    sanitizeJsx,
    cleanXmlTags,
    extractHtml,
    fixReactDependencies,
    validateHtmlStructure,
} from './previewHtmlUtils.js';

// Prompt Builders
export {
    detectProjectDomain,
    getDomainSpecificPrompt,
    mapToSupportedMethodology,
    getFallbackStandards,
    shouldAutoGenerateAdmin,
    inferAdminFeatures,
} from './previewPromptBuilders.js';

// Fallback Templates
export {
    generateFallbackDashboard,
    generateFallbackAdminConsole,
    createSimpleWireframeFallback,
    generateFallbackWireframe,
} from './previewFallbacks.js';

// Game Prompt Builder
export {
    buildGamePrompt,
    processGameFeatures,
    validateGameOutput,
    getGameSystemInstruction,
    type GamePromptOptions,
    type GameValidationResult,
} from './gamePromptBuilder.js';

// Web App Prompt Builder
export {
    buildWebAppPrompt,
    buildAdminConsolePrompt,
    getWebAppSystemInstruction,
    type WebAppPromptOptions,
} from './webAppPromptBuilder.js';
