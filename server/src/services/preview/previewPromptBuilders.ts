/**
 * Preview Prompt Builders
 * Extracted prompt construction utilities from enhancedPreviewGenerator.service.ts
 */


/**
 * Detect project domain/subtype for better prompt customization
 */
export function detectProjectDomain(userGoal: string, projectType: string): string {
    const goal = userGoal.toLowerCase();

    // Game subtypes
    if (projectType === 'game') {
        if (goal.includes('puzzle') || goal.includes('match')) return 'puzzle-game';
        if (goal.includes('platform') || goal.includes('mario')) return 'platformer';
        if (goal.includes('rpg') || goal.includes('role-playing')) return 'rpg';
        if (goal.includes('shooter') || goal.includes('fps')) return 'shooter';
        if (goal.includes('strategy') || goal.includes('tower defense')) return 'strategy';
        if (goal.includes('racing') || goal.includes('car')) return 'racing';
        if (goal.includes('sports')) return 'sports';
        if (goal.includes('card') || goal.includes('poker')) return 'card-game';
        if (goal.includes('board')) return 'board-game';
        return 'general-game';
    }

    // Web app subtypes
    if (projectType === 'web') {
        if (goal.includes('ecommerce') || goal.includes('shop') || goal.includes('store')) return 'ecommerce';
        if (goal.includes('blog') || goal.includes('content')) return 'blog';
        if (goal.includes('social') || goal.includes('community')) return 'social';
        if (goal.includes('dashboard') || goal.includes('admin')) return 'dashboard';
        if (goal.includes('portfolio')) return 'portfolio';
        if (goal.includes('saas') || goal.includes('subscription')) return 'saas';
        if (goal.includes('booking') || goal.includes('reservation')) return 'booking';
        if (goal.includes('learning') || goal.includes('education') || goal.includes('course')) return 'education';
        if (goal.includes('healthcare') || goal.includes('medical')) return 'healthcare';
        if (goal.includes('finance') || goal.includes('banking')) return 'fintech';
        return 'general-web';
    }

    // Mobile subtypes
    if (projectType === 'mobile') {
        if (goal.includes('fitness') || goal.includes('health')) return 'fitness';
        if (goal.includes('delivery') || goal.includes('food')) return 'delivery';
        if (goal.includes('chat') || goal.includes('messaging')) return 'messaging';
        if (goal.includes('streaming') || goal.includes('music') || goal.includes('video')) return 'media';
        return 'general-mobile';
    }

    return 'general';
}

/**
 * Get domain-specific prompt additions
 */
export function getDomainSpecificPrompt(_projectType: string, domain: string): string {
    const prompts: Record<string, string> = {
        'puzzle-game': `
GAME MECHANICS:
- Grid-based or tile matching system
- Clear win/lose conditions
- Score tracking and levels
- Visual feedback for matches/moves`,

        'platformer': `
GAME MECHANICS:
- Character movement (run, jump)
- Platform collision detection
- Enemy AI and obstacle avoidance
- Collectibles and power-ups`,

        'ecommerce': `
KEY FEATURES:
- Product catalog with categories
- Shopping cart functionality
- Checkout flow
- User accounts and order history`,

        'dashboard': `
KEY FEATURES:
- Data visualization (charts, graphs)
- KPI widgets
- Filtering and date ranges
- Export functionality`,

        'saas': `
KEY FEATURES:
- User authentication
- Subscription/pricing tiers
- User dashboard
- Settings and billing`,

        'education': `
KEY FEATURES:
- Course/lesson structure
- Progress tracking
- Quizzes/assessments
- Certificate generation`,
    };

    return prompts[domain] || '';
}

/**
 * Map SDLC methodology name to supported project methodology
 */
export function mapToSupportedMethodology(
    sdlcMethodology: string
): 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD' {
    const mapping: Record<string, 'V-Model' | 'Agile' | 'Waterfall' | 'Spiral' | 'DevOps' | 'Iterative' | 'Prototyping' | 'RAD' | 'Scrum' | 'Lean' | 'ASD'> = {
        'v-model': 'V-Model',
        'agile': 'Agile',
        'waterfall': 'Waterfall',
        'spiral': 'Spiral',
        'devops': 'DevOps',
        'iterative': 'Iterative',
        'prototyping': 'Prototyping',
        'rad': 'RAD',
        'scrum': 'Scrum',
        'lean': 'Lean',
        'asd': 'ASD',
        'adaptive': 'ASD',
    };

    const normalized = sdlcMethodology.toLowerCase().trim();
    return mapping[normalized] || 'Agile';
}

/**
 * Fallback standards matching based on keywords
 */
export function getFallbackStandards(description: string, userGoal: string): string[] {
    const combined = `${description} ${userGoal}`.toLowerCase();
    const standards: string[] = [];

    // Healthcare
    if (combined.includes('health') || combined.includes('medical') || combined.includes('patient')) {
        standards.push('HIPAA', 'HL7 FHIR');
    }

    // Finance
    if (combined.includes('finance') || combined.includes('payment') || combined.includes('banking')) {
        standards.push('PCI-DSS', 'SOX');
    }

    // Security
    if (combined.includes('security') || combined.includes('authentication') || combined.includes('encryption')) {
        standards.push('ISO 27001', 'OWASP');
    }

    // Quality
    if (combined.includes('quality') || combined.includes('testing') || combined.includes('qa')) {
        standards.push('ISO 9001', 'ISTQB');
    }

    // Accessibility
    if (combined.includes('accessibility') || combined.includes('a11y') || combined.includes('wcag')) {
        standards.push('WCAG 2.1');
    }

    // Default web standards
    if (standards.length === 0) {
        standards.push('W3C', 'OWASP Top 10');
    }

    return standards;
}

/**
 * Determine if a project should auto-generate an admin console
 */
export function shouldAutoGenerateAdmin(userGoal: string, features: string[]): boolean {
    const goal = userGoal.toLowerCase();
    const featureText = features.join(' ').toLowerCase();

    // Keywords that suggest admin panel is needed
    const adminKeywords = [
        'manage', 'admin', 'dashboard', 'moderate',
        'inventory', 'users', 'content management',
        'analytics', 'reports', 'settings',
        'ecommerce', 'orders', 'products',
        'saas', 'subscription', 'billing'
    ];

    return adminKeywords.some(kw => goal.includes(kw) || featureText.includes(kw));
}

/**
 * Infer admin features based on user goal and existing features
 */
export function inferAdminFeatures(userGoal: string, _features: string[]): string[] {
    const goal = userGoal.toLowerCase();
    const inferred: string[] = [];

    // Core admin features
    inferred.push('User Management');
    inferred.push('Dashboard Overview');

    // Domain-specific admin features
    if (goal.includes('ecommerce') || goal.includes('shop')) {
        inferred.push('Order Management');
        inferred.push('Product Catalog');
        inferred.push('Inventory Tracking');
    }

    if (goal.includes('content') || goal.includes('blog')) {
        inferred.push('Content Editor');
        inferred.push('Media Library');
    }

    if (goal.includes('saas')) {
        inferred.push('Subscription Management');
        inferred.push('Billing Dashboard');
    }

    if (goal.includes('game')) {
        inferred.push('Player Statistics');
        inferred.push('Leaderboard Management');
        inferred.push('Game Configuration');
    }

    // Always include
    inferred.push('Settings & Configuration');
    inferred.push('Activity Logs');

    return Array.from(new Set(inferred)); // Remove duplicates
}
