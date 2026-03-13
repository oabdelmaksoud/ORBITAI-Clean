export type ViewMode = 'landing' | 'setup' | 'workspace' | 'admin' | 'shared';

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
  description: string;
  phase: string;
  userId?: string;
}






