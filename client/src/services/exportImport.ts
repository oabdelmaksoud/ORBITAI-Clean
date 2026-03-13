/**
 * Export/Import Service
 * Handles project export to JSON/PDF and import from JSON
 */

import JSZip from 'jszip';
import { ProjectState } from '@orbitai/shared';
import { generateObjectId } from './projectStorage';

/**
 * Export project to JSON
 */
export function exportProjectToJSON(project: ProjectState): string {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    project: {
      ...project,
      // Remove sensitive data if needed
    }
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export project to PDF (simplified - would need PDF library)
 */
export async function exportProjectToPDF(project: ProjectState): Promise<Blob> {
  // This is a simplified version - would need a PDF library like jsPDF
  const htmlContent = `
    <html>
      <head>
        <title>${project.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #2563eb; }
          .section { margin: 20px 0; }
          .task { padding: 10px; border-left: 3px solid #2563eb; margin: 5px 0; }
        </style>
      </head>
      <body>
        <h1>${project.name}</h1>
        <div class="section">
          <h2>Description</h2>
          <p>${project.description}</p>
        </div>
        <div class="section">
          <h2>Phase: ${project.currentPhase}</h2>
        </div>
        <div class="section">
          <h2>Tasks (${project.tasks.length})</h2>
          ${project.tasks.map(task => `
            <div class="task">
              <strong>${task.title}</strong> - ${task.status}
              ${task.description ? `<p>${task.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="section">
          <h2>Artifacts (${project.artifacts.length})</h2>
          ${project.artifacts.map(artifact => `
            <div class="task">
              <strong>${artifact.title}</strong> - ${artifact.type}
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `;
  
  // Return HTML blob (would need conversion to PDF in production)
  return new Blob([htmlContent], { type: 'text/html' });
}

/**
 * Export project as ZIP with all artifacts
 */
export async function exportProjectAsZIP(project: ProjectState): Promise<Blob> {
  const zip = new JSZip();
  
  // Add project JSON
  zip.file('project.json', exportProjectToJSON(project));
  
  // Add artifacts
  project.artifacts.forEach((artifact, index) => {
    const extension = artifact.type === 'code' ? '.js' : 
                     artifact.type === 'documentation' ? '.md' : 
                     artifact.type === 'diagram' ? '.mmd' : '.txt';
    zip.file(`artifacts/${artifact.title}${extension}`, artifact.content);
  });
  
  // Generate ZIP
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Import project from JSON
 */
export function importProjectFromJSON(jsonString: string): ProjectState {
  try {
    const data = JSON.parse(jsonString);
    
    // Validate structure
    if (!data.project) {
      throw new Error('Invalid project format: missing project data');
    }
    
    const project = data.project as ProjectState;
    
    // Validate required fields
    if (!project.name || !project.description) {
      throw new Error('Invalid project format: missing required fields');
    }
    
    // Set new ID and timestamps
    project.id = generateObjectId();
    project.created = Date.now();
    project.lastModified = Date.now();
    
    return project;
  } catch (error) {
    throw new Error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download file
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}


