/**
 * Public Packages API Service - For landing page and signup
 * No authentication required
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface PublicPackage {
  id: string; // MongoDB _id as string
  displayName: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  features: Array<{
    key: string;
    label: string;
    value: string | number | boolean;
    type: 'string' | 'number' | 'boolean';
  }>;
  limits: {
    maxProjects: number;
    maxAgents: number;
    maxTasks: number;
    maxStorageGB: number;
    maxAPICalls: number;
    maxTeamMembers?: number;
    maxMonthlyBudget?: number;
    maxFileSizeMB?: number;
    maxMCPServers?: number;
    maxArtifactsPerProject?: number;
    maxBackupVersions?: number;
    maxConcurrentExecutions?: number;
    internetAccessEnabled?: boolean;
    codeExecutionEnabled?: boolean;
    cloudDeploymentEnabled?: boolean;
  };
  isDefault: boolean;
  metadata?: {
    color?: string;
    icon?: string;
    highlight?: boolean;
  };
}

/**
 * Fetch all active packages for public display (landing page, signup)
 */
export async function getPublicPackages(): Promise<PublicPackage[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/packages/public`, {
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch packages: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch packages');
    }

    return data.data.packages;
  } catch (error) {
    console.error('Public Packages API Error:', error);
    // Return empty array on error so UI doesn't break
    return [];
  }
}

/**
 * Fetch a specific package by ID
 */
export async function getPublicPackage(packageId: string): Promise<PublicPackage | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/packages/public/${packageId}`, {
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch package: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch package');
    }

    return data.data.package;
  } catch (error) {
    console.error('Public Package API Error:', error);
    return null;
  }
}

