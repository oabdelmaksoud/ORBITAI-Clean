/**
 * Design Inspiration Service
 * 
 * Provides external design inspiration for wireframe and theme generation.
 * Uses free APIs: Colormind for color palettes, curated Google Fonts pairings.
 */

import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ColorPalette {
    colors: string[]; // Array of hex colors
    model: string; // Colormind model used
    mood: string; // User-specified mood
}

export interface FontPairing {
    heading: string;
    body: string;
    style: string;
}

export interface DesignInspiration {
    colors: ColorPalette;
    fonts: FontPairing;
    trends: string[];
    cssVariables: string; // Ready-to-use CSS
}

// ============================================================================
// Font Pairings (Curated Google Fonts)
// ============================================================================

const FONT_PAIRINGS: Record<string, FontPairing> = {
    modern: { heading: 'Inter', body: 'Inter', style: 'modern' },
    elegant: { heading: 'Playfair Display', body: 'Lora', style: 'elegant' },
    playful: { heading: 'Poppins', body: 'Nunito', style: 'playful' },
    minimal: { heading: 'Space Grotesk', body: 'Work Sans', style: 'minimal' },
    bold: { heading: 'Montserrat', body: 'Open Sans', style: 'bold' },
    tech: { heading: 'Roboto Mono', body: 'Roboto', style: 'tech' },
    game: { heading: 'Press Start 2P', body: 'VT323', style: 'game' },
    corporate: { heading: 'Source Sans Pro', body: 'Merriweather', style: 'corporate' },
    creative: { heading: 'Bebas Neue', body: 'Raleway', style: 'creative' },
    friendly: { heading: 'Quicksand', body: 'DM Sans', style: 'friendly' }
};

// ============================================================================
// Design Trends by Category
// ============================================================================

const DESIGN_TRENDS: Record<string, string[]> = {
    web: ['glassmorphism', 'dark mode', 'micro-animations', 'gradient accents', 'rounded corners', 'card-based layouts'],
    mobile: ['bottom navigation', 'gesture-based UI', 'haptic feedback', 'skeleton loading', 'floating action buttons'],
    game: ['pixel art', 'particle effects', 'animated sprites', 'HUD overlay', 'parallax backgrounds', 'retro aesthetics'],
    dashboard: ['data visualization', 'real-time updates', 'dark theme', 'compact density', 'tabbed navigation'],
    ecommerce: ['product cards', 'sticky cart', 'quick view modals', 'trust badges', 'social proof'],
    saas: ['onboarding flows', 'feature highlights', 'pricing tables', 'testimonials', 'CTA sections'],
    default: ['responsive design', 'accessible UI', 'consistent spacing', 'clear typography', 'intuitive navigation']
};

// ============================================================================
// Colormind API Integration
// ============================================================================

/**
 * Convert RGB array to hex string
 */
function rgbToHex(rgb: [number, number, number]): string {
    return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Get mood-based seed color for Colormind
 */
function getMoodSeedColor(mood: string): [number, number, number] | null {
    const moodColors: Record<string, [number, number, number]> = {
        dark: [30, 30, 35],
        light: [250, 250, 252],
        vibrant: [99, 102, 241], // Indigo-ish
        calm: [100, 180, 200],
        energetic: [255, 100, 50],
        professional: [50, 80, 120],
        playful: [255, 150, 200],
        nature: [80, 150, 80],
        luxury: [180, 150, 100],
        tech: [0, 200, 200]
    };
    return moodColors[mood.toLowerCase()] || null;
}

/**
 * Fetch AI-generated color palette from Colormind API
 */
async function fetchColormindPalette(mood?: string, projectType?: string): Promise<ColorPalette> {
    const model = projectType === 'game' ? 'default' : 'ui';
    const seedColor = mood ? getMoodSeedColor(mood) : null;

    // Build input: lock seed color if provided, let API generate rest
    const input = seedColor
        ? [seedColor, 'N', 'N', 'N', 'N']
        : ['N', 'N', 'N', 'N', 'N'];

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('http://colormind.io/api/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Colormind API error: ${response.status}`);
        }

        const data = await response.json();
        const colors = (data as any).result.map((rgb: [number, number, number]) => rgbToHex(rgb));

        logger.info(`[DesignInspiration] Generated palette from Colormind: ${colors.join(', ')}`);

        return {
            colors,
            model,
            mood: mood || 'default'
        };
    } catch (error: unknown) {
        logger.warn('[DesignInspiration] Colormind API failed, using fallback palette:', error);
        return getFallbackPalette(mood);
    }
}

/**
 * Fallback palette when API fails
 */
function getFallbackPalette(mood?: string): ColorPalette {
    const fallbacks: Record<string, string[]> = {
        dark: ['#1a1a2e', '#16213e', '#0f3460', '#e94560', '#533483'],
        light: ['#f8fafc', '#e2e8f0', '#94a3b8', '#3b82f6', '#1e40af'],
        vibrant: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'],
        calm: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0284c7', '#0c4a6e'],
        default: ['#6366f1', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b']
    };

    return {
        colors: fallbacks[mood?.toLowerCase() || 'default'] || fallbacks.default,
        model: 'fallback',
        mood: mood || 'default'
    };
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Get font pairing based on style
 */
export function getFontPairing(style?: string): FontPairing {
    const normalizedStyle = style?.toLowerCase() || 'modern';
    return FONT_PAIRINGS[normalizedStyle] || FONT_PAIRINGS.modern;
}

/**
 * Get design trends for project type
 */
export function getDesignTrends(projectType?: string): string[] {
    const type = projectType?.toLowerCase() || 'default';
    return DESIGN_TRENDS[type] || DESIGN_TRENDS.default;
}

/**
 * Generate CSS variables from inspiration
 */
function generateCSSVariables(colors: ColorPalette, fonts: FontPairing): string {
    return `:root {
  /* AI-Generated Color Palette */
  --color-primary: ${colors.colors[0]};
  --color-secondary: ${colors.colors[1]};
  --color-accent: ${colors.colors[2]};
  --color-background: ${colors.colors[3]};
  --color-text: ${colors.colors[4]};
  
  /* Typography */
  --font-heading: '${fonts.heading}', system-ui, sans-serif;
  --font-body: '${fonts.body}', system-ui, sans-serif;
}`;
}

/**
 * Get complete design inspiration for project
 */
export async function getDesignInspiration(options: {
    projectType?: string;
    mood?: string;
    style?: string;
}): Promise<DesignInspiration> {
    const { projectType, mood, style } = options;

    logger.info(`[DesignInspiration] Fetching inspiration for: type=${projectType}, mood=${mood}, style=${style}`);

    // Fetch all inspiration sources in parallel
    const [colors, fonts, trends] = await Promise.all([
        fetchColormindPalette(mood, projectType),
        Promise.resolve(getFontPairing(style)),
        Promise.resolve(getDesignTrends(projectType))
    ]);

    const cssVariables = generateCSSVariables(colors, fonts);

    logger.info(`[DesignInspiration] Inspiration ready:`, {
        colors: colors.colors,
        fonts: `${fonts.heading} / ${fonts.body}`,
        trendsCount: trends.length
    });

    return {
        colors,
        fonts,
        trends,
        cssVariables
    };
}

/**
 * Format inspiration for LLM prompt injection
 */
export function formatInspirationForPrompt(inspiration: DesignInspiration): string {
    return `
## Design Inspiration (AI-Generated)

### Color Palette
Use these colors as the primary design palette:
- Primary: ${inspiration.colors.colors[0]}
- Secondary: ${inspiration.colors.colors[1]}
- Accent: ${inspiration.colors.colors[2]}
- Background: ${inspiration.colors.colors[3]}
- Text: ${inspiration.colors.colors[4]}

### Typography
- Headings: ${inspiration.fonts.heading}
- Body text: ${inspiration.fonts.body}

### Design Trends to Consider
${inspiration.trends.map(t => `- ${t}`).join('\n')}

### CSS Variables (inject into output)
\`\`\`css
${inspiration.cssVariables}
\`\`\`
`.trim();
}

// Export default instance
export default {
    getDesignInspiration,
    getFontPairing,
    getDesignTrends,
    formatInspirationForPrompt
};
