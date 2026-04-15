/**
 * Documentation Generator Service
 * Generates comprehensive documentation for projects including API docs, user guides,
 * deployment guides, README files, and architecture documentation
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
// import { Type, Schema } from '@google/genai';

// const __filename = fileURLToPath(import.meta.url);
// const ___dirname = path.dirname(__filename);

export interface DocumentationPackage {
  readme: string;
  apiDocs: string; // OpenAPI/Swagger spec
  userGuide: string;
  deploymentGuide: Record<string, string>; // Platform-specific guides
  architectureDoc: string;
  codeComments: Record<string, string>; // File path -> commented code
}

export interface DocumentationOptions {
  format?: 'markdown' | 'html';
  includeCodeExamples?: boolean;
  platforms?: string[]; // For deployment guides
  apiFormat?: 'openapi' | 'swagger';
}

class DocumentationGeneratorService {
  /**
   * Generate complete documentation package for a project
   */
  async generateDocumentation(
    project: any,
    options: DocumentationOptions = {}
  ): Promise<DocumentationPackage> {
    try {
      logger.info(`Generating documentation for project: ${project.name || project._id}`);

      const [
        readme,
        apiDocs,
        userGuide,
        deploymentGuides,
        architectureDoc
      ] = await Promise.all([
        this.generateREADME(project, options),
        this.generateAPIDocs(project, options),
        this.generateUserGuide(project, options),
        this.generateDeploymentGuides(project, options),
        this.generateArchitectureDocs(project, options)
      ]);

      return {
        readme,
        apiDocs,
        userGuide,
        deploymentGuide: deploymentGuides,
        architectureDoc,
        codeComments: {} // Will be populated separately if needed
      };
    } catch (error: unknown) {
      logger.error('Documentation generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate README.md file
   */
  async generateREADME(
    project: any,
    _options: DocumentationOptions = {}
  ): Promise<string> {
    try {
      const prompt = `Generate a comprehensive README.md file for the following project.

Project Information:
- Name: ${project.name || 'Untitled Project'}
- Description: ${project.description || 'No description'}
- Type: ${project.projectType || 'Not specified'}
- Phase: ${project.currentPhase || 'Not specified'}
- Methodology: ${project.methodology || 'Not specified'}

Artifacts: ${project.artifacts?.length || 0} artifacts
Tasks: ${project.tasks?.length || 0} tasks

Include the following sections:
1. **Project Title** - Clear, descriptive title
2. **Description** - What the project does
3. **Features** - Key features and capabilities
4. **Tech Stack** - Technologies, frameworks, libraries used
5. **Prerequisites** - Required software, dependencies
6. **Installation** - Step-by-step setup instructions
7. **Configuration** - Environment variables, config files
8. **Usage** - How to use/run the project
9. **Project Structure** - Directory structure overview
10. **API Endpoints** - If applicable, list main endpoints
11. **Testing** - How to run tests
12. **Deployment** - Basic deployment instructions
13. **Contributing** - Guidelines for contributions
14. **License** - License information
15. **Support** - Contact/support information

Make it professional, clear, and comprehensive. Use proper markdown formatting.`;

      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'documentation',
        agentRole: 'Requirements Agent',
        context: {
          agentRole: 'Requirements Agent',
          tools: []
        }
      });

      return response.content;
    } catch (error: unknown) {
      logger.error('README generation failed:', error);
      return this.getDefaultREADME(project);
    }
  }

  /**
   * Generate API documentation (OpenAPI/Swagger)
   */
  async generateAPIDocs(
    project: any,
    options: DocumentationOptions = {}
  ): Promise<string> {
    try {
      // Extract API-related artifacts
      const apiArtifacts = project.artifacts?.filter((a: any) => 
        a.type === 'code' || 
        a.title?.toLowerCase().includes('api') ||
        a.title?.toLowerCase().includes('endpoint') ||
        a.title?.toLowerCase().includes('route')
      ) || [];

      const format = options.apiFormat || 'openapi';

      const prompt = `Generate ${format.toUpperCase()} API documentation for this project.

Project: ${project.name || 'Untitled'}
Description: ${project.description || ''}

API Code/Artifacts:
${apiArtifacts.map((a: any) => `\n--- ${a.title} ---\n${a.content?.substring(0, 2000) || ''}`).join('\n')}

Generate a complete ${format === 'openapi' ? 'OpenAPI 3.0' : 'Swagger 2.0'} specification including:
- API title and version
- Server URLs
- All endpoints (GET, POST, PUT, DELETE, etc.)
- Request/response schemas
- Authentication requirements
- Error responses
- Examples

Return valid ${format === 'openapi' ? 'OpenAPI' : 'Swagger'} JSON/YAML.`;

      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'api_documentation',
        agentRole: 'Implementation Agent',
        context: {
          agentRole: 'Implementation Agent',
          tools: []
        },
        requiredOutputFormat: format === 'openapi' ? 'json' : 'yaml'
      });

      return response.content;
    } catch (error: unknown) {
      logger.error('API docs generation failed:', error);
      return this.getDefaultAPIDocs(project);
    }
  }

  /**
   * Generate user guide
   */
  async generateUserGuide(
    project: any,
    _options: DocumentationOptions = {}
  ): Promise<string> {
    try {
      const prompt = `Generate a comprehensive user guide for the following project.

Project: ${project.name || 'Untitled'}
Description: ${project.description || ''}
Type: ${project.projectType || 'Not specified'}

Include:
1. **Introduction** - What the application does
2. **Getting Started** - First steps for new users
3. **Features Overview** - All major features explained
4. **User Interface Guide** - How to navigate and use the UI
5. **Common Tasks** - Step-by-step guides for common operations
6. **Troubleshooting** - Common issues and solutions
7. **FAQ** - Frequently asked questions
8. **Keyboard Shortcuts** - If applicable
9. **Best Practices** - Tips for optimal usage

Make it user-friendly, clear, and include examples where helpful.`;

      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'documentation',
        agentRole: 'Requirements Agent',
        context: {
          agentRole: 'Requirements Agent',
          tools: []
        }
      });

      return response.content;
    } catch (error: unknown) {
      logger.error('User guide generation failed:', error);
      return this.getDefaultUserGuide(project);
    }
  }

  /**
   * Generate deployment guides for multiple platforms
   */
  async generateDeploymentGuides(
    project: any,
    options: DocumentationOptions = {}
  ): Promise<Record<string, string>> {
    const platforms = options.platforms || ['vercel', 'railway', 'aws', 'docker'];
    const guides: Record<string, string> = {};

    for (const platform of platforms) {
      try {
        guides[platform] = await this.generateDeploymentGuide(project, platform, options);
      } catch (error: unknown) {
        logger.error(`Deployment guide generation failed for ${platform}:`, error);
        guides[platform] = this.getDefaultDeploymentGuide(project, platform);
      }
    }

    return guides;
  }

  /**
   * Generate deployment guide for a specific platform
   */
  private async generateDeploymentGuide(
    project: any,
    platform: string,
    _options: DocumentationOptions = {}
  ): Promise<string> {
    const prompt = `Generate a detailed deployment guide for deploying this project to ${platform}.

Project: ${project.name || 'Untitled'}
Description: ${project.description || ''}
Type: ${project.projectType || 'Not specified'}

Platform: ${platform}

Include:
1. **Prerequisites** - Required accounts, tools, credentials
2. **Preparation** - Pre-deployment steps
3. **Configuration** - Environment variables, settings
4. **Deployment Steps** - Step-by-step instructions
5. **Post-Deployment** - Verification, monitoring setup
6. **Troubleshooting** - Common deployment issues
7. **Scaling** - How to scale the application
8. **Backup & Recovery** - Backup strategies

Make it platform-specific and actionable.`;

      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'deployment_guide',
        agentRole: 'Integration Agent',
        context: {
          agentRole: 'Integration Agent',
          tools: []
        }
      });

      return response.content;
  }

  /**
   * Generate architecture documentation
   */
  async generateArchitectureDocs(
    project: any,
    _options: DocumentationOptions = {}
  ): Promise<string> {
    try {
      // Find architecture-related artifacts
      const archArtifacts = project.artifacts?.filter((a: any) =>
        a.type === 'design' ||
        a.title?.toLowerCase().includes('architecture') ||
        a.title?.toLowerCase().includes('design')
      ) || [];

      const prompt = `Generate comprehensive architecture documentation for this project.

Project: ${project.name || 'Untitled'}
Description: ${project.description || ''}
Type: ${project.projectType || 'Not specified'}
Methodology: ${project.methodology || 'Not specified'}

Architecture Artifacts:
${archArtifacts.map((a: any) => `\n--- ${a.title} ---\n${a.content?.substring(0, 2000) || ''}`).join('\n')}

Include:
1. **System Overview** - High-level system description
2. **Architecture Patterns** - Patterns used (MVC, microservices, etc.)
3. **Technology Stack** - All technologies and why they were chosen
4. **System Architecture** - Component diagram and relationships
5. **Data Flow** - How data moves through the system
6. **Database Design** - Database schema and relationships
7. **API Design** - API structure and endpoints
8. **Security Architecture** - Security measures and patterns
9. **Scalability** - How the system scales
10. **Deployment Architecture** - Infrastructure and deployment setup

Use diagrams (Mermaid format) where helpful.`;

      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'architecture_documentation',
        agentRole: 'Design/Architecture Agent',
        context: {
          agentRole: 'Design/Architecture Agent',
          tools: []
        }
      });

      return response.content;
    } catch (error: unknown) {
      logger.error('Architecture docs generation failed:', error);
      return this.getDefaultArchitectureDoc(project);
    }
  }

  /**
   * Add code comments to generated code files
   */
  async addCodeComments(
    code: string,
    language: string,
    _filePath?: string
  ): Promise<string> {
    try {
      const prompt = `Add comprehensive comments to the following ${language} code.

Code:
\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`

Requirements:
- Add JSDoc/function comments for all functions
- Explain complex logic
- Add inline comments where helpful
- Document parameters and return values
- Use ${language} comment conventions

Return the code with comments added.`;

      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'code_documentation',
        agentRole: 'Implementation Agent',
        context: {
          agentRole: 'Implementation Agent',
          tools: []
        },
        requiredOutputFormat: 'code'
      });

      // Extract code from response
      const codeBlockRegex = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``, 'i');
      const match = response.content.match(codeBlockRegex);
      return match ? match[1].trim() : response.content.trim();
    } catch (error: unknown) {
      logger.error('Code commenting failed:', error);
      return code; // Return original on failure
    }
  }

  // Default/fallback documentation generators
  private getDefaultREADME(project: any): string {
    return `# ${project.name || 'Project'}

${project.description || 'No description provided.'}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## License

MIT
`;
  }

  private getDefaultAPIDocs(project: any): string {
    return JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: project.name || 'API',
        version: '1.0.0',
        description: project.description || ''
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development' }
      ],
      paths: {}
    }, null, 2);
  }

  private getDefaultUserGuide(project: any): string {
    return `# User Guide: ${project.name || 'Project'}

## Getting Started

Welcome to ${project.name || 'the application'}!

## Features

${project.description || 'No features documented.'}

## Support

For support, please contact the development team.
`;
  }

  private getDefaultDeploymentGuide(project: any, platform: string): string {
    return `# Deployment Guide: ${platform.toUpperCase()}

## Deploying ${project.name || 'Project'} to ${platform}

### Prerequisites
- ${platform} account
- Project code

### Steps
1. Prepare your project
2. Configure ${platform} settings
3. Deploy

For detailed instructions, refer to ${platform} documentation.
`;
  }

  private getDefaultArchitectureDoc(project: any): string {
    return `# Architecture Documentation: ${project.name || 'Project'}

## System Overview

${project.description || 'No architecture documentation available.'}

## Technology Stack

To be documented.

## Architecture Diagram

\`\`\`mermaid
graph TD
    A[User] --> B[Application]
    B --> C[Database]
\`\`\`
`;
  }
}

export const documentationGeneratorService = new DocumentationGeneratorService();




