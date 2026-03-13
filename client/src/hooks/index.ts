/**
 * Hooks Index
 * 
 * Central export point for all custom hooks.
 * Import hooks from here for cleaner imports:
 * 
 * import { useAuthentication, useHITL, useViewMode } from './hooks';
 */

// Authentication & User
export { useAuthentication } from './useAuthentication';
export { useAdminOperations } from './useAdminOperations';

// State Management
export { useHITL } from './useHITL';
export { useProcessingOverlay } from './useProcessingOverlay';
export { useProjectManagement } from './useProjectManagement';
export { useViewMode } from './useViewMode';
export { useAutoPilot } from './useAutoPilot';
export { useGlobalChat } from './useGlobalChat';

// Real-time & WebSocket
export { useWebSocket } from './useWebSocket';

// Existing hooks (already in codebase)
export { useHistory } from './useHistory';
export { useFeatureAccess } from './useFeatureAccess';
export { useUserSettings } from './useUserSettings';
export { useProjectState } from './useProjectState';

// Type exports
export type { ViewMode } from '@orbitai/shared';
export type { AutoPilotStatus } from './useAutoPilot';

