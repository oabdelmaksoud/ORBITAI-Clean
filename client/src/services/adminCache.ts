/**
 * Admin Cache Management
 * Utility functions to clear caches when admin actions are performed
 */

/**
 * Clear user-related caches
 * This can be extended to clear specific caches or dispatch events
 */
export function clearUserCaches(): void {
  // Clear feature access cache
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('clearFeatureCache'));
  }
  
  // Clear any localStorage caches related to users
  // You can extend this to clear specific cache keys
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('user_') || key.startsWith('admin_user_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear user caches from localStorage:', error);
  }
}

/**
 * Clear project-related caches
 */
export function clearProjectCaches(): void {
  // Clear any localStorage caches related to projects
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('project_') || key.startsWith('admin_project_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear project caches from localStorage:', error);
  }
}

/**
 * Clear package-related caches
 */
export function clearPackageCaches(): void {
  // Clear any localStorage caches related to packages
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('package_') || key.startsWith('admin_package_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear package caches from localStorage:', error);
  }
}













