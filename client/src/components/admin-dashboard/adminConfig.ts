// Admin Dashboard Configuration
// Extracted from AdminDashboard.tsx

// Valid admin tab types
export type AdminTab =
    | 'overview' | 'live-activity' | 'user-feature-access' | 'security'
    | 'moderation' | 'llm-model-management' | 'ai-agents' | 'process-management'
    | 'settings' | 'database' | 'backups' | 'performance-monitoring'
    | 'integrations' | 'cloud-deployment' | 'rate-limiting' | 'alerts'
    | 'system-audit-logs' | 'financials' | 'packages' | 'analytics'
    | 'reports' | 'page-editor' | 'support-tickets' | 'support-chat' | 'support-templates';

// All valid tabs array
export const VALID_ADMIN_TABS: AdminTab[] = [
    'overview', 'live-activity', 'user-feature-access', 'security',
    'moderation', 'llm-model-management', 'ai-agents', 'process-management',
    'settings', 'database', 'backups', 'performance-monitoring',
    'integrations', 'cloud-deployment', 'rate-limiting', 'alerts',
    'system-audit-logs', 'financials', 'packages', 'analytics',
    'reports', 'page-editor', 'support-tickets', 'support-chat', 'support-templates'
];

// Backward compatibility tab redirects
export const TAB_REDIRECTS: Record<string, AdminTab> = {
    'audit': 'system-audit-logs',
    'activity': 'live-activity',
    'llm-analytics': 'analytics',
    'user-analytics': 'analytics',
    'users': 'user-feature-access',
    'projects': 'overview',
};

// Map tabs to their parent categories
export const TAB_CATEGORY_MAP: Record<string, string> = {
    'user-feature-access': 'users-access',
    'security': 'users-access',
    'moderation': 'users-access',
    'llm-router-settings': 'llm-ai',
    'internal-router-settings': 'llm-ai',
    'llm-model-management': 'llm-ai',
    'ai-agents': 'llm-ai',
    'process-management': 'llm-ai',
    'settings': 'system-ops',
    'database': 'system-ops',
    'backups': 'system-ops',
    'performance-monitoring': 'system-ops',
    'integrations': 'system-ops',
    'cloud-deployment': 'system-ops',
    'rate-limiting': 'system-ops',
    'alerts': 'system-ops',
    'system-audit-logs': 'system-ops',
    'financials': 'business-analytics',
    'packages': 'business-analytics',
    'analytics': 'business-analytics',
    'reports': 'business-analytics',
    'support-tickets': 'customer-support',
    'support-chat': 'customer-support',
    'support-templates': 'customer-support',
};

// Admin section descriptions for tooltips/headers
export const SECTION_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
    // Main Sections
    'overview': {
        title: 'Overview',
        description: 'Dashboard overview with key metrics, system health, and quick access to important information'
    },
    'live-activity': {
        title: 'Live Activity',
        description: 'Real-time monitoring of system activity, user actions, and live events across the platform'
    },
    'users-access': {
        title: 'Users & Access',
        description: 'Manage user accounts, roles, permissions, and feature access controls'
    },
    'llm-ai': {
        title: 'LLM & AI',
        description: 'Configure and manage LLM models, AI routing, agent knowledge, and AI-powered services'
    },
    'system-ops': {
        title: 'System & Operations',
        description: 'System configuration, database management, backups, monitoring, integrations, and infrastructure settings'
    },
    'business-analytics': {
        title: 'Business & Analytics',
        description: 'Financial metrics, subscription packages, analytics dashboards, and business reports'
    },
    'page-editor': {
        title: 'Page Editor',
        description: 'Edit and customize public-facing pages, landing pages, and content management'
    },
    'customer-support': {
        title: 'Customer Support',
        description: 'Manage support tickets, live chat, and customer service tools'
    },
    // User & Access Subsections
    'user-feature-access': {
        title: 'User & Feature Access',
        description: 'Manage user accounts, roles, and granular feature permissions'
    },
    'security': {
        title: 'Security',
        description: 'Configure security settings, authentication policies, IP whitelisting, 2FA, and security monitoring'
    },
    'api-keys': {
        title: 'API Keys',
        description: 'Manage API keys for LLM providers and external integrations'
    },
    'moderation': {
        title: 'Content Moderation',
        description: 'Monitor and moderate user-generated content'
    },
    // LLM & AI Subsections
    'llm-model-management': {
        title: 'LLM Models',
        description: 'Manage LLM models, API keys, and sync with providers'
    },
    'llm-router-settings': {
        title: 'End User Router',
        description: 'Configure AI-powered routing rules for end-user requests'
    },
    'internal-router-settings': {
        title: 'Internal Router',
        description: 'Configure AI-powered routing for internal/system tasks'
    },
    'ai-agents': {
        title: 'AI Agents',
        description: 'Manage AI agents, their knowledge, and configurations'
    },
    'process-management': {
        title: 'Process Management',
        description: 'Configure and manage business processes and workflows'
    },
    // System & Operations Subsections
    'settings': {
        title: 'System Settings',
        description: 'Configure system-wide settings and environment'
    },
    'database': {
        title: 'Database Manager',
        description: 'Manage database connections and collections'
    },
    'backups': {
        title: 'Backups',
        description: 'Configure automated backups and restore data'
    },
    'performance-monitoring': {
        title: 'Performance & Monitoring',
        description: 'Monitor system performance and track metrics'
    },
    'integrations': {
        title: 'Integrations',
        description: 'Manage third-party integrations and webhooks'
    },
    'cloud-deployment': {
        title: 'Cloud Deployment',
        description: 'Deploy projects to cloud platforms'
    },
    'rate-limiting': {
        title: 'Rate Limiting',
        description: 'Configure rate limits and API throttling'
    },
    'alerts': {
        title: 'Alerts',
        description: 'Configure alert rules and notification channels'
    },
    'system-audit-logs': {
        title: 'System Audit Logs',
        description: 'View comprehensive audit logs of all system actions'
    },
    // Business & Analytics Subsections
    'financials': {
        title: 'Financials',
        description: 'View financial metrics and revenue reports'
    },
    'packages': {
        title: 'Packages',
        description: 'Manage subscription packages and pricing tiers'
    },
    'analytics': {
        title: 'Analytics',
        description: 'Comprehensive analytics dashboard with insights'
    },
    'reports': {
        title: 'Reports',
        description: 'Generate custom reports and export data'
    },
    // Support Subsections
    'support-tickets': {
        title: 'Support Tickets',
        description: 'View and manage customer support tickets'
    },
    'support-chat': {
        title: 'Live Chat',
        description: 'Real-time chat support with customers'
    },
    'support-templates': {
        title: 'Response Templates',
        description: 'Create and manage canned responses'
    }
};

/**
 * Get initial tab from URL or localStorage
 */
export const getInitialTab = (): AdminTab => {
    if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        let tab: string | null = null;

        // Try hash parameters first (e.g., #admin?tab=finance)
        const hashTabMatch = hash.match(/[?&]tab=([^&]+)/);
        if (hashTabMatch) {
            tab = decodeURIComponent(hashTabMatch[1]);
        } else {
            // Try URL search params
            const urlParams = new URLSearchParams(window.location.search);
            tab = urlParams.get('tab');
        }

        if (tab) {
            // Apply redirects for backward compatibility
            if (TAB_REDIRECTS[tab]) {
                tab = TAB_REDIRECTS[tab];
            }

            if (VALID_ADMIN_TABS.includes(tab as AdminTab)) {
                return tab as AdminTab;
            }
        }

        // Fallback to localStorage
        try {
            const savedTab = localStorage.getItem('admin_active_tab');
            if (savedTab) {
                let tab = TAB_REDIRECTS[savedTab] || savedTab;
                if (TAB_REDIRECTS[tab]) {
                    tab = TAB_REDIRECTS[tab];
                    localStorage.setItem('admin_active_tab', tab);
                }
                if (VALID_ADMIN_TABS.includes(tab as AdminTab)) {
                    return tab as AdminTab;
                }
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    return 'overview';
};

/**
 * Get initial expanded categories from localStorage
 */
export const getInitialExpandedCategories = (activeTab: string): Set<string> => {
    const defaultCategories = new Set(['overview']);

    if (typeof window === 'undefined') {
        return defaultCategories;
    }

    try {
        const savedCategories = localStorage.getItem('admin_expanded_categories');
        if (savedCategories) {
            const categories = JSON.parse(savedCategories);
            if (Array.isArray(categories)) {
                const categorySet = new Set<string>(categories);

                // Ensure the category for the active tab is expanded
                const category = TAB_CATEGORY_MAP[activeTab];
                if (category) {
                    categorySet.add(category);
                }

                return categorySet;
            }
        }
    } catch (e) {
        // Ignore localStorage errors
    }

    // Expand category for active tab
    const category = TAB_CATEGORY_MAP[activeTab];
    if (category) {
        defaultCategories.add(category);
    }

    return defaultCategories;
};

export default {
    SECTION_DESCRIPTIONS,
    TAB_CATEGORY_MAP,
    TAB_REDIRECTS,
    VALID_ADMIN_TABS,
    getInitialTab,
    getInitialExpandedCategories,
};
