import { logger } from '../utils/logger.js';

/**
 * Categorized feature sets for prototype generation
 */
export interface CategorizedFeatures {
    playerFacing: string[];  // Features for end users/players
    adminFacing: string[];   // Features for administrators/staff
    common: string[];        // Shared features (auth, settings, profile)
}

/**
 * Service to categorize features into player-facing vs admin-facing
 * This ensures prototypes don't mix admin features with user features
 */
class FeatureCategorializationService {
    // Keywords that indicate admin/staff features
    private readonly adminKeywords = [
        'admin', 'administrator', 'moderation', 'moderate',
        'analytics', 'dashboard', 'stats', 'statistics',
        'manage', 'management', 'configuration', 'config',
        'settings', 'system', 'logs', 'monitoring',
        'ban', 'reports', 'reporting', 'control panel',
        'backend', 'database', 'server', 'api management',
        'user management', 'content management', 'cms',
        'approval', 'review', 'audit', 'compliance',
        // Business/Platform admin keywords
        'inventory', 'stock', 'catalog', 'product management',
        'order management', 'transaction', 'payment processing',
        'customer management', 'vendor', 'merchant',
        'event management', 'organizer', 'ticketing admin',
        'booking management', 'reservation system',
        'pricing', 'discount', 'coupon', 'promotion management',
        'refund', 'cancellation', 'policy management',
        'staff', 'employee', 'role', 'permission',
        'sales report', 'revenue', 'financial dashboard'
    ];

    // Keywords that indicate player/user-facing features (especially for games)
    private readonly playerKeywords = [
        'play', 'player', 'game', 'level', 'score',
        'character', 'avatar', 'inventory', 'quest',
        'mission', 'achievement', 'leaderboard',
        'upgrade', 'power', 'ability', 'skill',
        'combat', 'battle', 'fight', 'move', 'control',
        'shop', 'store', 'purchase', 'buy',
        'profile', 'account', 'login', 'register',
        'search', 'browse', 'view', 'explore',
        'chat', 'message', 'social', 'friend',
        'customize', 'personalize', 'preference'
    ];

    // Common features that appear in both (usually authentication/profile)
    private readonly commonKeywords = [
        'authentication', 'auth', 'login', 'logout',
        'register', 'signup', 'sign up', 'sign in',
        'profile', 'account', 'user profile',
        'password', 'reset password', 'forgot password',
        'notification', 'notifications', 'alerts'
    ];

    /**
     * Categorize a list of features into player-facing, admin-facing, and common
     */
    categorizeFeatures(features: string[], projectType: string = 'web'): CategorizedFeatures {
        const result: CategorizedFeatures = {
            playerFacing: [],
            adminFacing: [],
            common: []
        };

        if (!features || features.length === 0) {
            logger.warn('[FeatureCategorization] No features provided for categorization');
            return result;
        }

        for (const feature of features) {
            const featureLower = feature.toLowerCase();

            // Check if it's a common feature first (highest priority)
            const isCommon = this.commonKeywords.some(keyword =>
                featureLower.includes(keyword)
            );

            if (isCommon) {
                result.common.push(feature);
                continue;
            }

            // Check if it's an admin feature
            const isAdmin = this.adminKeywords.some(keyword =>
                featureLower.includes(keyword)
            );

            if (isAdmin) {
                result.adminFacing.push(feature);
                continue;
            }

            // Default to player-facing for games, or check player keywords for other types
            if (projectType === 'game') {
                // For games, assume player-facing unless admin keyword found
                result.playerFacing.push(feature);
            } else {
                // For non-games, check player keywords
                const isPlayer = this.playerKeywords.some(keyword =>
                    featureLower.includes(keyword)
                );

                if (isPlayer) {
                    result.playerFacing.push(feature);
                } else {
                    // Default to player-facing for ambiguous cases
                    result.playerFacing.push(feature);
                }
            }
        }

        logger.info(`[FeatureCategorization] Categorized ${features.length} features:`, {
            playerFacing: result.playerFacing.length,
            adminFacing: result.adminFacing.length,
            common: result.common.length
        });

        return result;
    }

    /**
     * Get a summary of categorization for debugging
     */
    getSummary(categorized: CategorizedFeatures): string {
        return `Player: ${categorized.playerFacing.length}, Admin: ${categorized.adminFacing.length}, Common: ${categorized.common.length}`;
    }
}

// Export singleton instance
export const featureCategorizationService = new FeatureCategorializationService();
