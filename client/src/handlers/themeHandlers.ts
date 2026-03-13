/**
 * Theme Handlers - AI theme generation and random theme selection
 * 
 * Extracted from App.tsx to reduce component size and improve maintainability.
 * 
 * @module handlers/themeHandlers
 */

import { ProjectState, INITIAL_PROJECT_NAME } from '@orbitai/shared';
import { generateAppTheme } from '../services/geminiService';

/** AppTheme type definition */
export interface AppTheme {
    id: string;
    name: string;
    [key: string]: any;
}

/**
 * Dependencies required for theme handlers
 */
export interface ThemeHandlerDeps {
    // State
    themeInput: string;
    state: ProjectState;
    availableThemes: AppTheme[];

    // Setters
    setIsGeneratingTheme: (value: boolean) => void;
    setAvailableThemes: React.Dispatch<React.SetStateAction<AppTheme[]>>;
    setSelectedTheme: (id: string) => void;
    setThemeInput: (value: string) => void;
    dispatch: React.Dispatch<any>;
}

/**
 * Returns theme handler functions
 */
export function createThemeHandlers(deps: ThemeHandlerDeps) {
    const {
        themeInput,
        state,
        availableThemes,
        setIsGeneratingTheme,
        setAvailableThemes,
        setSelectedTheme,
        setThemeInput,
        dispatch
    } = deps;

    /**
     * Generate a theme based on user input description
     */
    const handleAiThemeGen = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!themeInput.trim()) return;
        setIsGeneratingTheme(true);
        try {
            // Build project context from current state for project-type-aware theming
            const projectContext = [
                state.name && state.name !== INITIAL_PROJECT_NAME ? `Project: ${state.name}` : '',
                state.description ? `Description: ${state.description}` : '',
                state.techStack && state.techStack.length > 0 ? `Tech Stack: ${state.techStack.join(', ')}` : '',
                // Include project type hints from description and tech stack
                state.description?.toLowerCase().includes('game') || state.techStack?.some(tech => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ? 'Type: Game' : '',
                state.description?.toLowerCase().includes('website') || state.description?.toLowerCase().includes('web app') || state.techStack?.some(tech => ['react', 'vue', 'angular', 'html', 'css'].includes(tech.toLowerCase())) ? 'Type: Website/Web App' : ''
            ].filter(Boolean).join('\n');

            const newTheme = await generateAppTheme(themeInput, projectContext);
            setAvailableThemes(prev => [...prev, newTheme]);
            const themeId = newTheme.id;
            setSelectedTheme(themeId);
            dispatch({ type: 'SET_THEME', payload: themeId });
            setThemeInput('');
        } catch (err) {
            console.error("Theme Gen Failed", err);
        } finally {
            setIsGeneratingTheme(false);
        }
    };

    /**
     * Generate a random theme from predefined descriptions
     */
    const handleRandomTheme = async () => {
        setIsGeneratingTheme(true);
        try {
            // Generate random theme descriptions - diverse themes
            const randomDescriptions = [
                // Seasonal/Holiday Themes
                'Halloween theme with spooky dark purples, oranges, and blacks, featuring bat silhouettes, spider webs, and pumpkin patterns with eerie glowing effects',
                'Christmas theme with festive reds, greens, golds, and whites, featuring snowflakes, stars, holly patterns, and warm sparkle effects',
                'Valentine\'s Day theme with romantic pinks, reds, and whites, featuring heart patterns and elegant cursive fonts',
                'Easter theme with pastel colors including soft pinks, blues, yellows, and greens, featuring egg patterns and spring flowers',
                // Aesthetic Themes
                'Cyberpunk neon cityscape with electric blues and vibrant purples, featuring grid patterns and glowing effects',
                'Minimalist theme with clean whites, subtle grays, and lots of whitespace, featuring simple borders and soft shadows',
                'Retro 1980s theme with vibrant neons, geometric patterns, and bold typography',
                'Art Deco theme with geometric patterns, gold accents, and elegant black and white contrasts',
                // Nature Themes
                'Ocean depths with deep blues and teals, featuring wave patterns and aquatic textures',
                'Forest green with natural earth tones, featuring leaf patterns and organic shapes',
                'Aurora borealis with greens and magentas, featuring flowing gradients and ethereal glows',
                'Cherry blossom with soft pinks and whites, featuring delicate flower patterns',
                // Era-Based Themes
                '1950s Diner theme with retro reds, whites, and chrome, featuring checkerboard patterns',
                'Medieval theme with deep burgundies, golds, and stone grays, featuring heraldic patterns',
                // Creative/Abstract Themes
                'Mystical forest with dark greens and purples, featuring magical sparkles and ethereal glows',
                'Midnight sky with deep purples and starry whites, featuring constellation patterns'
            ];

            const randomDescription = randomDescriptions[Math.floor(Math.random() * randomDescriptions.length)];
            const newTheme = await generateAppTheme(randomDescription);

            // Add the new theme to available themes if it doesn't already exist
            setAvailableThemes(prev => {
                const exists = prev.find(t => t.id === newTheme.id);
                if (exists) {
                    setSelectedTheme(newTheme.id);
                    return prev;
                }
                return [...prev, newTheme];
            });

            const themeId = newTheme.id;
            setSelectedTheme(themeId);
            dispatch({ type: 'SET_THEME', payload: themeId });
        } catch (err) {
            console.error("Random Theme Gen Failed", err);
            // Fallback to random preset if generation fails
            const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
            if (randomTheme) {
                setSelectedTheme(randomTheme.id);
                dispatch({ type: 'SET_THEME', payload: randomTheme.id });
            }
        } finally {
            setIsGeneratingTheme(false);
        }
    };

    return {
        handleAiThemeGen,
        handleRandomTheme
    };
}
