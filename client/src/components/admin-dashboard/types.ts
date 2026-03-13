// Admin Dashboard Types
// Extracted from AdminDashboard.tsx

export interface AdminDashboardProps {
    onExit: () => void;
    token?: string;
}

export interface ProjectMeta {
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

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin' | 'superadmin' | 'editor';
    status: 'Active' | 'Inactive' | 'Banned';
    lastLogin: number;
    plan: 'Free' | 'Pro' | 'Enterprise';
}

export interface UserFilters {
    role: string;
    plan: string;
    status: string;
}

export interface NewUserData {
    email: string;
    password: string;
    name: string;
    plan: 'Free' | 'Pro' | 'Enterprise';
    role: 'user' | 'admin' | 'superadmin' | 'editor';
}

export interface AuditFilters {
    action?: string;
    entityType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}
