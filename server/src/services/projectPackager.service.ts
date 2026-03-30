/**
 * Project Packager Service
 * Generates Docker configs, build scripts, deployment configs, and packages
 * complete projects for deployment
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { llmRouter } from './llm/LLMRouter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProjectPackage {
  zipBuffer: Buffer;
  files: PackageFile[];
  metadata: {
    projectName: string;
    projectId: string;
    packageDate: string;
    version: string;
  };
}

export interface PackageFile {
  path: string;
  content: string;
  type: 'code' | 'config' | 'documentation' | 'script';
}

export interface DockerConfig {
  dockerfile: string;
  dockerCompose?: string;
  dockerIgnore: string;
}

export interface BuildScripts {
  packageJson?: string;
  buildSh?: string;
  buildBat?: string;
  requirementsTxt?: string;
  pomXml?: string;
  goMod?: string;
}

export interface DeploymentConfigs {
  vercel?: string;
  railway?: string;
  render?: string;
  netlify?: string;
  docker?: DockerConfig;
  kubernetes?: string;
  serverless?: Record<string, string>; // Platform-specific serverless configs
}

class ProjectPackagerService {
  /**
   * Package complete project with all necessary files
   */
  async packageProject(projectId: string): Promise<ProjectPackage> {
    try {
      logger.info(`Packaging project: ${projectId}`);

      const project = await Project.findById(projectId).lean();
      if (!project) {
        throw new Error('Project not found');
      }

      const files: PackageFile[] = [];

      // 1. Add all artifacts as source files
      if (project.artifacts && Array.isArray(project.artifacts)) {
        for (const artifact of project.artifacts) {
          if (artifact.type === 'code' || artifact.type === 'notebook') {
            const filePath = this.determineFilePath(artifact);
            files.push({
              path: filePath,
              content: artifact.content || '',
              type: 'code'
            });
          }
        }
      }

      // 2. Generate Docker configs
      const dockerConfig = await this.generateDockerConfig(project);
      files.push({
        path: 'Dockerfile',
        content: dockerConfig.dockerfile,
        type: 'config'
      });
      if (dockerConfig.dockerIgnore) {
        files.push({
          path: '.dockerignore',
          content: dockerConfig.dockerIgnore,
          type: 'config'
        });
      }
      if (dockerConfig.dockerCompose) {
        files.push({
          path: 'docker-compose.yml',
          content: dockerConfig.dockerCompose,
          type: 'config'
        });
      }

      // 3. Generate build scripts
      const buildScripts = await this.generateBuildScripts(project);
      if (buildScripts.packageJson) {
        files.push({
          path: 'package.json',
          content: buildScripts.packageJson,
          type: 'script'
        });
      }
      if (buildScripts.buildSh) {
        files.push({
          path: 'build.sh',
          content: buildScripts.buildSh,
          type: 'script'
        });
      }
      if (buildScripts.requirementsTxt) {
        files.push({
          path: 'requirements.txt',
          content: buildScripts.requirementsTxt,
          type: 'script'
        });
      }

      // 4. Generate deployment configs
      const deploymentConfigs = await this.generateDeploymentConfigs(project, [
        'vercel',
        'railway',
        'render',
        'netlify'
      ]);
      if (deploymentConfigs.vercel) {
        files.push({
          path: 'vercel.json',
          content: deploymentConfigs.vercel,
          type: 'config'
        });
      }
      if (deploymentConfigs.railway) {
        files.push({
          path: 'railway.json',
          content: deploymentConfigs.railway,
          type: 'config'
        });
      }
      if (deploymentConfigs.render) {
        files.push({
          path: 'render.yaml',
          content: deploymentConfigs.render,
          type: 'config'
        });
      }
      if (deploymentConfigs.netlify) {
        files.push({
          path: 'netlify.toml',
          content: deploymentConfigs.netlify,
          type: 'config'
        });
      }

      // 5. Generate environment template
      const envTemplate = await this.generateEnvTemplate(project);
      files.push({
        path: '.env.example',
        content: envTemplate,
        type: 'config'
      });

      // 6. Generate CI/CD configs
      const cicdConfigs = await this.generateCICDConfigs(project);
      files.push({
        path: '.github/workflows/deploy.yml',
        content: cicdConfigs.githubActions || '',
        type: 'config'
      });

      // 7. Create ZIP package
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.path, file.content);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      return {
        zipBuffer,
        files,
        metadata: {
          projectName: project.name || 'Untitled Project',
          projectId: projectId,
          packageDate: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error: any) {
      logger.error('Project packaging failed:', error);
      throw error;
    }
  }

  /**
   * Generate Docker configuration
   */
  async generateDockerConfig(project: any): Promise<DockerConfig> {
    try {
      const projectType = project.projectType || 'web-app';
      const hasBackend = project.architecture?.needsBackend || false;
      const backendType = project.architecture?.backendType || 'REST';
      const framework = project.architecture?.recommendations?.backend?.framework || 'node';

      let dockerfile = '';
      let dockerCompose = '';

      // Generate Dockerfile based on project type
      if (framework.includes('node') || framework.includes('express')) {
        dockerfile = this.generateNodeDockerfile(project);
      } else if (framework.includes('python') || framework.includes('django') || framework.includes('flask')) {
        dockerfile = this.generatePythonDockerfile(project);
      } else if (framework.includes('react') || framework.includes('next')) {
        dockerfile = this.generateReactDockerfile(project);
      } else {
        dockerfile = this.generateGenericDockerfile(project);
      }

      // Generate docker-compose if needed
      if (hasBackend) {
        dockerCompose = this.generateDockerCompose(project);
      }

      const dockerIgnore = this.generateDockerIgnore(project);

      return {
        dockerfile,
        dockerCompose: dockerCompose || undefined,
        dockerIgnore
      };
    } catch (error: any) {
      logger.error('Docker config generation failed:', error);
      return {
        dockerfile: this.getDefaultDockerfile(),
        dockerIgnore: this.getDefaultDockerIgnore()
      };
    }
  }

  /**
   * Generate build scripts
   */
  async generateBuildScripts(project: any): Promise<BuildScripts> {
    const scripts: BuildScripts = {};
    const projectType = project.projectType || 'web-app';
    const framework = project.architecture?.recommendations?.backend?.framework || 'node';

    if (framework.includes('node') || framework.includes('express') || framework.includes('react')) {
      scripts.packageJson = this.generatePackageJson(project);
      scripts.buildSh = this.generateBuildSh(project);
    } else if (framework.includes('python')) {
      scripts.requirementsTxt = this.generateRequirementsTxt(project);
      scripts.buildSh = this.generatePythonBuildSh(project);
    }

    return scripts;
  }

  /**
   * Generate deployment configs for multiple platforms
   */
  async generateDeploymentConfigs(
    project: any,
    platforms: string[]
  ): Promise<DeploymentConfigs> {
    const configs: DeploymentConfigs = {};

    for (const platform of platforms) {
      try {
        switch (platform) {
          case 'vercel':
            configs.vercel = this.generateVercelConfig(project);
            break;
          case 'railway':
            configs.railway = this.generateRailwayConfig(project);
            break;
          case 'render':
            configs.render = this.generateRenderConfig(project);
            break;
          case 'netlify':
            configs.netlify = this.generateNetlifyConfig(project);
            break;
        }
      } catch (error: any) {
        logger.error(`Failed to generate ${platform} config:`, error);
      }
    }

    // Generate Docker config
    const dockerConfig = await this.generateDockerConfig(project);
    configs.docker = dockerConfig;

    return configs;
  }

  /**
   * Generate environment variable template
   */
  private async generateEnvTemplate(project: any): Promise<string> {
    const hasBackend = project.architecture?.needsBackend || false;
    const hasDatabase = project.architecture?.detectedFeatures?.dataStorage || false;
    const hasAuth = project.architecture?.detectedFeatures?.authentication || false;

    let template = `# Environment Variables Template
# Copy this file to .env and fill in your values

# Application
NODE_ENV=production
PORT=3000
`;

    if (hasDatabase) {
      template += `
# Database
DATABASE_URL=your_database_connection_string
MONGODB_URI=your_mongodb_connection_string
`;
    }

    if (hasAuth) {
      template += `
# Authentication
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
`;
    }

    template += `
# API Keys (if needed)
# GEMINI_API_KEY=your_key
# OPENAI_API_KEY=your_key
`;

    return template;
  }

  /**
   * Generate CI/CD configuration
   */
  private async generateCICDConfigs(project: any): Promise<{ githubActions?: string }> {
    const githubActions = `name: Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
      - name: Test
        run: npm test
      - name: Deploy
        run: echo "Deploy to production"
`;

    return { githubActions };
  }

  // Helper methods for generating specific configs
  private generateNodeDockerfile(project: any): string {
    return `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
`;
  }

  private generatePythonDockerfile(project: any): string {
    return `FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["python", "app.py"]
`;
  }

  private generateReactDockerfile(project: any): string {
    return `# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateGenericDockerfile(project: any): string {
    return `FROM node:18-alpine

WORKDIR /app

COPY . .

RUN npm install && npm run build

EXPOSE 3000

CMD ["npm", "start"]
`;
  }

  private generateDockerCompose(project: any): string {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db

  db:
    image: mongo:7
    volumes:
      - db-data:/data/db
    ports:
      - "27017:27017"

volumes:
  db-data:
`;
  }

  private generateDockerIgnore(project: any): string {
    return `node_modules
npm-debug.log
.env
.env.local
.DS_Store
dist
build
.git
.gitignore
README.md
*.md
.vscode
.idea
`;
  }

  private generatePackageJson(project: any): string {
    const hasBackend = project.architecture?.needsBackend || false;
    const framework = project.architecture?.recommendations?.backend?.framework || 'express';

    return JSON.stringify({
      name: (project.name || 'project').toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: project.description || '',
      main: hasBackend ? 'server/index.js' : 'src/index.js',
      scripts: {
        start: hasBackend ? 'node server/index.js' : 'npm run dev',
        dev: hasBackend ? 'nodemon server/index.js' : 'vite',
        build: hasBackend ? 'tsc && npm run build:server' : 'vite build',
        test: 'jest',
        'build:server': hasBackend ? 'cd server && npm run build' : undefined
      },
      dependencies: {
        ...(hasBackend ? {
          'express': '^4.18.2',
          'mongoose': '^8.0.3',
          'cors': '^2.8.5',
          'dotenv': '^16.3.1'
        } : {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        })
      },
      devDependencies: {
        ...(hasBackend ? {
          '@types/express': '^4.17.21',
          '@types/node': '^20.10.0',
          'typescript': '^5.3.3',
          'nodemon': '^3.0.2'
        } : {
          '@vitejs/plugin-react': '^4.2.1',
          'vite': '^5.0.8',
          'typescript': '^5.3.3'
        }),
        'jest': '^29.7.0'
      }
    }, null, 2);
  }

  private generateBuildSh(project: any): string {
    return `#!/bin/bash

set -e

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Running tests..."
npm test

echo "Build complete!"
`;
  }

  private generatePythonBuildSh(project: any): string {
    return `#!/bin/bash

set -e

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Running tests..."
pytest

echo "Build complete!"
`;
  }

  private generateRequirementsTxt(project: any): string {
    return `flask==3.0.0
python-dotenv==1.0.0
`;
  }

  private generateVercelConfig(project: any): string {
    return JSON.stringify({
      version: 2,
      builds: [
        {
          src: 'package.json',
          use: '@vercel/node'
        }
      ],
      routes: [
        {
          src: '/(.*)',
          dest: '/'
        }
      ]
    }, null, 2);
  }

  private generateRailwayConfig(project: any): string {
    return JSON.stringify({
      $schema: 'https://railway.app/railway.schema.json',
      build: {
        builder: 'NIXPACKS'
      },
      deploy: {
        startCommand: 'npm start',
        restartPolicyType: 'ON_FAILURE',
        restartPolicyMaxRetries: 10
      }
    }, null, 2);
  }

  private generateRenderConfig(project: any): string {
    return `services:
  - type: web
    name: ${project.name || 'app'}
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
`;
  }

  private generateNetlifyConfig(project: any): string {
    return `[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
  }

  private determineFilePath(artifact: any): string {
    const title = artifact.title || 'untitled';
    const type = artifact.type;

    // Determine directory based on artifact type
    let dir = 'src';
    if (type === 'requirement') dir = 'docs/requirements';
    else if (type === 'design') dir = 'docs/design';
    else if (type === 'test-plan') dir = 'docs/tests';
    else if (type === 'notebook') dir = 'notebooks';

    // Determine extension
    let ext = '.ts';
    if (title.includes('.js')) ext = '.js';
    else if (title.includes('.tsx')) ext = '.tsx';
    else if (title.includes('.jsx')) ext = '.jsx';
    else if (title.includes('.py')) ext = '.py';
    else if (title.includes('.java')) ext = '.java';
    else if (type === 'notebook') ext = '.ipynb';
    else if (type === 'requirement' || type === 'design') ext = '.md';

    return `${dir}/${title}${!title.includes('.') ? ext : ''}`;
  }

  private getDefaultDockerfile(): string {
    return `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
`;
  }

  private getDefaultDockerIgnore(): string {
    return `node_modules
.env
.git
dist
build
`;
  }
}

export const projectPackagerService = new ProjectPackagerService();




