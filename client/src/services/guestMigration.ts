/**
 * Guest Project Migration Service
 * 
 * Migrates guest projects from localStorage to database when user logs in.
 * Guest data is now stored in localStorage (persists across browser sessions)
 * with a 7-day TTL to prevent storage bloat.
 */

import { projectsApi } from './api';

const GUEST_DATA_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface GuestProject {
  id: string;
  name: string;
  description: string;
  lastModified: number;
  data: any; // Full project state
}

/**
 * Get all guest projects from sessionStorage
 */
export function getGuestProjects(): GuestProject[] {
  try {
    // Try localStorage first (persistent), fallback to sessionStorage (legacy)
    let metaStr = localStorage.getItem('guest_projects_meta');
    if (!metaStr) {
      metaStr = sessionStorage.getItem('guest_projects_meta');
    }
    if (!metaStr) return [];

    const metas = JSON.parse(metaStr) as Array<{ id: string; name: string; description: string; lastModified: number }>;
    const projects: GuestProject[] = [];

    metas.forEach(meta => {
      // Try localStorage first, fallback to sessionStorage (legacy)
      let projectData = localStorage.getItem(`guest_project_${meta.id}`);
      if (!projectData) {
        projectData = sessionStorage.getItem(`guest_project_${meta.id}`);
      }
      if (projectData) {
        try {
          const data = JSON.parse(projectData);
          projects.push({
            id: meta.id,
            name: meta.name,
            description: meta.description,
            lastModified: meta.lastModified,
            data
          });
        } catch (e) {
          console.error(`Failed to parse guest project ${meta.id}:`, e);
        }
      }
    });

    return projects;
  } catch (e) {
    console.error('Failed to get guest projects:', e);
    return [];
  }
}

/**
 * Migrate a guest project to database
 */
export async function migrateGuestProjectToDatabase(guestProject: GuestProject, userId: string): Promise<string | null> {
  try {
    const projectData = {
      ...guestProject.data,
      userId,
      name: guestProject.data.name || guestProject.name,
      description: guestProject.data.description || guestProject.description,
      lastModified: new Date(guestProject.lastModified || Date.now())
    };

    const savedProject = await projectsApi.create(projectData);
    return savedProject._id || savedProject.id || null;
  } catch (e) {
    console.error(`Failed to migrate guest project ${guestProject.id}:`, e);
    throw e;
  }
}

/**
 * Migrate all guest projects to database
 */
export async function migrateAllGuestProjectsToDatabase(userId: string): Promise<{ success: number; failed: number; migratedIds: Record<string, string> }> {
  const guestProjects = getGuestProjects();
  let success = 0;
  let failed = 0;
  const migratedIds: Record<string, string> = {}; // oldId -> newId

  for (const project of guestProjects) {
    try {
      const newId = await migrateGuestProjectToDatabase(project, userId);
      if (newId) {
        migratedIds[project.id] = newId;
        success++;

        // Remove from both storage locations after successful migration
        localStorage.removeItem(`guest_project_${project.id}`);
        sessionStorage.removeItem(`guest_project_${project.id}`);
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`Failed to migrate project ${project.id}:`, e);
      failed++;
    }
  }

  // Clear metadata from both storage locations after migration
  if (success > 0) {
    localStorage.removeItem('guest_projects_meta');
    sessionStorage.removeItem('guest_projects_meta');
  }

  return { success, failed, migratedIds };
}

/**
 * Check if user has guest projects to migrate
 */
export function hasGuestProjectsToMigrate(): boolean {
  return getGuestProjects().length > 0;
}

/**
 * Save a guest project to localStorage (persistent storage)
 */
export function saveGuestProject(id: string, name: string, description: string, data: any): void {
  try {
    // Save project data
    localStorage.setItem(`guest_project_${id}`, JSON.stringify(data));

    // Update metadata
    let metas = [];
    const metaStr = localStorage.getItem('guest_projects_meta');
    if (metaStr) {
      metas = JSON.parse(metaStr);
    }

    // Update or add entry
    const existingIndex = metas.findIndex((m: any) => m.id === id);
    const meta = { id, name, description, lastModified: Date.now() };
    if (existingIndex >= 0) {
      metas[existingIndex] = meta;
    } else {
      metas.push(meta);
    }

    localStorage.setItem('guest_projects_meta', JSON.stringify(metas));
    console.log(`[GuestStorage] Saved guest project ${id} to localStorage`);
  } catch (e) {
    console.error('Failed to save guest project:', e);
  }
}

/**
 * Clean up stale guest data older than TTL (7 days)
 */
export function cleanupStaleGuestData(): void {
  try {
    const metaStr = localStorage.getItem('guest_projects_meta');
    if (!metaStr) return;

    const metas = JSON.parse(metaStr) as Array<{ id: string; lastModified: number }>;
    const now = Date.now();
    const validMetas = metas.filter(meta => {
      const age = now - (meta.lastModified || 0);
      if (age > GUEST_DATA_TTL_MS) {
        // Remove stale project data
        localStorage.removeItem(`guest_project_${meta.id}`);
        console.log(`[GuestStorage] Cleaned up stale guest project: ${meta.id}`);
        return false;
      }
      return true;
    });

    if (validMetas.length !== metas.length) {
      localStorage.setItem('guest_projects_meta', JSON.stringify(validMetas));
    }
  } catch (e) {
    console.error('Failed to cleanup stale guest data:', e);
  }
}


