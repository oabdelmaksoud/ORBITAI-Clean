/**
 * Project Export Service
 * Exports complete projects as downloadable ZIP files with all source code,
 * configuration, documentation, and setup instructions
 */

import { logger } from '../utils/logger.js';
import { Project } from '../models/Project.model.js';
import { CodeGeneratorService, GeneratedFile } from './codeGenerator.service.js';
import { frontendCodeGeneratorService, GeneratedFile as FrontendGeneratedFile } from './frontendCodeGenerator.service.js';
import { codeValidationService } from './codeValidation.service.js';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

// Local instance for code generation
const codeGeneratorService = new CodeGeneratorService();

export interface ExportOptions {
  includeTests?: boolean;
  includeDocumentation?: boolean;
  includeDocker?: boolean;
  includeCICD?: boolean;
  includeEnvTemplate?: boolean;
  format?: 'zip' | 'tar.gz';
  validateCode?: boolean;
}

export interface ExportResult {
  exportId: string;
  projectName: string;
  zipBuffer: Buffer;
  filename: string;
  statistics: {
    totalFiles: number;
    totalSize: number;
    codeFiles: number;
    configFiles: number;
    docFiles: number;
  };
  validation?: {
    valid: boolean;
    score: number;
    errors: number;
    warnings: number;
  };
  generatedAt: Date;
}

export interface ProjectStructure {
  backend?: {
    framework: 'express' | 'fastapi' | 'gin' | 'django' | 'nest';
    language: 'typescript' | 'python' | 'go' | 'java';
    files: GeneratedFile[];
  };
  frontend?: {
    framework: 'react' | 'vue' | 'angular' | 'svelte' | 'nextjs';
    files: GeneratedFile[];
  };
  mobile?: {
    framework: 'react-native' | 'flutter' | 'ionic';
    files: GeneratedFile[];
  };
  infrastructure?: GeneratedFile[];
  documentation?: GeneratedFile[];
}

class ProjectExportService {
  /**
   * Export a complete project as a downloadable ZIP
   */
  async exportProject(
    projectId: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const exportId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info(`📦 Starting project export: ${projectId}`);

      // Fetch project and its artifacts
      const project = await Project.findById(projectId).populate('artifacts').lean();
      if (!project) {
        throw new Error('Project not found');
      }

      // Collect all generated files
      const allFiles: GeneratedFile[] = [];
      const structure = await this.buildProjectStructure(project);

      // Add backend files
      if (structure.backend) {
        allFiles.push(...structure.backend.files.map(f => ({
          ...f,
          path: `backend/${f.path}`,
        })));
      }

      // Add frontend files
      if (structure.frontend) {
        allFiles.push(...structure.frontend.files.map(f => ({
          ...f,
          path: `frontend/${f.path}`,
        })));
      }

      // Add mobile files
      if (structure.mobile) {
        allFiles.push(...structure.mobile.files.map(f => ({
          ...f,
          path: `mobile/${f.path}`,
        })));
      }

      // Add infrastructure files
      if (structure.infrastructure && options.includeDocker !== false) {
        allFiles.push(...structure.infrastructure);
      }

      // Add documentation
      if (options.includeDocumentation !== false) {
        allFiles.push(...this.generateDocumentation(project, structure));
      }

      // Add CI/CD configuration
      if (options.includeCICD !== false) {
        allFiles.push(...this.generateCICDConfigs(project, structure));
      }

      // Add environment templates
      if (options.includeEnvTemplate !== false) {
        allFiles.push(...this.generateEnvTemplates(project, structure));
      }

      // Validate code if requested
      let validation;
      if (options.validateCode) {
        const validationResult = await codeValidationService.validateProject(
          allFiles,
          structure.backend?.language || 'typescript'
        );
        validation = {
          valid: validationResult.valid,
          score: validationResult.qualityScore,
          errors: validationResult.syntaxErrors.filter(e => e.severity === 'error').length,
          warnings: validationResult.syntaxErrors.filter(e => e.severity === 'warning').length +
                   validationResult.lintWarnings.length,
        };
      }

      // Create ZIP
      const zip = new JSZip();
      
      for (const file of allFiles) {
        zip.file(file.path, file.content);
      }

      // Add root README
      zip.file('README.md', this.generateRootReadme(project, structure));

      // Add setup scripts
      zip.file('setup.sh', this.generateSetupScript(project, structure));
      zip.file('setup.bat', this.generateSetupScriptWindows(project, structure));

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      // Calculate statistics
      const statistics = {
        totalFiles: allFiles.length + 3, // +3 for README and setup scripts
        totalSize: zipBuffer.length,
        codeFiles: allFiles.filter(f => 
          f.path.match(/\.(ts|tsx|js|jsx|py|go|java|kt|swift|dart)$/)
        ).length,
        configFiles: allFiles.filter(f => 
          f.path.match(/\.(json|yaml|yml|toml|xml|config\.)/)
        ).length,
        docFiles: allFiles.filter(f => 
          f.path.match(/\.(md|txt|rst|doc)$/)
        ).length,
      };

      const projectName = project.name?.toLowerCase().replace(/\s+/g, '-') || 'project';
      const filename = `${projectName}-${exportId.slice(0, 8)}.zip`;

      logger.info(`✅ Project exported in ${Date.now() - startTime}ms: ${statistics.totalFiles} files, ${(statistics.totalSize / 1024).toFixed(2)} KB`);

      return {
        exportId,
        projectName: project.name || 'Untitled Project',
        zipBuffer,
        filename,
        statistics,
        validation,
        generatedAt: new Date(),
      };
    } catch (error: any) {
      logger.error(`❌ Project export failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build project structure from artifacts
   */
  private async buildProjectStructure(project: any): Promise<ProjectStructure> {
    const structure: ProjectStructure = {};

    // Find code artifacts
    const codeArtifacts = (project.artifacts || []).filter(
      (a: any) => a.type === 'code' || a.type === 'generated'
    );

    // Parse stored code or regenerate
    for (const artifact of codeArtifacts) {
      try {
        const data = JSON.parse(artifact.content || '{}');
        
        if (data.files) {
          // Determine if backend or frontend
          const hasBackendFiles = data.files.some((f: any) => 
            f.path.includes('routes') || f.path.includes('controllers') || 
            f.path.includes('models') || f.path.includes('main.py') ||
            f.path.includes('main.go')
          );

          const hasFrontendFiles = data.files.some((f: any) => 
            f.path.includes('components') || f.path.includes('.vue') ||
            f.path.includes('.tsx') || f.path.includes('App.')
          );

          if (hasBackendFiles) {
            structure.backend = {
              framework: this.detectBackendFramework(data.files),
              language: this.detectLanguage(data.files),
              files: data.files,
            };
          }

          if (hasFrontendFiles) {
            structure.frontend = {
              framework: this.detectFrontendFramework(data.files),
              files: data.files,
            };
          }
        }
      } catch (e) {
        // Not JSON, might be raw code
      }
    }

    // If no generated code found, generate based on project requirements
    if (!structure.backend && !structure.frontend) {
      const generatedStructure = await this.generateProjectCode(project);
      Object.assign(structure, generatedStructure);
    }

    // Generate infrastructure files
    structure.infrastructure = await this.generateInfrastructure(project, structure);

    return structure;
  }

  /**
   * Generate project code from requirements
   */
  private async generateProjectCode(project: any): Promise<Partial<ProjectStructure>> {
    const structure: Partial<ProjectStructure> = {};

    // Analyze project to determine what needs to be generated
    const description = project.description || '';
    const requirements = project.requirements || [];
    const needsBackend = this.projectNeedsBackend(project);
    const needsFrontend = this.projectNeedsFrontend(project);

    // Generate backend if needed
    if (needsBackend) {
      const backendResult = await codeGeneratorService.generateBackendCode({
        projectName: project.name || 'api',
        description: description,
        framework: 'express',
        dataModels: this.extractDataModels(project),
        apiEndpoints: this.extractApiEndpoints(project),
        features: this.extractFeatures(project),
        methodology: project.methodology || 'Agile',
        language: 'typescript',
      });

      if (backendResult.success) {
        structure.backend = {
          framework: 'express',
          language: 'typescript',
          files: backendResult.files,
        };
      }
    }

    // Generate frontend if needed
    if (needsFrontend) {
      const frontendResult = await frontendCodeGeneratorService.generateFrontendCode({
        projectName: project.name || 'app',
        description: description,
        framework: 'react',
        styling: 'tailwind',
        stateManagement: 'zustand',
        components: this.extractComponents(project),
        routes: this.extractRoutes(project),
        features: this.extractFeatures(project),
        apiBaseUrl: 'http://localhost:3000/api',
        language: 'typescript',
      });

      if (frontendResult.success) {
        structure.frontend = {
          framework: 'react',
          files: frontendResult.files,
        };
      }
    }

    return structure;
  }

  /**
   * Generate infrastructure files (Docker, k8s, etc.)
   */
  private async generateInfrastructure(
    project: any,
    structure: ProjectStructure
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const projectName = (project.name || 'project').toLowerCase().replace(/\s+/g, '-');

    // Docker Compose for full stack
    if (structure.backend || structure.frontend) {
      const services: string[] = [];

      if (structure.backend) {
        services.push(`  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/${projectName}
    depends_on:
      - mongo
    networks:
      - app-network`);
      }

      if (structure.frontend) {
        services.push(`  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network`);
      }

      if (structure.backend) {
        services.push(`  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    networks:
      - app-network`);
      }

      files.push({
        path: 'docker-compose.yml',
        content: `version: '3.8'

services:
${services.join('\n\n')}

networks:
  app-network:
    driver: bridge

volumes:
  mongo_data:
`,
        fileType: 'yaml',
      });
    }

    // Makefile for common tasks
    files.push({
      path: 'Makefile',
      content: `# ${project.name || 'Project'} Makefile

.PHONY: install dev build test deploy clean

# Install all dependencies
install:
${structure.backend ? '\tcd backend && npm install' : ''}
${structure.frontend ? '\tcd frontend && npm install' : ''}

# Start development servers
dev:
${structure.backend ? '\tcd backend && npm run dev &' : ''}
${structure.frontend ? '\tcd frontend && npm run dev' : ''}

# Build for production
build:
${structure.backend ? '\tcd backend && npm run build' : ''}
${structure.frontend ? '\tcd frontend && npm run build' : ''}

# Run tests
test:
${structure.backend ? '\tcd backend && npm test' : ''}
${structure.frontend ? '\tcd frontend && npm test' : ''}

# Deploy with Docker
deploy:
\tdocker-compose up -d --build

# Clean build artifacts
clean:
${structure.backend ? '\trm -rf backend/dist backend/node_modules' : ''}
${structure.frontend ? '\trm -rf frontend/dist frontend/node_modules' : ''}
`,
      fileType: 'yaml',
    });

    // Nginx config for production
    if (structure.frontend) {
      files.push({
        path: 'nginx.conf',
        content: `server {
    listen 80;
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
`,
        fileType: 'yaml',
      });
    }

    return files;
  }

  /**
   * Generate documentation files
   */
  private generateDocumentation(
    project: any,
    structure: ProjectStructure
  ): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // API documentation
    if (structure.backend) {
      files.push({
        path: 'docs/API.md',
        content: `# API Documentation

## Base URL

\`\`\`
http://localhost:3000/api
\`\`\`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

## Endpoints

${this.generateApiDocs(project)}

## Error Responses

All error responses follow this format:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`

## Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 500  | Internal Server Error |
`,
        fileType: 'markdown',
      });
    }

    // Architecture documentation
    files.push({
      path: 'docs/ARCHITECTURE.md',
      content: `# Architecture Documentation

## Overview

${project.description || 'Project description goes here.'}

## Stack

${structure.backend ? `### Backend
- **Framework:** ${structure.backend.framework}
- **Language:** ${structure.backend.language}
- **Database:** MongoDB
` : ''}

${structure.frontend ? `### Frontend
- **Framework:** ${structure.frontend.framework}
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
` : ''}

## Project Structure

\`\`\`
${this.generateDirectoryTree(structure)}
\`\`\`

## Data Flow

\`\`\`
[Client] → [Frontend (React)] → [API (Express)] → [Database (MongoDB)]
\`\`\`

## Security

- JWT-based authentication
- CORS configured for frontend origin
- Input validation on all endpoints
- Password hashing with bcrypt
- Environment variables for secrets

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.
`,
      fileType: 'markdown',
    });

    // Deployment documentation
    files.push({
      path: 'docs/DEPLOYMENT.md',
      content: `# Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- MongoDB (or use Docker)

## Local Development

\`\`\`bash
# Install dependencies
make install

# Start development servers
make dev
\`\`\`

## Docker Deployment

\`\`\`bash
# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
\`\`\`

## Cloud Deployment

### Vercel (Frontend)

\`\`\`bash
cd frontend
vercel deploy
\`\`\`

### Railway (Backend)

\`\`\`bash
cd backend
railway up
\`\`\`

### AWS

1. Build Docker images
2. Push to ECR
3. Deploy to ECS or App Runner

See CI/CD workflows in \`.github/workflows/\` for automated deployment.

## Environment Variables

Copy \`.env.example\` to \`.env\` and configure all variables.

### Required Variables

| Variable | Description |
|----------|-------------|
| MONGODB_URI | MongoDB connection string |
| JWT_SECRET | Secret for JWT tokens |
| PORT | Server port (default: 3000) |

## Monitoring

- Health check: \`GET /health\`
- Logs: \`docker-compose logs\`
`,
      fileType: 'markdown',
    });

    // Contributing guide
    files.push({
      path: 'docs/CONTRIBUTING.md',
      content: `# Contributing Guide

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Code Style

- Use ESLint/Prettier for formatting
- Follow conventional commits
- Write tests for new features

## Pull Request Process

1. Update documentation
2. Add tests
3. Ensure CI passes
4. Request review
`,
      fileType: 'markdown',
    });

    return files;
  }

  /**
   * Generate CI/CD configuration files
   */
  private generateCICDConfigs(
    project: any,
    structure: ProjectStructure
  ): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // GitHub Actions CI
    files.push({
      path: '.github/workflows/ci.yml',
      content: `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongo:
        image: mongo:6
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

${structure.backend ? `      - name: Install backend dependencies
        run: cd backend && npm ci

      - name: Run backend tests
        run: cd backend && npm test
        env:
          MONGODB_URI: mongodb://localhost:27017/test
          JWT_SECRET: test-secret

      - name: Build backend
        run: cd backend && npm run build
` : ''}

${structure.frontend ? `      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Run frontend tests
        run: cd frontend && npm test

      - name: Build frontend
        run: cd frontend && npm run build
` : ''}
`,
      fileType: 'yaml',
    });

    // GitHub Actions Deploy
    files.push({
      path: '.github/workflows/deploy.yml',
      content: `name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

${structure.backend ? `      - name: Deploy Backend
        run: |
          cd backend
          npm ci
          npm run build
        # Add deployment commands here
` : ''}

${structure.frontend ? `      - name: Deploy Frontend
        run: |
          cd frontend
          npm ci
          npm run build
        # Add deployment commands here
` : ''}
`,
      fileType: 'yaml',
    });

    return files;
  }

  /**
   * Generate environment templates
   */
  private generateEnvTemplates(
    project: any,
    structure: ProjectStructure
  ): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    if (structure.backend) {
      files.push({
        path: 'backend/.env.example',
        content: `# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/${(project.name || 'app').toLowerCase().replace(/\s+/g, '-')}

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:5173

# External APIs (if needed)
# API_KEY=your-api-key
`,
        fileType: 'yaml',
      });
    }

    if (structure.frontend) {
      files.push({
        path: 'frontend/.env.example',
        content: `# API Configuration
VITE_API_URL=http://localhost:3000/api

# App Configuration
VITE_APP_NAME=${project.name || 'App'}
VITE_APP_VERSION=0.1.0

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
`,
        fileType: 'yaml',
      });
    }

    return files;
  }

  /**
   * Generate root README
   */
  private generateRootReadme(project: any, structure: ProjectStructure): string {
    return `# ${project.name || 'Project'}

${project.description || 'Project description goes here.'}

## Quick Start

\`\`\`bash
# Setup (Unix/Mac)
chmod +x setup.sh && ./setup.sh

# Setup (Windows)
setup.bat
\`\`\`

## Project Structure

\`\`\`
${this.generateDirectoryTree(structure)}
\`\`\`

## Development

${structure.backend ? `### Backend
\`\`\`bash
cd backend
npm install
npm run dev
\`\`\`
` : ''}

${structure.frontend ? `### Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
` : ''}

## Docker

\`\`\`bash
docker-compose up -d
\`\`\`

## Documentation

- [API Documentation](./docs/API.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Contributing](./docs/CONTRIBUTING.md)

## License

MIT

---

*Generated by OrbitAI*
`;
  }

  /**
   * Generate setup script (Unix)
   */
  private generateSetupScript(project: any, structure: ProjectStructure): string {
    return `#!/bin/bash

echo "🚀 Setting up ${project.name || 'Project'}..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install it first."
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required. Please install it first."
    exit 1
fi

${structure.backend ? `
# Setup backend
echo "📦 Installing backend dependencies..."
cd backend
npm install
cp .env.example .env
echo "✅ Backend setup complete"
cd ..
` : ''}

${structure.frontend ? `
# Setup frontend
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cp .env.example .env.local
echo "✅ Frontend setup complete"
cd ..
` : ''}

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start development:"
${structure.backend ? 'echo "  Backend: cd backend && npm run dev"' : ''}
${structure.frontend ? 'echo "  Frontend: cd frontend && npm run dev"' : ''}
echo ""
echo "Or use Docker:"
echo "  docker-compose up -d"
`;
  }

  /**
   * Generate setup script (Windows)
   */
  private generateSetupScriptWindows(project: any, structure: ProjectStructure): string {
    return `@echo off
echo Setting up ${project.name || 'Project'}...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is required. Please install it first.
    exit /b 1
)

${structure.backend ? `
echo Installing backend dependencies...
cd backend
call npm install
copy .env.example .env
echo Backend setup complete
cd ..
` : ''}

${structure.frontend ? `
echo Installing frontend dependencies...
cd frontend
call npm install
copy .env.example .env.local
echo Frontend setup complete
cd ..
` : ''}

echo.
echo Setup complete!
echo.
echo To start development:
${structure.backend ? 'echo   Backend: cd backend && npm run dev' : ''}
${structure.frontend ? 'echo   Frontend: cd frontend && npm run dev' : ''}
`;
  }

  // ============ Helper Methods ============

  private projectNeedsBackend(project: any): boolean {
    const description = (project.description || '').toLowerCase();
    const requirements = (project.requirements || []).join(' ').toLowerCase();
    const combined = description + ' ' + requirements;

    return combined.includes('api') || combined.includes('backend') ||
           combined.includes('server') || combined.includes('database') ||
           combined.includes('authentication') || combined.includes('user');
  }

  private projectNeedsFrontend(project: any): boolean {
    const description = (project.description || '').toLowerCase();
    const requirements = (project.requirements || []).join(' ').toLowerCase();
    const combined = description + ' ' + requirements;

    return combined.includes('web') || combined.includes('frontend') ||
           combined.includes('ui') || combined.includes('interface') ||
           combined.includes('dashboard') || combined.includes('app');
  }

  private extractDataModels(project: any): any[] {
    // Default models based on common requirements
    return [
      {
        name: 'User',
        fields: [
          { name: 'email', type: 'email', required: true, unique: true },
          { name: 'password', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'role', type: 'string', default: 'user' },
        ],
      },
    ];
  }

  private extractApiEndpoints(project: any): any[] {
    return [
      { method: 'POST', path: '/auth/register', description: 'Register new user' },
      { method: 'POST', path: '/auth/login', description: 'Login user' },
      { method: 'GET', path: '/users/me', description: 'Get current user', authenticated: true },
      { method: 'PUT', path: '/users/me', description: 'Update current user', authenticated: true },
    ];
  }

  private extractFeatures(project: any): string[] {
    return ['User authentication', 'JWT tokens', 'Password hashing'];
  }

  private extractComponents(project: any): any[] {
    return [
      { name: 'Home', type: 'page', description: 'Home page' },
      { name: 'Login', type: 'page', description: 'Login page' },
      { name: 'Dashboard', type: 'page', description: 'Dashboard page' },
      { name: 'Header', type: 'component', description: 'Navigation header' },
      { name: 'Footer', type: 'component', description: 'Page footer' },
    ];
  }

  private extractRoutes(project: any): any[] {
    return [
      { path: '/', component: 'Home', name: 'Home' },
      { path: '/login', component: 'Login', name: 'Login' },
      { path: '/dashboard', component: 'Dashboard', name: 'Dashboard', protected: true },
    ];
  }

  private detectBackendFramework(files: any[]): 'express' | 'fastapi' | 'gin' | 'django' | 'nest' {
    const paths = files.map(f => f.path).join(' ');
    if (paths.includes('.py') || paths.includes('requirements.txt')) {
      return paths.includes('fastapi') ? 'fastapi' : 'django';
    }
    if (paths.includes('.go')) return 'gin';
    if (paths.includes('nest')) return 'nest';
    return 'express';
  }

  private detectLanguage(files: any[]): 'typescript' | 'python' | 'go' | 'java' {
    const paths = files.map(f => f.path).join(' ');
    if (paths.includes('.py')) return 'python';
    if (paths.includes('.go')) return 'go';
    if (paths.includes('.java')) return 'java';
    return 'typescript';
  }

  private detectFrontendFramework(files: any[]): 'react' | 'vue' | 'angular' | 'svelte' | 'nextjs' {
    const paths = files.map(f => f.path).join(' ');
    if (paths.includes('.vue')) return 'vue';
    if (paths.includes('angular')) return 'angular';
    if (paths.includes('.svelte')) return 'svelte';
    if (paths.includes('app/') && paths.includes('layout.tsx')) return 'nextjs';
    return 'react';
  }

  private generateApiDocs(project: any): string {
    const endpoints = this.extractApiEndpoints(project);
    return endpoints.map(e => `### ${e.method} ${e.path}

${e.description}

${e.authenticated ? '🔒 **Requires authentication**\n' : ''}
**Request:**
\`\`\`json
{
  // Request body
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {}
}
\`\`\`
`).join('\n');
  }

  private generateDirectoryTree(structure: ProjectStructure): string {
    const lines: string[] = ['.'];
    
    if (structure.backend) {
      lines.push('├── backend/');
      lines.push('│   ├── src/');
      lines.push('│   ├── tests/');
      lines.push('│   ├── package.json');
      lines.push('│   └── Dockerfile');
    }
    
    if (structure.frontend) {
      lines.push('├── frontend/');
      lines.push('│   ├── src/');
      lines.push('│   ├── public/');
      lines.push('│   ├── package.json');
      lines.push('│   └── Dockerfile');
    }
    
    lines.push('├── docs/');
    lines.push('├── .github/');
    lines.push('├── docker-compose.yml');
    lines.push('├── Makefile');
    lines.push('└── README.md');
    
    return lines.join('\n');
  }
}

export const projectExportService = new ProjectExportService();
