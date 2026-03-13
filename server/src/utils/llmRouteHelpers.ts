export function mapToSupportedMethodology(sdlcMethodology: string): 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD' {
    if (sdlcMethodology === 'LangGraph') {
        return 'Agile';
    }
    const supportedMethodologies = ['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Iterative', 'Prototyping', 'RAD', 'Scrum', 'Lean', 'ASD'];
    if (supportedMethodologies.includes(sdlcMethodology)) {
        return sdlcMethodology as 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD';
    }
    return 'V-Model';
}

export function getFallbackStandards(description: string, userGoal: string): string[] {
    const text = `${description} ${userGoal}`.toLowerCase();
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

export function detectProjectType(projectContext: string): string {
    if (!projectContext) return 'unknown';

    const context = projectContext.toLowerCase();

    const gameKeywords = [
        'video game', 'gaming', 'rpg', 'board game', 'card game', 'arcade',
        'unity', 'unreal engine', 'godot', 'pygame', 'multiplayer game',
        'platformer', 'fps', 'mmo', 'battle royale', 'pixel art game'
    ];

    if (gameKeywords.some(keyword => context.includes(keyword))) {
        return 'game';
    }

    if (context.includes('game') && !context.includes('gamification')) {
        return 'game';
    }

    const websiteKeywords = ['website', 'web app', 'web application', 'site', 'webpage', 'landing page', 'portfolio', 'blog', 'e-commerce', 'ecommerce', 'shop', 'store', 'marketplace', 'saas', 'dashboard', 'crm', 'cms'];
    if (websiteKeywords.some(keyword => context.includes(keyword))) {
        return 'website';
    }

    const mobileKeywords = ['mobile app', 'mobile application', 'ios app', 'android app', 'react native', 'flutter', 'swift', 'kotlin', 'ionic'];
    if (mobileKeywords.some(keyword => context.includes(keyword))) {
        return 'mobile-app';
    }

    const apiKeywords = ['api', 'backend', 'server', 'rest api', 'graphql', 'microservice', 'database', 'cloud'];
    if (apiKeywords.some(keyword => context.includes(keyword))) {
        return 'api';
    }

    return 'unknown';
}
