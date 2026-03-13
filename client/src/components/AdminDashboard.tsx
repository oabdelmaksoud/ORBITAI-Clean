
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, LayoutGrid, CreditCard, Settings, Search, Bell, LogOut, ChevronRight, MoreVertical, Shield, Activity, DollarSign, Database, Lock, Trash2, Ban, CheckCircle, AlertTriangle, AlertCircle, TrendingUp, Download, Loader2, Package as PackageIcon, FileText, CheckSquare, X, Brain, ToggleLeft, Edit, Star, StarOff, BarChart3, ChevronDown, FolderOpen, BookOpen, Workflow, Sparkles, Play, Key, Wifi, WifiOff, RefreshCw, Route, Zap, Cloud, Headphones, MessageCircle, Ticket, Cpu, Bot } from 'lucide-react';
import {
    getDashboardStats,
    getUsers,
    getUserDetails,
    updateUser,
    createUser,
    deleteUser,
    getProjects,
    getProjectDetails,
    updateProject,
    deleteProject,
    markProjectAsSample,
    unmarkProjectAsSample,
    getSystemConfig,
    getSystemStats,
    AdminUser,
    AdminProject,
    DashboardStats
} from '../services/adminApi';
import {
    getPackages,
    getAuditLogs,
    exportUsers,
    exportProjects,
    bulkUserAction,
    bulkProjectAction,
    getFinancialDashboard,
    Package,
    AuditLog,
    FinancialDashboard
} from '../services/adminApiExtended';
import { getLiveUsage, getUsageStats, getCostBreakdown, LiveUsage, UsageStats, CostBreakdown } from '../services/llmUsageApi';
import { getAnalyticsOverview } from '../services/adminApiExtended';
import { getActivityStats, getActivityEvents } from '../services/activityApi';
import { apiRequest } from '../services/adminApi';
import { clearUserCaches, clearProjectCaches, clearPackageCaches } from '../services/adminCache';
import { getUserSettings, updatePreference } from '../services/userSettingsApi';
import PackageManager from './PackageManager';
import LLMAnalytics from './LLMAnalytics';
import LLMRouterSettings from './LLMRouterSettings';
import InternalRouterSettings from './InternalRouterSettings';
import LLMModelManagement from './LLMModelManagement';
import ContentModeration from './ContentModeration';
import UserAndFeatureAccessManager from './UserAndFeatureAccessManager';
import LiveFinancialMetrics from './LiveFinancialMetrics';
import ProcessImprovementManager from './ProcessImprovementManager';
import ProcessAnalyticsDashboard from './ProcessAnalyticsDashboard';
import ProcessMiningVisualizer from './ProcessMiningVisualizer';
import PageEditor from './PageEditor';
import ElementorPageEditor from './ElementorPageEditor';
import GrapesJSPageEditor, { GrapesPage } from './GrapesJSPageEditor';
import { getLandingConfig } from '../config/landing';
import { getPages, createPage, deletePage, updatePage } from '../services/grapesPagesApi';
import { PageBuilderList } from './page-editor/PageBuilderList';
import AIAgentsManager from './AIAgentsManager';
import SystemSettings from './SystemSettings';
import AnalyticsDashboard from './AnalyticsDashboard';
import SecurityDashboard from './SecurityDashboard';
import BackupManagement from './BackupManagement';
import AlertConfiguration from './AlertConfiguration';
import UnifiedAnalytics from './UnifiedAnalytics';
import EnhancedFinancialDashboard from './EnhancedFinancialDashboard';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import PerformanceMonitoring from './PerformanceMonitoring';
import CustomReportBuilder from './CustomReportBuilder';
import { getNotifications, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, Notification as NotificationType } from '../services/notificationsApi';
import NLPServiceDashboard from './NLPServiceDashboard';
import WorkflowEngineDashboard from './WorkflowEngineDashboard';
import AIOptimizationDashboard from './AIOptimizationDashboard';
import ProcessSimulationDashboard from './ProcessSimulationDashboard';
import ApiKeyManager from './ApiKeyManager';
import { useBackendConnection } from '../hooks/useBackendConnection';
import SystemCostsDashboard from './SystemCostsDashboard';
import ProcessManagementTab from './ProcessManagementTab';
import PerformanceMonitoringTab from './PerformanceMonitoringTab';
import FinancialsTab from './FinancialsTab';
import DatabaseManager from './DatabaseManager';
import IntegrationsManagement from './IntegrationsManagement';
import CloudDeployment from './CloudDeployment';
import RateLimitingManagement from './RateLimitingManagement';
import EnhancedOverview from './EnhancedOverview';
import LiveActivityTab from './LiveActivityTab';
import SupportDashboard from './SupportDashboard';
// Developer Tools components removed - these are end-user features, not admin features
// import CodeGenerationPanel from './CodeGenerationPanel';
// import CodeValidationPanel from './CodeValidationPanel';
// import MobileDeploymentWizard from './MobileDeploymentWizard';
// import GitHubIntegrationPanel from './GitHubIntegrationPanel';

import { showAlert, showConfirm } from '../utils/browserUtils';
import { toast } from '../services/toastService';
interface AdminDashboardProps {
    onExit: () => void;
    token?: string;
}

interface ProjectMeta {
    id: string;
    name: string;
    lastModified: number;
    description: string;
    phase: string;
    isSample?: boolean;
    llmActivity?: {
        totalCalls: number;
        totalCost: number;
        totalTokens: number;
        lastActivity?: Date;
    };
}

interface User {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin' | 'superadmin' | 'editor';
    status: 'Active' | 'Inactive' | 'Banned';
    lastLogin: number;
    plan: 'Free' | 'Pro' | 'Enterprise';
}

// Removed unused MOCK_USERS - AdminDashboard uses real API data

// Helper function to get initial tab from URL or localStorage
const getInitialTab = (): 'overview' | 'live-activity' | 'user-feature-access' | 'security' | 'moderation' | 'llm-model-management' | 'ai-agents' | 'process-management' | 'settings' | 'database' | 'backups' | 'performance-monitoring' | 'integrations' | 'cloud-deployment' | 'rate-limiting' | 'alerts' | 'system-audit-logs' | 'financials' | 'packages' | 'analytics' | 'reports' | 'page-editor' | 'support-tickets' | 'support-chat' | 'support-templates' => {
    // First, try to get from URL hash parameter
    if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        // Check for #admin?tab=finance or #admin&tab=finance format
        // Also check URL search params (window.location.search)
        let tab: string | null = null;

        // Try hash parameters first (e.g., #admin?tab=finance)
        const hashTabMatch = hash.match(/[?&]tab=([^&]+)/);
        if (hashTabMatch) {
            tab = decodeURIComponent(hashTabMatch[1]);
        } else {
            // Try URL search params (e.g., ?tab=finance#admin)
            const urlParams = new URLSearchParams(window.location.search);
            tab = urlParams.get('tab');
        }

        if (tab) {
            // Backward compatibility: redirect old tab names to new ones
            const tabRedirects: Record<string, string> = {
                'audit': 'system-audit-logs',
                'activity': 'live-activity',
                'llm-analytics': 'analytics',
                'user-analytics': 'analytics',
            };

            if (tabRedirects[tab]) {
                tab = tabRedirects[tab];
            }

            // Validate tab is a valid tab ID
            const validTabs = ['overview', 'live-activity', 'user-feature-access', 'security', 'moderation', 'llm-model-management', 'ai-agents', 'process-management', 'settings', 'database', 'backups', 'performance-monitoring', 'integrations', 'cloud-deployment', 'rate-limiting', 'alerts', 'system-audit-logs', 'financials', 'packages', 'analytics', 'reports', 'page-editor', 'support-tickets', 'support-chat', 'support-templates'];
            if (validTabs.includes(tab)) {
                return tab as any;
            }
        }

        // Fallback to localStorage
        try {
            const savedTab = localStorage.getItem('admin_active_tab');
            if (savedTab && typeof savedTab === 'string') {
                // Backward compatibility: redirect old tab names to new ones
                const tabRedirects: Record<string, string> = {
                    'audit': 'system-audit-logs',
                    'activity': 'live-activity',
                    'llm-analytics': 'analytics',
                    'user-analytics': 'analytics',
                };

                let tab = savedTab;
                if (tabRedirects[tab]) {
                    tab = tabRedirects[tab];
                    // Update localStorage with new tab name
                    localStorage.setItem('admin_active_tab', tab);
                }

                const validTabs = ['overview', 'live-activity', 'user-feature-access', 'security', 'api-keys', 'moderation', 'llm-router-settings', 'internal-router-settings', 'llm-model-management', 'ai-agents', 'process-management', 'settings', 'database', 'backups', 'performance-monitoring', 'integrations', 'cloud-deployment', 'rate-limiting', 'alerts', 'system-audit-logs', 'financials', 'packages', 'analytics', 'reports', 'page-editor', 'support-tickets', 'support-chat', 'support-templates'];
                if (validTabs.includes(tab)) {
                    return tab as any;
                }
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    return 'overview';
};

// Helper function to get initial expanded categories from localStorage
const getInitialExpandedCategories = (activeTab: string): Set<string> => {
    const defaultCategories = new Set(['overview']);

    if (typeof window === 'undefined') {
        return defaultCategories;
    }

    try {
        const savedCategories = localStorage.getItem('admin_expanded_categories');
        if (savedCategories) {
            const categories = JSON.parse(savedCategories);
            if (Array.isArray(categories)) {
                const categorySet = new Set(categories);

                // Ensure the category for the active tab is expanded
                const categoryMap: Record<string, string> = {
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

                const category = categoryMap[activeTab];
                if (category) {
                    categorySet.add(category);
                }

                return categorySet;
            }
        }
    } catch (e) {
        // Ignore localStorage errors
    }

    // If no saved categories, ensure the category for active tab is expanded
    const categoryMap: Record<string, string> = {
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

    const category = categoryMap[activeTab];
    if (category) {
        defaultCategories.add(category);
    }

    return defaultCategories;
};

// Admin Console Section Descriptions
const SECTION_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
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
    // Subsections - Users & Access
    'user-feature-access': {
        title: 'User & Feature Access',
        description: 'Manage user accounts, roles, and granular feature permissions. Control which features are available to different user roles and packages'
    },
    'security': {
        title: 'Security',
        description: 'Configure security settings, authentication policies, IP whitelisting, 2FA, and security monitoring'
    },
    'api-keys': {
        title: 'API Keys',
        description: 'Manage API keys for LLM providers (OpenAI, Anthropic, Gemini, etc.), external integrations, and AI services'
    },
    'moderation': {
        title: 'Content Moderation',
        description: 'Monitor and moderate user-generated content, manage flagged content, and configure moderation rules'
    },
    // Subsections - LLM & AI
    'llm-model-management': {
        title: 'LLM Models',
        description: 'Manage LLM models, API keys, sync with providers, and configure model availability across all AI providers'
    },
    'llm-router-settings': {
        title: 'End User Router',
        description: 'Configure AI-powered routing rules for end-user requests with intelligent model selection and cost optimization'
    },
    'internal-router-settings': {
        title: 'Internal Router',
        description: 'Configure AI-powered routing for internal/system tasks with cost optimization and automatic model selection'
    },
    'ai-agents': {
        title: 'AI Agents',
        description: 'Manage all AI agents, their knowledge, skills, and custom configurations in one unified view'
    },
    'process-management': {
        title: 'Process Management',
        description: 'Configure and manage business processes, workflows, process mining, and process optimization'
    },
    // Subsections - System & Operations
    'settings': {
        title: 'System Settings',
        description: 'Configure system-wide settings, environment variables, API endpoints, and core platform configuration'
    },
    'database': {
        title: 'Database Manager',
        description: 'Manage database connections, collections, indexes, query optimization, and database health monitoring'
    },
    'backups': {
        title: 'Backups',
        description: 'Configure automated backups, restore data, manage backup schedules, and monitor backup health'
    },
    'performance-monitoring': {
        title: 'Performance & Monitoring',
        description: 'Monitor system performance, track metrics, analyze bottlenecks, and optimize system resources'
    },
    'integrations': {
        title: 'Integrations',
        description: 'Manage third-party integrations (Slack, GitHub, MCP servers, webhooks) and external service connections'
    },
    'cloud-deployment': {
        title: 'Cloud Deployment',
        description: 'Deploy projects to cloud platforms (AWS, Azure, GCP, Vercel, Heroku) with automated CI/CD pipelines'
    },
    'rate-limiting': {
        title: 'Rate Limiting',
        description: 'Configure rate limits, API throttling, request quotas, and protect against abuse and DDoS attacks'
    },
    'alerts': {
        title: 'Alerts',
        description: 'Configure alert rules, notification channels, system alerts, and monitoring thresholds'
    },
    'system-audit-logs': {
        title: 'System Audit Logs',
        description: 'View comprehensive audit logs of all system actions, user activities, and administrative changes'
    },
    // Subsections - Business & Analytics
    'financials': {
        title: 'Financials',
        description: 'View financial metrics, revenue reports, subscription analytics, cost breakdowns, and billing information'
    },
    'packages': {
        title: 'Packages',
        description: 'Manage subscription packages, pricing tiers, feature limits, and package configurations'
    },
    'analytics': {
        title: 'Analytics',
        description: 'Comprehensive analytics dashboard with user activity, system usage, performance metrics, and insights'
    },
    'reports': {
        title: 'Reports',
        description: 'Generate custom reports, export data, create scheduled reports, and analyze business metrics'
    },
    // Customer Support
    'customer-support': {
        title: 'Customer Support',
        description: 'Manage support tickets, live chat, and customer service tools'
    },
    'support-tickets': {
        title: 'Support Tickets',
        description: 'View and manage customer support tickets, assign agents, track resolution times, and respond to customer inquiries'
    },
    'support-chat': {
        title: 'Live Chat',
        description: 'Real-time chat support with customers, manage chat queue, transfer chats between agents, and view chat history'
    },
    'support-templates': {
        title: 'Response Templates',
        description: 'Create and manage canned responses for common support scenarios to improve response time and consistency'
    }
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit, token }) => {
    const initialTab = getInitialTab();
    const [activeTab, setActiveTab] = useState<'overview' | 'live-activity' | 'user-feature-access' | 'security' | 'moderation' | 'llm-model-management' | 'ai-agents' | 'process-management' | 'settings' | 'database' | 'backups' | 'performance-monitoring' | 'integrations' | 'cloud-deployment' | 'rate-limiting' | 'alerts' | 'system-audit-logs' | 'financials' | 'packages' | 'analytics' | 'reports' | 'page-editor' | 'support-tickets' | 'support-chat' | 'support-templates'>(initialTab);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(getInitialExpandedCategories(initialTab));
    const [projects, setProjects] = useState<ProjectMeta[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [grapesPages, setGrapesPages] = useState<GrapesPage[]>([]);
    const [currentPageKey, setCurrentPageKey] = useState('home');
    const [error, setError] = useState<string | null>(null);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // New state for enhanced features
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [packages, setPackages] = useState<Package[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [financialData, setFinancialData] = useState<FinancialDashboard | null>(null);
    const [showExportMenu, setShowExportMenu] = useState<'users' | 'projects' | null>(null);

    // Live metrics state for overview
    const [liveLLMUsage, setLiveLLMUsage] = useState<LiveUsage | null>(null);
    const [todayLLMStats, setTodayLLMStats] = useState<UsageStats | null>(null);
    const [todayCostBreakdown, setTodayCostBreakdown] = useState<CostBreakdown | null>(null);
    const [analyticsOverview, setAnalyticsOverview] = useState<any>(null);
    const [activityStats, setActivityStats] = useState<any>(null);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [overviewRefreshInterval, setOverviewRefreshInterval] = useState<NodeJS.Timeout | null>(null);
    const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
    const [auditFilters, setAuditFilters] = useState<{ action?: string; entityType?: string; status?: string; startDate?: string; endDate?: string }>({});

    // Project LLM Activity state
    const [projectLLMActivities, setProjectLLMActivities] = useState<Record<string, UsageStats>>({});
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [projectLLMDetails, setProjectLLMDetails] = useState<UsageStats | null>(null);

    // Enhanced User Management state
    const [userFilters, setUserFilters] = useState<{
        role: string;
        plan: string;
        status: string;
    }>({ role: 'all', plan: 'all', status: 'all' });
    const [userSortBy, setUserSortBy] = useState<'name' | 'email' | 'lastLogin' | 'plan'>('name');
    const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUserData, setNewUserData] = useState({
        email: '',
        password: '',
        name: '',
        plan: 'Free' as 'Free' | 'Pro' | 'Enterprise',
        role: 'user' as 'user' | 'admin' | 'superadmin' | 'editor'
    });

    // Notification state
    const [notifications, setNotifications] = useState<NotificationType[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    // Backend availability state
    const [backendError, setBackendError] = useState<boolean>(false);

    const adminToken = token || localStorage.getItem('admin_token') || '';

    // Get current admin user's role for feature flag checks
    const [currentAdminRole, setCurrentAdminRole] = useState<'admin' | 'superadmin' | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Feature flag checks
    const { enabled: canManageUsers, loading: userManagementLoading } = useFeatureAccess('user_management', currentAdminRole || undefined);
    const { enabled: canManagePackages } = useFeatureAccess('package_management', currentAdminRole || undefined);
    const { enabled: canViewAuditLogs } = useFeatureAccess('audit_logs', currentAdminRole || undefined);
    const { enabled: canViewFinancialDashboard } = useFeatureAccess('financial_dashboard', currentAdminRole || undefined);
    const { enabled: canViewAnalyticsDashboard } = useFeatureAccess('analytics_dashboard', currentAdminRole || undefined);
    const { enabled: canExportData } = useFeatureAccess('export_data', currentAdminRole || undefined);

    // Backend connection status
    const backendConnection = useBackendConnection();

    // Refs to prevent duplicate API calls from React StrictMode double invocation
    const loadingAdminInfoRef = useRef(false);
    const loadingDashboardStatsRef = useRef(false);
    const loadingNotificationsRef = useRef(false);

    // Load overview metrics (Live LLM Usage, Today's Stats, Growth, Activity)
    // Defined early so it can be used in useEffect
    const loadOverviewMetrics = useCallback(async () => {
        if (!adminToken) return;

        try {
            // Load all metrics in parallel with error handling
            const [liveResult, statsResult, analyticsResult, activityResult, recentActivityResult] = await Promise.allSettled([
                getLiveUsage(adminToken, 5).catch(() => ({ calls: 0, tokens: 0, cost: 0, rate: 0, byModel: {} })),
                getUsageStats(adminToken, {
                    startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
                }).catch(() => ({ totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0, byProvider: {}, byModel: {}, recentCalls: [] })),
                getAnalyticsOverview(adminToken).catch(() => ({ users: { last7Days: 0, last30Days: 0, active7d: 0 }, projects: { last7Days: 0, last30Days: 0 } })),
                getActivityStats(adminToken).catch(() => ({ last24Hours: 0, last7Days: 0, last30Days: 0, byType: {}, byEntityType: {}, topUsers: [], topIPs: [] })),
                getActivityEvents(adminToken, { limit: 10 }).catch(() => [])
            ]);

            // Extract values from settled promises
            if (liveResult.status === 'fulfilled') {
                setLiveLLMUsage(liveResult.value);
            }
            if (statsResult.status === 'fulfilled') {
                setTodayLLMStats(statsResult.value);
            }
            if (analyticsResult.status === 'fulfilled') {
                setAnalyticsOverview(analyticsResult.value);
            }
            if (activityResult.status === 'fulfilled') {
                setActivityStats(activityResult.value);
            }
            if (recentActivityResult.status === 'fulfilled') {
                setRecentActivity(recentActivityResult.value);
            }

            setLastUpdate(new Date());
        } catch (err: any) {
            const isConnectionError = err.message?.includes('Failed to fetch') ||
                err.message?.includes('ERR_CONNECTION_REFUSED');

            if (isConnectionError) {
                setBackendError(true);
            } else {
                console.error('Failed to load overview metrics:', err);
            }

            // Set default values to prevent "Loading..." state
            setLiveLLMUsage({ calls: 0, tokens: 0, cost: 0, rate: 0, byModel: {} });
            setTodayLLMStats({ totalCalls: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalCost: 0, byProvider: {}, byModel: {}, recentCalls: [] });
            setAnalyticsOverview({ users: { last7Days: 0, last30Days: 0, active7d: 0 }, projects: { last7Days: 0, last30Days: 0 } });
            setActivityStats({ last24Hours: 0, last7Days: 0, last30Days: 0, byType: {}, byEntityType: {}, topUsers: [], topIPs: [] });
            setRecentActivity([]);
        }
    }, [adminToken]);

    useEffect(() => {
        // Load current admin user info
        const loadAdminInfo = async () => {
            if (!adminToken || loadingAdminInfoRef.current) return;
            loadingAdminInfoRef.current = true;
            try {
                const { getAdminUser } = await import('../services/adminApi');
                const adminUser = await getAdminUser(adminToken);
                setCurrentAdminRole(adminUser.role as 'admin' | 'superadmin');
                setCurrentUserId(adminUser.id || null);

                // Load admin preferences from database
                try {
                    const settings = await getUserSettings(adminToken);
                    if (settings.preferences?.admin_active_tab) {
                        const savedTab = settings.preferences.admin_active_tab;
                        if (savedTab && typeof savedTab === 'string') {
                            const tabRedirects: Record<string, string> = {
                                'users': 'user-feature-access',
                                'projects': 'overview',
                                'analytics': 'analytics',
                                'settings': 'settings'
                            };
                            const redirectedTab = tabRedirects[savedTab] || savedTab;
                            const validTabs = ['overview', 'live-activity', 'user-feature-access', 'security', 'moderation', 'llm-router-settings', 'internal-router-settings', 'llm-model-management', 'ai-agents', 'process-management', 'settings', 'database', 'backups', 'performance-monitoring', 'integrations', 'cloud-deployment', 'rate-limiting', 'alerts', 'system-audit-logs', 'financials', 'packages', 'analytics', 'reports', 'page-editor', 'support-tickets', 'support-chat', 'support-templates'];
                            if (validTabs.includes(redirectedTab)) {
                                setActiveTab(redirectedTab as any);
                            }
                        }
                    }
                    if (settings.preferences?.admin_expanded_categories) {
                        const savedCategories = settings.preferences.admin_expanded_categories;
                        if (Array.isArray(savedCategories)) {
                            setExpandedCategories(new Set(savedCategories));
                        }
                    }
                } catch (prefErr) {
                    // Fallback to localStorage if database load fails
                    console.warn('Failed to load admin preferences from database, using localStorage:', prefErr);
                }
            } catch (err) {
                console.error('Failed to load admin user info:', err);
                // Default to admin if we can't fetch (for backward compatibility)
                setCurrentAdminRole('admin');
            } finally {
                loadingAdminInfoRef.current = false;
            }
        };
        loadAdminInfo();
    }, [adminToken]);

    useEffect(() => {
        if (!adminToken) {
            setError('No admin token found. Please log in again.');
            return;
        }

        // Load dashboard stats and overview metrics when overview tab is active
        if (activeTab === 'overview') {
            loadDashboardStats();
            loadOverviewMetrics();

            // Set up refresh interval for live metrics (every 30 seconds)
            const interval = setInterval(() => {
                loadOverviewMetrics();
            }, 30000);

            // Store interval for cleanup
            setOverviewRefreshInterval(interval);

            // Cleanup on unmount or tab change
            return () => {
                if (interval) {
                    clearInterval(interval);
                }
            };
        } else {
            // Clear interval when leaving overview tab
            if (overviewRefreshInterval) {
                clearInterval(overviewRefreshInterval);
                setOverviewRefreshInterval(null);
            }
        }

        // Load users when user-feature-access tab is active
        if (activeTab === 'user-feature-access') {
            // Component handles its own loading
        }

        // Load packages when packages tab is active
        if (activeTab === 'packages') {
            loadPackages();
        }

        // Load audit logs when system-audit-logs tab is active
        if (activeTab === 'system-audit-logs') {
            loadAuditLogs();
        }

        // Load financial data when financials tab is active
        if (activeTab === 'financials') {
            loadFinancialData();
        }

        // Auto-expand category if tab is active
        const categoryMap: Record<string, string> = {
            'user-feature-access': 'users-access',
            'security': 'users-access',
            'moderation': 'users-access',
            'llm-router-settings': 'llm-ai',
            'internal-router-settings': 'llm-ai',
            'llm-model-management': 'llm-ai',
            'llm-analytics': 'llm-ai',
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
            'activity': 'system-ops',
            'audit': 'system-ops',
            'financials': 'business-analytics',
            'packages': 'business-analytics',
            'analytics': 'business-analytics',
            'user-analytics': 'business-analytics',
            'support-tickets': 'customer-support',
            'support-chat': 'customer-support',
            'support-templates': 'customer-support',
            'reports': 'business-analytics',
        };

        const category = categoryMap[activeTab];
        if (category) {
            setExpandedCategories(prev => {
                if (!prev.has(category)) {
                    return new Set([...prev, category]);
                }
                return prev;
            });
        }
    }, [activeTab, adminToken, loadOverviewMetrics]);

    // Persist active tab to URL, database, and localStorage when it changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Update URL hash with tab parameter
        const currentHash = window.location.hash;
        // Extract base hash (e.g., #admin) and preserve other params
        const hashParts = currentHash.split('?');
        const baseHash = hashParts[0] || '#admin';
        const existingParams = hashParts[1] ? hashParts[1].split('&').filter(p => !p.startsWith('tab=')) : [];
        const newParams = [`tab=${activeTab}`, ...existingParams].join('&');
        const newHash = `${baseHash}?${newParams}`;

        // Only update if different to prevent unnecessary history entries
        if (currentHash !== newHash) {
            window.history.replaceState({}, '', newHash);
        }

        // Save to database (primary storage)
        if (adminToken && currentUserId) {
            updatePreference(adminToken, 'admin_active_tab', activeTab).catch((err) => {
                console.warn('Failed to save admin active tab to database:', err);
                // Fallback to localStorage on error
                try {
                    localStorage.setItem('admin_active_tab', activeTab);
                } catch (e) {
                    // Ignore localStorage errors
                }
            });
        } else {
            // Fallback to localStorage if no user ID or token
            try {
                localStorage.setItem('admin_active_tab', activeTab);
            } catch (e) {
                // Ignore localStorage errors
            }
        }
    }, [activeTab, adminToken, currentUserId]);

    // Persist expanded categories to database and localStorage when they change
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const categoriesArray = Array.from(expandedCategories);

        // Save to database (primary storage)
        if (adminToken && currentUserId) {
            updatePreference(adminToken, 'admin_expanded_categories', categoriesArray).catch((err) => {
                console.warn('Failed to save admin expanded categories to database:', err);
                // Fallback to localStorage on error
                try {
                    localStorage.setItem('admin_expanded_categories', JSON.stringify(categoriesArray));
                } catch (e) {
                    // Ignore localStorage errors
                }
            });
        } else {
            // Fallback to localStorage if no user ID or token
            try {
                localStorage.setItem('admin_expanded_categories', JSON.stringify(categoriesArray));
            } catch (e) {
                // Ignore localStorage errors
            }
        }
    }, [expandedCategories, adminToken, currentUserId]);

    // Load notifications on mount and periodically
    useEffect(() => {
        if (!adminToken) return;

        loadNotifications();
        const interval = setInterval(loadNotifications, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [adminToken]);

    // Close notifications dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showNotifications && !target.closest('.notifications-container')) {
                setShowNotifications(false);
            }
        };

        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showNotifications]);


    const loadDashboardStats = async () => {
        if (!adminToken || loadingDashboardStatsRef.current) return;
        loadingDashboardStatsRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const stats = await getDashboardStats(adminToken);
            setDashboardStats(stats);
            setBackendError(false);
        } catch (err: any) {
            // Check for connection error
            const isConnectionError = err.message?.includes('Failed to fetch') ||
                err.message?.includes('ERR_CONNECTION_REFUSED') ||
                err.message?.includes('NetworkError') ||
                err.name === 'TypeError';

            if (isConnectionError) {
                setBackendError(true);
                setError('Cannot connect to backend server. Please ensure it is running.');
                // Don't log connection errors to console to verify cleanliness
            } else {
                setError(err.message || 'Failed to load dashboard statistics');
                console.error('Failed to load dashboard stats:', err);
            }
        } finally {
            setLoading(false);
            loadingDashboardStatsRef.current = false;
        }
    };

    const loadUsers = async (page = 1) => {
        if (!adminToken) return;
        setLoading(true);
        setError(null);
        try {
            const response = await getUsers(adminToken, {
                page,
                limit: 20,
                search: searchTerm || undefined
            });
            setUsers(response.users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: (u.role || 'user') as 'user' | 'admin' | 'superadmin' | 'editor',
                status: (u.isActive ? 'Active' : 'Inactive') as 'Active' | 'Inactive' | 'Banned',
                lastLogin: u.lastLogin ? new Date(u.lastLogin).getTime() : Date.now() - 999999999,
                plan: u.plan
            })));
            setCurrentPage(response.pagination.page);
            setTotalPages(response.pagination.pages);
            setBackendError(false);
        } catch (err: any) {
            const isConnectionError = err.message?.includes('Failed to fetch') ||
                err.message?.includes('ERR_CONNECTION_REFUSED');

            if (isConnectionError) {
                setBackendError(true);
                // Silent error for users load if likely backend issue
            } else {
                setError(err.message || 'Failed to load users');
                console.error('Failed to load users:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    // Load LLM activity for a specific project
    const loadProjectLLMActivity = useCallback(async (projectId: string) => {
        if (!adminToken) return;
        try {
            const stats = await getUsageStats(adminToken, { projectId });
            setProjectLLMActivities(prev => ({ ...prev, [projectId]: stats }));
            return stats;
        } catch (err: any) {
            console.error(`Failed to load LLM activity for project ${projectId}:`, err);
            return null;
        }
    }, [adminToken]);

    // Load LLM activities for all projects
    const loadAllProjectsLLMActivity = useCallback(async (projectIds: string[]) => {
        if (!adminToken || projectIds.length === 0) return;
        try {
            // Load in batches to avoid overwhelming the API
            const batchSize = 5;
            for (let i = 0; i < projectIds.length; i += batchSize) {
                const batch = projectIds.slice(i, i + batchSize);
                await Promise.allSettled(
                    batch.map(projectId => loadProjectLLMActivity(projectId))
                );
            }
        } catch (err: any) {
            console.error('Failed to load projects LLM activities:', err);
        }
    }, [adminToken, loadProjectLLMActivity]);

    const loadProjects = async (page = 1) => {
        if (!adminToken) return;
        setLoading(true);
        setError(null);
        try {
            const response = await getProjects(adminToken, {
                page,
                limit: 20,
                search: searchTerm || undefined
            });
            const projectsList = response.projects.map((p: AdminProject) => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                lastModified: new Date(p.lastModified).getTime(),
                phase: p.currentPhase,
                isSample: p.isSample || false
            }));
            setProjects(projectsList);
            setCurrentPage(response.pagination.page);
            setTotalPages(response.pagination.pages);
            setBackendError(false);

            // Load LLM activities for all projects
            await loadAllProjectsLLMActivity(projectsList.map(p => p.id));
        } catch (err: any) {
            const isConnectionError = err.message?.includes('Failed to fetch') ||
                err.message?.includes('ERR_CONNECTION_REFUSED');

            if (isConnectionError) {
                setBackendError(true);
            } else {
                setError(err.message || 'Failed to load projects');
                console.error('Failed to load projects:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!(await showConfirm('Are you sure you want to force delete this project? This action involves data loss.'))) {
            return;
        }
        if (!adminToken) return;

        setLoading(true);
        try {
            await deleteProject(adminToken, id);
            clearProjectCaches(); // Clear caches for immediate effect
            setProjects(projects.filter(p => p.id !== id));
            await loadDashboardStats(); // Refresh dashboard stats
        } catch (err: any) {
            setError(err.message || 'Failed to delete project');
            showAlert(`Failed to delete project: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSampleProject = async (projectId: string, isCurrentlySample: boolean) => {
        if (!adminToken) return;

        const action = isCurrentlySample ? 'remove from' : 'add to';
        if (!(await showConfirm(`Are you sure you want to ${action} sample projects?`))) return;

        setLoading(true);
        try {
            if (isCurrentlySample) {
                await unmarkProjectAsSample(adminToken, projectId);
                showAlert('Project removed from sample projects');
            } else {
                await markProjectAsSample(adminToken, projectId);
                toast.success('Project added to sample projects');
            }
            clearProjectCaches(); // Clear caches for immediate effect
            await loadProjects(currentPage);
            await loadDashboardStats(); // Refresh dashboard stats
        } catch (err: any) {
            setError(err.message || `Failed to ${action} sample projects`);
            toast.error(`Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBanUser = async (id: string) => {
        if (!adminToken) return;

        // Check feature flag
        if (!canManageUsers) {
            toast.warning('User management is not enabled for your role');
            return;
        }

        const user = users.find(u => u.id === id);
        if (!user) return;

        const newStatus = user.status === 'Banned' ? true : false;

        setLoading(true);
        try {
            await updateUser(adminToken, id, { isActive: newStatus });
            clearUserCaches(); // Clear caches for immediate effect
            await loadUsers(currentPage); // Reload users
            await loadDashboardStats(); // Refresh dashboard stats
        } catch (err: any) {
            setError(err.message || 'Failed to update user');
            toast.error(`Failed to update user: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (!adminToken) return;

        // Check feature flag
        if (!canManageUsers) {
            setError('User management is not enabled for your role');
            return;
        }

        if (!newUserData.email || !newUserData.password || !newUserData.name) {
            setError('Email, password, and name are required');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const newUser = await createUser(adminToken, newUserData);
            clearUserCaches(); // Clear caches for immediate effect
            await loadUsers(1); // Reload users
            await loadDashboardStats(); // Refresh dashboard stats
            setShowAddUserModal(false);
            setNewUserData({ email: '', password: '', name: '', plan: 'Free', role: 'user' });
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!adminToken) return;

        // Check feature flag
        if (!canManageUsers) {
            toast.warning('User management is not enabled for your role');
            return;
        }

        if (!(await showConfirm('Are you sure you want to delete this user? This will also delete all their projects. This action cannot be undone.'))) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await deleteUser(adminToken, id);
            clearUserCaches(); // Clear caches for immediate effect
            await loadUsers(currentPage); // Reload users
            await loadDashboardStats(); // Refresh dashboard stats
        } catch (err: any) {
            setError(err.message || 'Failed to delete user');
            toast.error(`Failed to delete user: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Notification functions
    const loadNotifications = async () => {
        if (!adminToken || loadingNotificationsRef.current) return;
        loadingNotificationsRef.current = true;

        try {
            setLoadingNotifications(true);
            const data = await getNotifications(adminToken, { limit: 20 });
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (err: any) {
            const isConnectionError = err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CONNECTION_REFUSED');
            if (!isConnectionError && import.meta.env.DEV) {
                console.debug('Failed to load notifications:', err);
            }
        } finally {
            setLoadingNotifications(false);
            loadingNotificationsRef.current = false;
        }
    };

    const handleMarkAsRead = async (notificationId: string) => {
        if (!adminToken) return;

        try {
            await markNotificationAsRead(adminToken, notificationId);
            setNotifications(notifications.map(n =>
                n.id === notificationId ? { ...n, isRead: true } : n
            ));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (err: any) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!adminToken) return;

        try {
            await markAllNotificationsAsRead(adminToken);
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err: any) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        if (!adminToken) return;

        try {
            await deleteNotification(adminToken, notificationId);
            const notification = notifications.find(n => n.id === notificationId);
            setNotifications(notifications.filter(n => n.id !== notificationId));
            if (notification && !notification.isRead) {
                setUnreadCount(Math.max(0, unreadCount - 1));
            }
        } catch (err: any) {
            console.error('Failed to delete notification:', err);
        }
    };

    useEffect(() => {
        // Reload when search term changes
        if (activeTab === 'user-feature-access') {
            // Component handles its own loading
        }
    }, [searchTerm]);

    // Load packages
    const loadPackages = async () => {
        if (!adminToken) return;
        setLoading(true);
        setError(null);
        try {
            const packagesList = await getPackages(adminToken);
            setPackages(packagesList);
        } catch (err: any) {
            setError(err.message || 'Failed to load packages');
            console.error('Failed to load packages:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load audit logs
    const loadAuditLogs = async (page = 1) => {
        if (!adminToken) return;
        setLoading(true);
        setError(null);
        try {
            const response = await getAuditLogs(adminToken, { page, limit: 50 });
            setAuditLogs(response.logs);
        } catch (err: any) {
            setError(err.message || 'Failed to load audit logs');
            console.error('Failed to load audit logs:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load financial data
    const loadFinancialData = async () => {
        if (!adminToken) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getFinancialDashboard(adminToken);
            setFinancialData(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load financial data');
            console.error('Failed to load financial data:', err);
        } finally {
            setLoading(false);
        }
    };


    // Export functions - Protected by export_data flag
    const handleExport = async (type: 'users' | 'projects', format: 'csv' | 'json') => {
        if (!adminToken) return;

        // Check feature flag
        if (!canExportData) {
            toast.warning('Export data feature is not enabled for your role. Contact a superadmin to enable this feature.');
            return;
        }

        setLoading(true);
        try {
            const blob = type === 'users'
                ? await exportUsers(adminToken, format)
                : await exportProjects(adminToken, format);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}-export.${format === 'csv' ? 'csv' : 'json'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setShowExportMenu(null);
        } catch (err: any) {
            setError(err.message || `Failed to export ${type}`);
            alert(`Failed to export: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Bulk action handlers
    const handleBulkUserAction = async (action: 'activate' | 'deactivate' | 'delete' | 'changePlan', plan?: string) => {
        if (!adminToken || selectedUsers.size === 0) return;

        // Check feature flag
        if (!canManageUsers) {
            toast.warning('User management is not enabled for your role');
            return;
        }

        if (!(await showConfirm(`Are you sure you want to ${action} ${selectedUsers.size} user(s)?`))) return;

        setLoading(true);
        try {
            await bulkUserAction(adminToken, action, Array.from(selectedUsers), plan ? { plan } : undefined);
            clearUserCaches(); // Clear caches for immediate effect
            setSelectedUsers(new Set());
            await loadUsers(currentPage);
            await loadDashboardStats(); // Refresh dashboard stats
            toast.success(`Successfully ${action}ed ${selectedUsers.size} user(s)`);
        } catch (err: any) {
            setError(err.message || `Failed to ${action} users`);
            toast.error(`Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBulkProjectAction = async (action: 'delete' | 'archive') => {
        if (!adminToken || selectedProjects.size === 0) return;
        if (!(await showConfirm(`Are you sure you want to ${action} ${selectedProjects.size} project(s)?`))) return;

        setLoading(true);
        try {
            await bulkProjectAction(adminToken, action, Array.from(selectedProjects));
            clearProjectCaches(); // Clear caches for immediate effect
            setSelectedProjects(new Set());
            await loadDashboardStats(); // Refresh dashboard stats
            await loadProjects(currentPage);
            toast.success(`Successfully ${action}ed ${selectedProjects.size} project(s)`);
        } catch (err: any) {
            setError(err.message || `Failed to ${action} projects`);
            toast.error(`Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Enhanced filtering and sorting
    const filteredUsers = users
        .filter(u => {
            // Search filter
            const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase());

            // Role filter
            const matchesRole = userFilters.role === 'all' || (u.role || 'user') === userFilters.role;

            // Plan filter
            const matchesPlan = userFilters.plan === 'all' || u.plan.toLowerCase() === userFilters.plan.toLowerCase();

            // Status filter
            const matchesStatus = userFilters.status === 'all' || u.status.toLowerCase() === userFilters.status.toLowerCase();

            return matchesSearch && matchesRole && matchesPlan && matchesStatus;
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (userSortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'email':
                    comparison = a.email.localeCompare(b.email);
                    break;
                case 'lastLogin':
                    comparison = b.lastLogin - a.lastLogin;
                    break;
                case 'plan':
                    const planOrder = { 'Enterprise': 3, 'Pro': 2, 'Free': 1 };
                    comparison = (planOrder[b.plan] || 0) - (planOrder[a.plan] || 0);
                    break;
            }
            return userSortOrder === 'asc' ? comparison : -comparison;
        });

    const userStats = {
        total: users.length,
        active: users.filter(u => u.status === 'Active').length,
        inactive: users.filter(u => u.status === 'Inactive').length,
        banned: users.filter(u => u.status === 'Banned').length,
        byPlan: {
            Free: users.filter(u => u.plan === 'Free').length,
            Pro: users.filter(u => u.plan === 'Pro').length,
            Enterprise: users.filter(u => u.plan === 'Enterprise').length
        }
    };

    const StatCard = ({ label, value, trend, icon: Icon, color }: any) => (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
                <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
                    <TrendingUp size={12} className={trend.startsWith('-') ? 'rotate-180' : ''} />
                    {trend} vs last month
                </div>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex font-sans text-slate-600">
            {/* Backend Unavailable Banner */}
            {backendError && (
                <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white px-4 py-2 text-center text-sm font-medium shadow-md">
                    <div className="flex items-center justify-center gap-2">
                        <AlertTriangle size={16} />
                        <span>Backend Unreachable: Some features may not work. Please ensure the server is running on port 3002.</span>
                        <button
                            onClick={() => {
                                setBackendError(false);
                                loadDashboardStats();
                            }}
                            className="ml-4 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-all duration-300">
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-white font-bold tracking-tight">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Lock size={16} />
                        </div>
                        <span>AdminPortal</span>
                    </div>
                </div>

                <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Main Menu</div>

                    {/* Overview - Standalone */}
                    <button
                        onClick={() => {
                            setActiveTab('overview');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <Activity size={18} />
                        Overview
                    </button>

                    {/* Live Activity - Standalone */}
                    <button
                        onClick={() => {
                            setActiveTab('live-activity');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'live-activity'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <Zap size={18} />
                        Live Activity
                    </button>

                    {/* Users & Access Category */}
                    {canManageUsers && !userManagementLoading && (() => {
                        const isExpanded = expandedCategories.has('users-access');
                        const hasActive = activeTab === 'user-feature-access' || activeTab === 'security';
                        return (
                            <div>
                                <button
                                    onClick={() => setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has('users-access')) next.delete('users-access');
                                        else next.add('users-access');
                                        return next;
                                    })}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${hasActive
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 hover:text-white text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Shield size={18} />
                                        <span>Users & Access</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {[
                                            { id: 'user-feature-access', label: 'User & Feature Access', icon: Shield },
                                            { id: 'security', label: 'Security', icon: Shield },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                                                    }`}
                                            >
                                                <item.icon size={16} />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* LLM & AI Category */}
                    {(() => {
                        const isExpanded = expandedCategories.has('llm-ai');
                        const hasActive = activeTab === 'llm-model-management' || activeTab === 'ai-agents' || activeTab === 'process-management';
                        return (
                            <div>
                                <button
                                    onClick={() => setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has('llm-ai')) next.delete('llm-ai');
                                        else next.add('llm-ai');
                                        return next;
                                    })}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${hasActive
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 hover:text-white text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Brain size={18} />
                                        <span>LLM & AI</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {[
                                            { id: 'llm-model-management', label: 'LLM Models', icon: Brain },
                                            { id: 'ai-agents', label: 'AI Agents', icon: Bot },
                                            { id: 'process-management', label: 'Process Management', icon: Workflow },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                                                    }`}
                                            >
                                                <item.icon size={16} />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* System & Operations Category */}
                    {(() => {
                        const isExpanded = expandedCategories.has('system-ops');
                        const hasActive = activeTab === 'settings' || activeTab === 'database' || activeTab === 'backups' || activeTab === 'performance-monitoring' || activeTab === 'integrations' || activeTab === 'cloud-deployment' || activeTab === 'rate-limiting' || activeTab === 'alerts' || activeTab === 'system-audit-logs';
                        return (
                            <div>
                                <button
                                    onClick={() => setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has('system-ops')) next.delete('system-ops');
                                        else next.add('system-ops');
                                        return next;
                                    })}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${hasActive
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 hover:text-white text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Database size={18} />
                                        <span>System & Operations</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {[
                                            { id: 'settings', label: 'System Settings', icon: Settings },
                                            { id: 'database', label: 'Database Manager', icon: Database },
                                            { id: 'backups', label: 'Backups', icon: Database },
                                            { id: 'performance-monitoring', label: 'Performance & Monitoring', icon: Activity },
                                            { id: 'integrations', label: 'Integrations', icon: Wifi },
                                            { id: 'cloud-deployment', label: 'Cloud Deployment', icon: Cloud },
                                            { id: 'rate-limiting', label: 'Rate Limiting', icon: Lock },
                                            { id: 'alerts', label: 'Alerts', icon: Bell },
                                            canViewAuditLogs && { id: 'system-audit-logs', label: 'System Audit Logs', icon: FileText },
                                        ].filter(Boolean).map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                                                    }`}
                                            >
                                                <item.icon size={16} />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Business & Analytics Category */}
                    {(canViewFinancialDashboard || canManagePackages || canViewAnalyticsDashboard) && (() => {
                        const isExpanded = expandedCategories.has('business-analytics');
                        const hasActive = activeTab === 'financials' || activeTab === 'packages' || activeTab === 'analytics' || activeTab === 'reports';
                        return (
                            <div>
                                <button
                                    onClick={() => setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has('business-analytics')) next.delete('business-analytics');
                                        else next.add('business-analytics');
                                        return next;
                                    })}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${hasActive
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 hover:text-white text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <DollarSign size={18} />
                                        <span>Business & Analytics</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {[
                                            canViewFinancialDashboard && { id: 'financials', label: 'Financials', icon: DollarSign },
                                            canManagePackages && { id: 'packages', label: 'Packages', icon: PackageIcon },
                                            canViewAnalyticsDashboard && { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                                            { id: 'reports', label: 'Reports', icon: FileText },
                                        ].filter(Boolean).map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                                                    }`}
                                            >
                                                <item.icon size={16} />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Customer Support Category */}
                    {(() => {
                        const isExpanded = expandedCategories.has('customer-support');
                        const hasActive = activeTab === 'support-tickets' || activeTab === 'support-chat' || activeTab === 'support-templates';
                        return (
                            <div>
                                <button
                                    onClick={() => setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has('customer-support')) next.delete('customer-support');
                                        else next.add('customer-support');
                                        return next;
                                    })}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${hasActive
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 hover:text-white text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Headphones size={18} />
                                        <span>Customer Support</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {[
                                            { id: 'support-tickets', label: 'Support Tickets', icon: Ticket },
                                            { id: 'support-chat', label: 'Live Chat', icon: MessageCircle },
                                            { id: 'support-templates', label: 'Response Templates', icon: FileText },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                                                    }`}
                                            >
                                                <item.icon size={16} />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Content Category */}
                    {(() => {
                        const isExpanded = expandedCategories.has('content');
                        const hasActive = activeTab === 'page-editor' || activeTab === 'moderation';
                        return (
                            <div>
                                <button
                                    onClick={() => setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        if (next.has('content')) next.delete('content');
                                        else next.add('content');
                                        return next;
                                    })}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${hasActive
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'hover:bg-slate-800 hover:text-white text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Edit size={18} />
                                        <span>Content</span>
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {[
                                            { id: 'page-editor', label: 'Page Editor', icon: Edit },
                                            { id: 'moderation', label: 'Content Moderation', icon: Shield },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === item.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                                                    }`}
                                            >
                                                <item.icon size={16} />
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Developer Tools removed - these are end-user features, not admin features */}
                </div>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={onExit}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                        <LogOut size={14} /> Exit Admin
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Header */}
                <header className="bg-white border-b border-slate-200 shrink-0">
                    <div className="min-h-16 py-4 flex items-center justify-between px-8">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <h1 className="text-xl font-bold text-slate-800 capitalize">
                                {activeTab === 'system-audit-logs' ? 'System Audit Logs' :
                                    activeTab === 'live-activity' ? 'Live Activity' :
                                        activeTab === 'user-feature-access' ? 'User & Feature Access' :
                                            activeTab === 'llm-router-settings' ? 'End User Router Settings' :
                                                activeTab === 'internal-router-settings' ? 'Internal LLM Router' :
                                                    activeTab === 'llm-model-management' ? 'Model Management' :
                                                        activeTab === 'performance-monitoring' ? 'Performance & Monitoring' :
                                                            activeTab === 'page-editor' ? 'Page Editor' :
                                                                activeTab.replace(/-/g, ' ')}
                            </h1>
                            {SECTION_DESCRIPTIONS[activeTab] && (
                                <p className="text-sm text-slate-500 max-w-3xl">
                                    {SECTION_DESCRIPTIONS[activeTab].description}
                                </p>
                            )}
                        </div>

                        {/* Right side: Backend Connection Status, Search, Notifications, Profile */}
                        <div className="flex items-center gap-4 shrink-0">
                            {/* Backend Connection Status Indicator */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 shrink-0">
                                {backendConnection.isChecking ? (
                                    <>
                                        <Loader2 size={14} className="text-slate-400 animate-spin" />
                                        <span className="text-xs font-medium text-slate-500">Checking...</span>
                                    </>
                                ) : backendConnection.isConnected ? (
                                    <>
                                        <Wifi size={14} className="text-emerald-600" />
                                        <span className="text-xs font-medium text-emerald-700">Connected</span>
                                        {backendConnection.latency !== null && (
                                            <span className="text-xs text-slate-500">
                                                ({backendConnection.latency}ms)
                                            </span>
                                        )}
                                        {backendConnection.uptime !== null && (
                                            <span className="text-xs text-slate-500 ml-1">
                                                • {Math.floor(backendConnection.uptime / 3600)}h uptime
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <WifiOff size={14} className="text-red-600" />
                                        <span className="text-xs font-medium text-red-700">Disconnected</span>
                                        {backendConnection.error && (
                                            <span className="text-xs text-red-600 ml-1" title={backendConnection.error}>
                                                ({backendConnection.error.substring(0, 20)}...)
                                            </span>
                                        )}
                                    </>
                                )}
                                <button
                                    onClick={backendConnection.refresh}
                                    className="ml-2 p-1 hover:bg-slate-200 rounded transition-colors"
                                    title="Refresh connection status"
                                >
                                    <RefreshCw size={12} className={`text-slate-500 ${backendConnection.isChecking ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Notifications */}
                            <div className="relative notifications-container">
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <Bell size={20} />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Notifications Dropdown */}
                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-[200] max-h-[600px] flex flex-col">
                                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                                            <h3 className="font-bold text-slate-800">Notifications</h3>
                                            <div className="flex items-center gap-2">
                                                {unreadCount > 0 && (
                                                    <button
                                                        onClick={handleMarkAllAsRead}
                                                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                                                    >
                                                        Mark all read
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setShowNotifications(false)}
                                                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto">
                                            {loadingNotifications ? (
                                                <div className="p-8 text-center">
                                                    <Loader2 size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                                                    <p className="text-sm text-slate-500">Loading notifications...</p>
                                                </div>
                                            ) : notifications.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400">
                                                    <Bell size={32} className="mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">No notifications</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-slate-100">
                                                    {notifications.map((notification) => (
                                                        <div
                                                            key={notification.id}
                                                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-blue-50/50' : ''
                                                                }`}
                                                            onClick={() => {
                                                                if (!notification.isRead) {
                                                                    handleMarkAsRead(notification.id);
                                                                }
                                                                if (notification.link) {
                                                                    // Navigate to link if provided
                                                                    window.location.href = notification.link;
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className={`w-2 h-2 rounded-full mt-2 ${notification.type === 'error' ? 'bg-red-500' :
                                                                    notification.type === 'warning' ? 'bg-yellow-500' :
                                                                        notification.type === 'success' ? 'bg-green-500' :
                                                                            'bg-blue-500'
                                                                    } ${!notification.isRead ? '' : 'opacity-0'}`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <h4 className="font-semibold text-slate-800 text-sm">
                                                                            {notification.title}
                                                                        </h4>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteNotification(notification.id);
                                                                            }}
                                                                            className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400 hover:text-red-600"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    </div>
                                                                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                                                        {notification.message}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-400 mt-2">
                                                                        {new Date(notification.createdAt).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Profile Picture */}
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                                <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Admin" alt="Admin" />
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-8">

                    {/* Error Display */}
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="flex items-center gap-3 text-slate-600">
                                <Loader2 size={24} className="animate-spin" />
                                <span className="font-medium">Loading...</span>
                            </div>
                        </div>
                    )}

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <EnhancedOverview token={adminToken || ''} />
                        </div>
                    )}

                    {/* LIVE ACTIVITY TAB */}
                    {activeTab === 'live-activity' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <LiveActivityTab token={adminToken || ''} />
                        </div>
                    )}

                    {/* OLD OVERVIEW - KEPT FOR REFERENCE */}
                    {false && activeTab === 'overview-old' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {dashboardStats ? (
                                    <>
                                        <StatCard
                                            label="Total Users"
                                            value={dashboardStats.stats.totalUsers.toString()}
                                            trend={`${dashboardStats.stats.activeUsers} active`}
                                            icon={Users}
                                            color="bg-blue-500"
                                        />
                                        <StatCard
                                            label="Active Users"
                                            value={dashboardStats.stats.activeUsers.toString()}
                                            trend={`${dashboardStats.stats.totalUsers > 0 ? Math.round((dashboardStats.stats.activeUsers / dashboardStats.stats.totalUsers) * 100) : 0}% of total`}
                                            icon={Activity}
                                            color="bg-emerald-500"
                                        />
                                        <StatCard
                                            label="Total Projects"
                                            value={dashboardStats.stats.totalProjects.toString()}
                                            trend={`${dashboardStats.stats.activeProjects} active`}
                                            icon={Database}
                                            color="bg-purple-500"
                                        />
                                        <StatCard
                                            label="Active Projects"
                                            value={dashboardStats.stats.activeProjects.toString()}
                                            trend={`${dashboardStats.stats.totalProjects > 0 ? Math.round((dashboardStats.stats.activeProjects / dashboardStats.stats.totalProjects) * 100) : 0}% of total`}
                                            icon={LayoutGrid}
                                            color="bg-indigo-500"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <StatCard label="Loading..." value="--" trend="--" icon={Users} color="bg-slate-400" />
                                        <StatCard label="Loading..." value="--" trend="--" icon={Activity} color="bg-slate-400" />
                                        <StatCard label="Loading..." value="--" trend="--" icon={Database} color="bg-slate-400" />
                                        <StatCard label="Loading..." value="--" trend="--" icon={LayoutGrid} color="bg-slate-400" />
                                    </>
                                )}
                            </div>

                            {/* Live Metrics Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Live LLM Usage */}
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl border border-purple-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Brain size={20} className="text-purple-600" />
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Live LLM Usage</h3>
                                        </div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="Live"></div>
                                    </div>
                                    {liveLLMUsage ? (
                                        <>
                                            <div className="text-2xl font-bold text-slate-800 mb-1">{liveLLMUsage.calls}</div>
                                            <div className="text-xs text-slate-500 mb-3">Calls (last 5 min)</div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Rate:</span>
                                                    <span className="font-bold text-purple-600">{liveLLMUsage.rate.toFixed(1)}/min</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Tokens:</span>
                                                    <span className="font-bold text-slate-800">{liveLLMUsage.tokens.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Cost:</span>
                                                    <span className="font-bold text-emerald-600">${liveLLMUsage.cost.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-slate-400 text-sm">Loading...</div>
                                    )}
                                </div>

                                {/* Today's LLM Stats */}
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Activity size={20} className="text-blue-600" />
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Today's Stats</h3>
                                        </div>
                                    </div>
                                    {todayLLMStats ? (
                                        <>
                                            <div className="text-2xl font-bold text-slate-800 mb-1">{todayLLMStats.totalCalls}</div>
                                            <div className="text-xs text-slate-500 mb-3">Total Calls</div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Tokens:</span>
                                                    <span className="font-bold text-blue-600">{todayLLMStats.totalTokens.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Cost:</span>
                                                    <span className="font-bold text-emerald-600">${todayLLMStats.totalCost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-slate-400 text-sm">Loading...</div>
                                    )}
                                </div>

                                {/* Growth Metrics */}
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={20} className="text-emerald-600" />
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Growth</h3>
                                        </div>
                                    </div>
                                    {analyticsOverview ? (
                                        <>
                                            <div className="text-2xl font-bold text-slate-800 mb-1">+{analyticsOverview.users?.last7Days || 0}</div>
                                            <div className="text-xs text-slate-500 mb-3">New Users (7d)</div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Users (30d):</span>
                                                    <span className="font-bold text-emerald-600">+{analyticsOverview.users?.last30Days || 0}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Projects (7d):</span>
                                                    <span className="font-bold text-blue-600">+{analyticsOverview.projects?.last7Days || 0}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Active (7d):</span>
                                                    <span className="font-bold text-purple-600">{analyticsOverview.users?.active7d || 0}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-slate-400 text-sm">Loading...</div>
                                    )}
                                </div>

                                {/* Activity Stats */}
                                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Activity size={20} className="text-orange-600" />
                                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Activity</h3>
                                        </div>
                                    </div>
                                    {activityStats ? (
                                        <>
                                            <div className="text-2xl font-bold text-slate-800 mb-1">{activityStats.last24Hours || 0}</div>
                                            <div className="text-xs text-slate-500 mb-3">Events (24h)</div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Last 7d:</span>
                                                    <span className="font-bold text-orange-600">{activityStats.last7Days || 0}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-600">Last 30d:</span>
                                                    <span className="font-bold text-slate-800">{activityStats.last30Days || 0}</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-slate-400 text-sm">Loading...</div>
                                    )}
                                </div>
                            </div>

                            {/* Recent Activity Feed */}
                            {recentActivity.length > 0 && (
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Activity size={18} />
                                            Recent Activity
                                        </h3>
                                        <span className="text-xs text-slate-500">Last updated: {lastUpdate.toLocaleTimeString()}</span>
                                    </div>
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {recentActivity.slice(0, 10).map((event: any, idx: number) => (
                                            <div key={event.id || idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium text-slate-800">{event.type || 'Activity'}</span>
                                                        <span className="text-xs text-slate-500">
                                                            {new Date(event.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    {event.userEmail && (
                                                        <div className="text-xs text-slate-600 mb-1">User: {event.userEmail}</div>
                                                    )}
                                                    {event.details && (
                                                        <div className="text-xs text-slate-500 truncate">{JSON.stringify(event.details)}</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Project LLM Activities Summary */}
                            {projects.length > 0 && (
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Brain size={18} />
                                            Project LLM Activities
                                        </h3>
                                        <span className="text-xs text-slate-500">{projects.length} projects</span>
                                    </div>
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {projects.slice(0, 10).map((project) => {
                                            const llmActivity = projectLLMActivities[project.id];
                                            return (
                                                <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-medium text-slate-800 truncate">{project.name}</span>
                                                            {project.isSample && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Sample</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500">Phase: {project.phase}</div>
                                                    </div>
                                                    <div className="flex items-center gap-4 ml-4">
                                                        {llmActivity ? (
                                                            <>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-medium text-slate-600">{llmActivity.totalCalls}</div>
                                                                    <div className="text-[10px] text-slate-500">Calls</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-medium text-slate-600">{llmActivity.totalTokens.toLocaleString()}</div>
                                                                    <div className="text-[10px] text-slate-500">Tokens</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-medium text-emerald-600">${llmActivity.totalCost.toFixed(2)}</div>
                                                                    <div className="text-[10px] text-slate-500">Cost</div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-xs text-slate-400">Loading...</div>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProjectId(project.id);
                                                                if (projectLLMActivities[project.id]) {
                                                                    setProjectLLMDetails(projectLLMActivities[project.id]);
                                                                } else {
                                                                    loadProjectLLMActivity(project.id).then(stats => {
                                                                        if (stats) setProjectLLMDetails(stats);
                                                                    });
                                                                }
                                                            }}
                                                            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                        >
                                                            View Details
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Project LLM Activities Summary */}
                            {projects.length > 0 && (
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Brain size={18} />
                                            Project LLM Activities
                                        </h3>
                                        <span className="text-xs text-slate-500">{projects.length} projects</span>
                                    </div>
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {projects.slice(0, 10).map((project) => {
                                            const llmActivity = projectLLMActivities[project.id];
                                            return (
                                                <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-medium text-slate-800 truncate">{project.name}</span>
                                                            {project.isSample && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Sample</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500">Phase: {project.phase}</div>
                                                    </div>
                                                    <div className="flex items-center gap-4 ml-4">
                                                        {llmActivity ? (
                                                            <>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-medium text-slate-600">{llmActivity.totalCalls}</div>
                                                                    <div className="text-[10px] text-slate-500">Calls</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-medium text-slate-600">{llmActivity.totalTokens.toLocaleString()}</div>
                                                                    <div className="text-[10px] text-slate-500">Tokens</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-xs font-medium text-emerald-600">${llmActivity.totalCost.toFixed(2)}</div>
                                                                    <div className="text-[10px] text-slate-500">Cost</div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-xs text-slate-400">Loading...</div>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProjectId(project.id);
                                                                if (projectLLMActivities[project.id]) {
                                                                    setProjectLLMDetails(projectLLMActivities[project.id]);
                                                                } else {
                                                                    loadProjectLLMActivity(project.id).then(stats => {
                                                                        if (stats) setProjectLLMDetails(stats);
                                                                    });
                                                                }
                                                            }}
                                                            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                        >
                                                            View Details
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Quick Links to Detailed Sections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    onClick={() => setActiveTab('finance')}
                                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <DollarSign size={24} className="text-emerald-600" />
                                        <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 mb-1">Financial Dashboard</h3>
                                    <p className="text-sm text-slate-500">View revenue, MRR, ARR, and growth metrics</p>
                                </button>

                                <button
                                    onClick={() => setActiveTab('analytics')}
                                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <Brain size={24} className="text-purple-600" />
                                        <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 mb-1">Analytics</h3>
                                    <p className="text-sm text-slate-500">View platform analytics, user insights, and LLM metrics</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* USER & FEATURE ACCESS TAB */}
                    {activeTab === 'user-feature-access' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <UserAndFeatureAccessManager token={adminToken} />
                        </div>
                    )}

                    {/* OLD USERS TAB - REMOVED */}
                    {false && activeTab === 'users' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {!canManageUsers && !userManagementLoading && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                                    <AlertTriangle size={32} className="mx-auto mb-2 text-yellow-600" />
                                    <h3 className="font-bold text-yellow-800 mb-1">User Management Disabled</h3>
                                    <p className="text-sm text-yellow-700">
                                        The user_management feature is not enabled for your role. Contact a superadmin to enable this feature.
                                    </p>
                                </div>
                            )}
                            {canManageUsers && (
                                <>
                                    {/* User Statistics Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Users</div>
                                            <div className="text-2xl font-bold text-slate-800">{userStats.total}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Active</div>
                                            <div className="text-2xl font-bold text-emerald-600">{userStats.active}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Inactive</div>
                                            <div className="text-2xl font-bold text-slate-400">{userStats.inactive}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Banned</div>
                                            <div className="text-2xl font-bold text-red-600">{userStats.banned}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Free Plan</div>
                                            <div className="text-2xl font-bold text-slate-600">{userStats.byPlan.Free}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Pro Plan</div>
                                            <div className="text-2xl font-bold text-blue-600">{userStats.byPlan.Pro}</div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Enterprise</div>
                                            <div className="text-2xl font-bold text-purple-600">{userStats.byPlan.Enterprise}</div>
                                        </div>
                                    </div>

                                    {/* Bulk Actions Toolbar */}
                                    {selectedUsers.size > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                                            <span className="text-sm font-medium text-blue-800">
                                                {selectedUsers.size} user(s) selected
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleBulkUserAction('activate')}
                                                    className="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-bold hover:bg-emerald-600 transition-colors"
                                                >
                                                    Activate
                                                </button>
                                                <button
                                                    onClick={() => handleBulkUserAction('deactivate')}
                                                    className="px-3 py-1.5 bg-slate-500 text-white rounded text-xs font-bold hover:bg-slate-600 transition-colors"
                                                >
                                                    Deactivate
                                                </button>
                                                <button
                                                    onClick={() => handleBulkUserAction('delete')}
                                                    className="px-3 py-1.5 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    onClick={() => setSelectedUsers(new Set())}
                                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-xs font-bold hover:bg-slate-300 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-slate-800">User Directory</h3>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setShowAddUserModal(true)}
                                                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                                    >
                                                        <Users size={14} /> Add User
                                                    </button>
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search users..."
                                                            value={searchTerm}
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                            className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setShowExportMenu(showExportMenu === 'users' ? null : 'users')}
                                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                                                        >
                                                            <Download size={14} /> Export
                                                        </button>
                                                        {showExportMenu === 'users' && (
                                                            <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                                                <button
                                                                    onClick={() => handleExport('users', 'csv')}
                                                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-t-lg"
                                                                >
                                                                    Export CSV
                                                                </button>
                                                                <button
                                                                    onClick={() => handleExport('users', 'json')}
                                                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-b-lg"
                                                                >
                                                                    Export JSON
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Filters and Sort */}
                                            <div className="flex flex-wrap items-center gap-3">
                                                {/* Role Filter */}
                                                <select
                                                    value={userFilters.role}
                                                    onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value })}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="all">All Roles</option>
                                                    <option value="user">User</option>
                                                    <option value="editor">Editor</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="superadmin">Super Admin</option>
                                                </select>

                                                {/* Plan Filter */}
                                                <select
                                                    value={userFilters.plan}
                                                    onChange={(e) => setUserFilters({ ...userFilters, plan: e.target.value })}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="all">All Plans</option>
                                                    <option value="free">Free</option>
                                                    <option value="pro">Pro</option>
                                                    <option value="enterprise">Enterprise</option>
                                                </select>

                                                {/* Status Filter */}
                                                <select
                                                    value={userFilters.status}
                                                    onChange={(e) => setUserFilters({ ...userFilters, status: e.target.value })}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="all">All Status</option>
                                                    <option value="active">Active</option>
                                                    <option value="inactive">Inactive</option>
                                                    <option value="banned">Banned</option>
                                                </select>

                                                {/* Sort By */}
                                                <select
                                                    value={userSortBy}
                                                    onChange={(e) => setUserSortBy(e.target.value as any)}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="name">Sort by Name</option>
                                                    <option value="email">Sort by Email</option>
                                                    <option value="lastLogin">Sort by Last Login</option>
                                                    <option value="plan">Sort by Plan</option>
                                                </select>

                                                {/* Sort Order */}
                                                <button
                                                    onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-sm transition-colors"
                                                    title={userSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                                >
                                                    {userSortOrder === 'asc' ? '↑' : '↓'}
                                                </button>

                                                {/* Clear Filters */}
                                                {(userFilters.role !== 'all' || userFilters.plan !== 'all' || userFilters.status !== 'all') && (
                                                    <button
                                                        onClick={() => setUserFilters({ role: 'all', plan: 'all', status: 'all' })}
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-sm transition-colors flex items-center gap-1"
                                                    >
                                                        <X size={14} /> Clear Filters
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                                                <tr>
                                                    <th className="p-4 w-12">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                                                                } else {
                                                                    setSelectedUsers(new Set());
                                                                }
                                                            }}
                                                            className="rounded border-slate-300"
                                                        />
                                                    </th>
                                                    <th className="p-4">User</th>
                                                    <th className="p-4">Role</th>
                                                    <th className="p-4">Plan</th>
                                                    <th className="p-4">Status</th>
                                                    <th className="p-4">Last Active</th>
                                                    <th className="p-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredUsers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                                            No users found matching your filters.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredUsers.map(user => (
                                                        <tr
                                                            key={user.id}
                                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedUsers.has(user.id) ? 'bg-blue-50' : ''}`}
                                                            onClick={() => setSelectedUserDetail(user)}
                                                        >
                                                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedUsers.has(user.id)}
                                                                    onChange={(e) => {
                                                                        const newSelected = new Set(selectedUsers);
                                                                        if (e.target.checked) {
                                                                            newSelected.add(user.id);
                                                                        } else {
                                                                            newSelected.delete(user.id);
                                                                        }
                                                                        setSelectedUsers(newSelected);
                                                                    }}
                                                                    className="rounded border-slate-300"
                                                                />
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                                                        {user.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-800">{user.name}</div>
                                                                        <div className="text-xs text-slate-500">{user.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'superadmin' ? 'bg-red-100 text-red-700' :
                                                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                                        user.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                                                            'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                    {user.role === 'superadmin' ? 'Super Admin' :
                                                                        user.role === 'admin' ? 'Admin' :
                                                                            user.role === 'editor' ? 'Editor' : 'User'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${user.plan === 'Enterprise' ? 'bg-purple-100 text-purple-700' :
                                                                    user.plan === 'Pro' ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                    {user.plan}
                                                                </span>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`flex items-center gap-1.5 text-xs font-bold ${user.status === 'Active' ? 'text-emerald-600' :
                                                                    user.status === 'Banned' ? 'text-red-600' : 'text-slate-400'
                                                                    }`}>
                                                                    {user.status === 'Active' ? <CheckCircle size={12} /> : user.status === 'Banned' ? <Ban size={12} /> : <AlertTriangle size={12} />}
                                                                    {user.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-slate-500 text-xs">
                                                                {new Date(user.lastLogin).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </td>
                                                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setEditingUser(user);
                                                                        }}
                                                                        className="p-2 rounded hover:bg-slate-200 transition-colors text-blue-600"
                                                                        title="Edit User"
                                                                    >
                                                                        <Settings size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleBanUser(user.id);
                                                                        }}
                                                                        className={`p-2 rounded hover:bg-slate-200 transition-colors ${user.status === 'Banned' ? 'text-emerald-600' : 'text-red-500'}`}
                                                                        title={user.status === 'Banned' ? "Unban User" : "Ban User"}
                                                                    >
                                                                        {user.status === 'Banned' ? <CheckCircle size={16} /> : <Ban size={16} />}
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteUser(user.id);
                                                                        }}
                                                                        className="p-2 rounded hover:bg-slate-200 transition-colors text-red-600"
                                                                        title="Delete User"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* User Detail Modal */}
                                    {selectedUserDetail && (
                                        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedUserDetail(null)}>
                                            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                                                    <h2 className="text-xl font-bold text-slate-800">User Details</h2>
                                                    <button onClick={() => setSelectedUserDetail(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                                <div className="p-6 space-y-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                                                            {selectedUserDetail.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-800">{selectedUserDetail.name}</h3>
                                                            <p className="text-sm text-slate-500">{selectedUserDetail.email}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-slate-50 p-4 rounded-lg">
                                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Role</div>
                                                            <div className="text-sm font-semibold text-slate-800">
                                                                {selectedUserDetail.role === 'superadmin' ? 'Super Admin' :
                                                                    selectedUserDetail.role === 'admin' ? 'Admin' :
                                                                        selectedUserDetail.role === 'editor' ? 'Editor' : 'User'}
                                                            </div>
                                                        </div>
                                                        <div className="bg-slate-50 p-4 rounded-lg">
                                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Plan</div>
                                                            <div className="text-sm font-semibold text-slate-800">{selectedUserDetail.plan}</div>
                                                        </div>
                                                        <div className="bg-slate-50 p-4 rounded-lg">
                                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Status</div>
                                                            <div className={`text-sm font-semibold ${selectedUserDetail.status === 'Active' ? 'text-emerald-600' :
                                                                selectedUserDetail.status === 'Banned' ? 'text-red-600' : 'text-slate-400'
                                                                }`}>
                                                                {selectedUserDetail.status}
                                                            </div>
                                                        </div>
                                                        <div className="bg-slate-50 p-4 rounded-lg">
                                                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Last Login</div>
                                                            <div className="text-sm font-semibold text-slate-800">
                                                                {new Date(selectedUserDetail.lastLogin).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => {
                                                                setEditingUser(selectedUserDetail);
                                                                setSelectedUserDetail(null);
                                                            }}
                                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                                        >
                                                            Edit User
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                handleBanUser(selectedUserDetail.id);
                                                                setSelectedUserDetail(null);
                                                            }}
                                                            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${selectedUserDetail.status === 'Banned'
                                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                                : 'bg-red-600 text-white hover:bg-red-700'
                                                                }`}
                                                        >
                                                            {selectedUserDetail.status === 'Banned' ? 'Unban User' : 'Ban User'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit User Modal */}
                                    {editingUser && (
                                        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
                                            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                                                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                                                    <h2 className="text-xl font-bold text-slate-800">Edit User</h2>
                                                    <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                                <form
                                                    onSubmit={async (e) => {
                                                        e.preventDefault();

                                                        // Check feature flag
                                                        if (!canManageUsers) {
                                                            setError('User management is not enabled for your role');
                                                            return;
                                                        }

                                                        setLoading(true);
                                                        try {
                                                            await updateUser(adminToken, editingUser.id, {
                                                                name: editingUser.name,
                                                                email: editingUser.email,
                                                                role: editingUser.role,
                                                                plan: editingUser.plan,
                                                                isActive: editingUser.status === 'Active'
                                                            });
                                                            clearUserCaches(); // Clear caches for immediate effect
                                                            await loadUsers(currentPage);
                                                            await loadDashboardStats(); // Refresh dashboard stats
                                                            setEditingUser(null);
                                                        } catch (err: any) {
                                                            setError(err.message || 'Failed to update user', 'error');
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    }}
                                                    className="p-6 space-y-4"
                                                >
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                                        <input
                                                            type="text"
                                                            value={editingUser.name}
                                                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                                        <input
                                                            type="email"
                                                            value={editingUser.email}
                                                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                                        <select
                                                            value={editingUser.role}
                                                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="editor">Editor</option>
                                                            <option value="admin">Admin</option>
                                                            <option value="superadmin">Super Admin</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
                                                        <select
                                                            value={editingUser.plan}
                                                            onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value as any })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        >
                                                            <option value="Free">Free</option>
                                                            <option value="Pro">Pro</option>
                                                            <option value="Enterprise">Enterprise</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                                        <select
                                                            value={editingUser.status}
                                                            onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                        >
                                                            <option value="Active">Active</option>
                                                            <option value="Inactive">Inactive</option>
                                                            <option value="Banned">Banned</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-3 pt-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingUser(null)}
                                                            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            disabled={loading}
                                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                        >
                                                            {loading ? 'Saving...' : 'Save Changes'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}


                    {/* PACKAGES TAB - Protected by package_management flag */}
                    {activeTab === 'packages' && canManagePackages && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <PackageManager
                                token={adminToken}
                                packages={packages}
                                onRefresh={loadPackages}
                            />
                        </div>
                    )}
                    {activeTab === 'packages' && !canManagePackages && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
                            <h3 className="font-bold text-yellow-800 mb-1">Package Management Disabled</h3>
                            <p className="text-sm text-yellow-700">
                                The package_management feature is not enabled for your role. Contact a superadmin to enable this feature.
                            </p>
                        </div>
                    )}

                    {/* LLM Router Settings and Internal Router Settings are now merged into LLM Model Management */}

                    {/* LLM MODEL MANAGEMENT TAB */}
                    {activeTab === 'llm-model-management' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <LLMModelManagement token={adminToken || ''} />
                        </div>
                    )}

                    {/* ANALYTICS TAB - Unified Analytics Hub - Protected by analytics_dashboard flag */}
                    {activeTab === 'analytics' && canViewAnalyticsDashboard && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <UnifiedAnalytics token={adminToken || ''} />
                        </div>
                    )}
                    {activeTab === 'analytics' && !canViewAnalyticsDashboard && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
                            <h3 className="font-bold text-yellow-800 mb-1">Analytics Dashboard Disabled</h3>
                            <p className="text-sm text-yellow-700">
                                The analytics_dashboard feature is not enabled for your role. Contact a superadmin to enable this feature.
                            </p>
                        </div>
                    )}

                    {/* FINANCIALS TAB - Consolidated */}
                    {activeTab === 'financials' && canViewFinancialDashboard && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <FinancialsTab token={adminToken} />
                        </div>
                    )}
                    {activeTab === 'financials' && !canViewFinancialDashboard && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
                            <h3 className="font-bold text-yellow-800 mb-1">Financial Dashboard Disabled</h3>
                            <p className="text-sm text-yellow-700">
                                The financial_dashboard feature is not enabled for your role. Contact a superadmin to enable this feature.
                            </p>
                        </div>
                    )}

                    {/* PERFORMANCE & MONITORING TAB - Consolidated */}
                    {activeTab === 'performance-monitoring' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <PerformanceMonitoringTab token={adminToken} />
                        </div>
                    )}

                    {/* CUSTOM REPORT BUILDER TAB */}
                    {activeTab === 'reports' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <CustomReportBuilder token={adminToken || ''} />
                        </div>
                    )}

                    {/* SYSTEM AUDIT LOGS TAB - Protected by audit_logs flag */}
                    {activeTab === 'system-audit-logs' && canViewAuditLogs && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-slate-800">Audit Logs</h2>
                                <button
                                    onClick={() => loadAuditLogs(currentPage)}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-bold"
                                >
                                    Refresh
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Filter by action..."
                                        value={auditFilters.action || ''}
                                        onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                                    />
                                    <select
                                        value={auditFilters.entityType || ''}
                                        onChange={(e) => setAuditFilters({ ...auditFilters, entityType: e.target.value })}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                                    >
                                        <option value="">All Entities</option>
                                        <option value="user">User</option>
                                        <option value="project">Project</option>
                                        <option value="package">Package</option>
                                        <option value="system">System</option>
                                    </select>
                                    <select
                                        value={auditFilters.status || ''}
                                        onChange={(e) => setAuditFilters({ ...auditFilters, status: e.target.value })}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                                    >
                                        <option value="">All Status</option>
                                        <option value="success">Success</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                    <button
                                        onClick={() => {
                                            setAuditFilters({});
                                            loadAuditLogs(1);
                                        }}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-bold"
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                                            <tr>
                                                <th className="p-4">Time</th>
                                                <th className="p-4">Action</th>
                                                <th className="p-4">Entity</th>
                                                <th className="p-4">User</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Loading audit logs...</td></tr>
                                            ) : auditLogs.length === 0 ? (
                                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No audit logs found.</td></tr>
                                            ) : auditLogs
                                                .filter(log => {
                                                    if (auditFilters.action && !log.action.toLowerCase().includes(auditFilters.action.toLowerCase())) return false;
                                                    if (auditFilters.entityType && log.entityType !== auditFilters.entityType) return false;
                                                    if (auditFilters.status && log.status !== auditFilters.status) return false;
                                                    return true;
                                                })
                                                .map(log => (
                                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                                                        <td className="p-4 font-mono text-xs">{log.action}</td>
                                                        <td className="p-4">
                                                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold">{log.entityType}</span>
                                                        </td>
                                                        <td className="p-4 text-xs text-slate-600">{log.userEmail || 'System'}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                                                                log.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {log.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-xs text-slate-500">
                                                            <button
                                                                onClick={() => setSelectedAuditLog(log)}
                                                                className="text-blue-600 hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Audit Log Details Modal */}
                            {selectedAuditLog && (
                                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedAuditLog(null)}>
                                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-slate-800">Audit Log Details</h3>
                                            <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-600">
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action</label>
                                                <p className="text-sm font-mono text-slate-800 mt-1">{selectedAuditLog.action}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entity Type</label>
                                                <p className="text-sm text-slate-800 mt-1">{selectedAuditLog.entityType}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entity ID</label>
                                                <p className="text-sm font-mono text-slate-800 mt-1">{selectedAuditLog.entityId || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">User</label>
                                                <p className="text-sm text-slate-800 mt-1">{selectedAuditLog.userEmail || 'System'}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                                                <p className={`text-sm font-bold mt-1 ${selectedAuditLog.status === 'success' ? 'text-emerald-700' :
                                                    selectedAuditLog.status === 'failed' ? 'text-red-700' :
                                                        'text-slate-600'
                                                    }`}>
                                                    {selectedAuditLog.status}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Timestamp</label>
                                                <p className="text-sm text-slate-800 mt-1">{new Date(selectedAuditLog.createdAt).toLocaleString()}</p>
                                            </div>
                                            {selectedAuditLog.ipAddress && (
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">IP Address</label>
                                                    <p className="text-sm font-mono text-slate-800 mt-1">{selectedAuditLog.ipAddress}</p>
                                                </div>
                                            )}
                                            {selectedAuditLog.userAgent && (
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Agent</label>
                                                    <p className="text-sm text-slate-500 mt-1 break-all">{selectedAuditLog.userAgent}</p>
                                                </div>
                                            )}
                                            {selectedAuditLog.metadata && Object.keys(selectedAuditLog.metadata).length > 0 && (
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metadata</label>
                                                    <pre className="text-xs bg-slate-50 p-3 rounded-lg mt-1 overflow-x-auto">
                                                        {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'system-audit-logs' && !canViewAuditLogs && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
                            <h3 className="font-bold text-yellow-800 mb-1">System Audit Logs Disabled</h3>
                            <p className="text-sm text-yellow-700">
                                The audit_logs feature is not enabled for your role. Contact a superadmin to enable this feature.
                            </p>
                        </div>
                    )}

                    {/* FEATURE FLAGS TAB */}
                    {/* OLD FEATURE FLAGS TAB - REMOVED (now part of user-feature-access) */}

                    {/* PAGE EDITOR TAB */}
                    {activeTab === 'page-editor' && (() => {
                        const landingConfig = getLandingConfig();
                        // Use GrapesJS editor (no WordPress required) - default
                        // Fallback to Elementor if enabled
                        if (landingConfig.elementorEnabled && landingConfig.elementorUrl) {
                            return (
                                <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <ElementorPageEditor
                                        token={adminToken || ''}
                                        pageKey="home"
                                        editorUrl={landingConfig.elementorUrl}
                                        onSave={() => {
                                            console.log('[Admin] Page saved in Elementor');
                                        }}
                                        onPublish={() => {
                                            console.log('[Admin] Page published in Elementor');
                                        }}
                                    />
                                </div>
                            );
                        }
                        // Use GrapesJS visual editor (default - no WordPress required)
                        return (
                            <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <GrapesJSPageEditor
                                    token={adminToken || ''}
                                    pageKey={currentPageKey}
                                    pages={grapesPages}
                                    onSave={async (pageData) => {
                                        console.log('[Admin] Page saved in GrapesJS:', pageData.pageKey);
                                        // Update page in backend
                                        try {
                                            await updatePage(adminToken || '', pageData.pageKey, {
                                                html: pageData.html,
                                                css: pageData.css,
                                            });
                                        } catch (err) {
                                            console.error('Failed to save page:', err);
                                        }
                                    }}
                                    onPageChange={(pageKey) => {
                                        setCurrentPageKey(pageKey);
                                    }}
                                    onCreatePage={async (name) => {
                                        const response = await createPage(adminToken || '', { name });
                                        const newPage: GrapesPage = {
                                            id: (response.page as any)._id || response.page.id,
                                            name: response.page.name,
                                            slug: response.page.slug,
                                            html: response.page.html || '',
                                            css: response.page.css || '',
                                            createdAt: new Date((response.page as any).createdAt || Date.now()),
                                            updatedAt: new Date((response.page as any).updatedAt || Date.now()),
                                        };
                                        setGrapesPages(prev => [...prev, newPage]);
                                        return newPage;
                                    }}
                                    onDeletePage={async (pageKey) => {
                                        await deletePage(adminToken || '', pageKey);
                                        setGrapesPages(prev => prev.filter(p => p.slug !== pageKey));
                                        if (currentPageKey === pageKey) {
                                            setCurrentPageKey('home');
                                        }
                                    }}
                                />
                            </div>
                        );
                    })()}

                    {/* AI AGENTS TAB (Merged Agent Knowledge + Custom Agents) */}
                    {activeTab === 'ai-agents' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <AIAgentsManager
                                token={adminToken}
                                userRole={currentAdminRole || 'admin'}
                            />
                        </div>
                    )}

                    {/* PROCESS MANAGEMENT TAB - Consolidated */}
                    {activeTab === 'process-management' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <ProcessManagementTab token={adminToken} />
                        </div>
                    )}


                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SystemSettings token={adminToken} />
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SecurityDashboard token={adminToken || ''} />
                        </div>
                    )}

                    {/* ALERTS TAB */}
                    {activeTab === 'alerts' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <AlertConfiguration token={adminToken || ''} />
                        </div>
                    )}

                    {/* BACKUPS TAB */}
                    {activeTab === 'backups' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <BackupManagement token={adminToken || ''} />
                        </div>
                    )}

                    {/* DATABASE MANAGER TAB */}
                    {activeTab === 'database' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <DatabaseManager token={adminToken || ''} />
                        </div>
                    )}


                    {/* CONTENT MODERATION TAB */}
                    {activeTab === 'moderation' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <ContentModeration token={adminToken} />
                        </div>
                    )}

                    {/* INTEGRATIONS TAB */}
                    {activeTab === 'integrations' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <IntegrationsManagement token={adminToken || ''} />
                        </div>
                    )}

                    {/* CLOUD DEPLOYMENT TAB */}
                    {activeTab === 'cloud-deployment' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <CloudDeployment userRole={currentAdminRole || 'admin'} token={adminToken || ''} />
                        </div>
                    )}

                    {/* RATE LIMITING TAB */}
                    {activeTab === 'rate-limiting' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <RateLimitingManagement token={adminToken || ''} />
                        </div>
                    )}

                    {/* SUPPORT TICKETS TAB */}
                    {activeTab === 'support-tickets' && (
                        <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SupportDashboard initialView="tickets" />
                        </div>
                    )}

                    {/* LIVE CHAT TAB */}
                    {activeTab === 'support-chat' && (
                        <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SupportDashboard initialView="chat" />
                        </div>
                    )}

                    {/* RESPONSE TEMPLATES TAB */}
                    {activeTab === 'support-templates' && (
                        <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <SupportDashboard initialView="templates" />
                        </div>
                    )}

                    {/* SYSTEM COSTS TAB */}

                    {/* Developer Tools tabs removed - these are end-user features, not admin features */}

                </main>
            </div>

            {/* Project LLM Activity Details Modal */}
            {selectedProjectId && projectLLMDetails && (
                <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setSelectedProjectId(null); setProjectLLMDetails(null); }}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">LLM Activity Details</h2>
                            <button onClick={() => { setSelectedProjectId(null); setProjectLLMDetails(null); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Project: {projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}</h3>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <div className="text-xs text-blue-600 font-medium mb-1">Total Calls</div>
                                    <div className="text-2xl font-bold text-blue-700">{projectLLMDetails.totalCalls}</div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <div className="text-xs text-purple-600 font-medium mb-1">Total Tokens</div>
                                    <div className="text-2xl font-bold text-purple-700">{projectLLMDetails.totalTokens.toLocaleString()}</div>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                    <div className="text-xs text-emerald-600 font-medium mb-1">Total Cost</div>
                                    <div className="text-2xl font-bold text-emerald-700">${projectLLMDetails.totalCost.toFixed(2)}</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="text-xs text-slate-600 font-medium mb-1">Input Tokens</div>
                                    <div className="text-2xl font-bold text-slate-700">{projectLLMDetails.inputTokens.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* By Provider */}
                            {Object.keys(projectLLMDetails.byProvider).length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-3">By Provider</h4>
                                    <div className="space-y-2">
                                        {Object.entries(projectLLMDetails.byProvider).map(([provider, stats]: [string, any]) => (
                                            <div key={provider} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <span className="text-sm font-medium text-slate-800 capitalize">{provider}</span>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs text-slate-600">{stats.calls} calls</span>
                                                    <span className="text-xs text-slate-600">{stats.tokens.toLocaleString()} tokens</span>
                                                    <span className="text-xs font-medium text-emerald-600">${stats.cost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* By Model */}
                            {Object.keys(projectLLMDetails.byModel).length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-3">By Model</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {Object.entries(projectLLMDetails.byModel).map(([model, stats]: [string, any]) => (
                                            <div key={model} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{model}</div>
                                                    <div className="text-xs text-slate-500 capitalize">{stats.provider}</div>
                                                </div>
                                                <div className="flex items-center gap-4 ml-4">
                                                    <span className="text-xs text-slate-600">{stats.calls} calls</span>
                                                    <span className="text-xs text-slate-600">{stats.tokens.toLocaleString()} tokens</span>
                                                    <span className="text-xs font-medium text-emerald-600">${stats.cost.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Calls */}
                            {projectLLMDetails.recentCalls && projectLLMDetails.recentCalls.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-3">Recent Calls</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {projectLLMDetails.recentCalls.slice(0, 10).map((call: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-800">{call.modelId}</div>
                                                    <div className="text-xs text-slate-500">{call.requestType} • {new Date(call.timestamp).toLocaleString()}</div>
                                                </div>
                                                <div className="flex items-center gap-4 ml-4">
                                                    <span className="text-xs text-slate-600">{call.inputTokens + call.outputTokens} tokens</span>
                                                    <span className={`text-xs px-2 py-1 rounded ${call.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {call.success ? 'Success' : 'Failed'}
                                                    </span>
                                                    <span className="text-xs font-medium text-emerald-600">${call.totalCost.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showAddUserModal && (
                <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddUserModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Add New User</h2>
                            <button onClick={() => setShowAddUserModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={newUserData.name}
                                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={newUserData.email}
                                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Password *</label>
                                <input
                                    type="password"
                                    value={newUserData.password}
                                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="Minimum 6 characters"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Plan</label>
                                    <select
                                        value={newUserData.plan}
                                        onChange={(e) => setNewUserData({ ...newUserData, plan: e.target.value as 'Free' | 'Pro' | 'Enterprise' })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="Free">Free</option>
                                        <option value="Pro">Pro</option>
                                        <option value="Enterprise">Enterprise</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                                    <select
                                        value={newUserData.role}
                                        onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as 'user' | 'admin' | 'superadmin' | 'editor' })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    >
                                        <option value="user">User</option>
                                        <option value="editor">Editor</option>
                                        <option value="admin">Admin</option>
                                        <option value="superadmin">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowAddUserModal(false);
                                        setNewUserData({ email: '', password: '', name: '', plan: 'Free', role: 'user' });
                                        setError(null);
                                    }}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateUser}
                                    disabled={loading || !newUserData.email || !newUserData.password || !newUserData.name}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Create User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
