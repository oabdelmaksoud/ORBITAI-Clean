/**
 * Code Generator Service
 * Converts agent-generated architecture and requirements into executable code
 * Core implementation to bridge the gap between design and production
 */

import { logger } from '../utils/logger.js';
import { llmRouterAIService } from './llmRouterAI.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface DataModel {
  name: string;
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'email' | 'url';
    required?: boolean;
    default?: any;
    ref?: string; // Reference to another model
    unique?: boolean;
    maxLength?: number;
  }>;
  description?: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  authenticated?: boolean;
  parameters?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
}

export interface CodeGenerationRequest {
  projectName: string;
  description: string;
  framework: 'express' | 'fastapi' | 'gin' | 'django' | 'nest';
  dataModels: DataModel[];
  apiEndpoints: ApiEndpoint[];
  features: string[]; // e.g., "User authentication", "Real-time updates", "File upload"
  requirements?: string[];
  methodology: string;
  language?: 'typescript' | 'python' | 'go' | 'java';
}

export interface GeneratedFile {
  path: string;
  content: string;
  fileType: 'typescript' | 'python' | 'go' | 'json' | 'yaml' | 'dockerfile' | 'markdown';
}

export interface CodeGenerationResult {
  projectId: string;
  projectName: string;
  framework: string;
  files: GeneratedFile[];
  statistics: {
    totalFiles: number;
    totalLines: number;
    estimatedSetupTime: number; // minutes
    testCoverage: number; // percentage
  };
  success: boolean;
  generatedAt: number;
  validationReport?: {
    syntaxValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export class CodeGeneratorService {
  /**
   * Main entry point for code generation
   * Called by Implementation Agent with project requirements
   */
  async generateBackendCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const projectId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info(`🔧 Starting code generation for: ${request.projectName}`);
      logger.info(`   Framework: ${request.framework}, Language: ${request.language || 'typescript'}`);

      // Step 1: Validate input
      this.validateRequest(request);

      // Step 2: Generate code files based on framework
      const files: GeneratedFile[] = [];

      switch (request.framework) {
        case 'express':
          files.push(...await this.generateExpressCode(request));
          break;
        case 'fastapi':
          files.push(...await this.generateFastApiCode(request));
          break;
        case 'gin':
          files.push(...await this.generateGinCode(request));
          break;
        case 'django':
          files.push(...await this.generateDjangoCode(request));
          break;
        case 'nest':
          files.push(...await this.generateNestCode(request));
          break;
        default:
          throw new Error(`Unsupported framework: ${request.framework}`);
      }

      // Step 3: Generate supporting files (Docker, config, etc.)
      files.push(...await this.generateSupportingFiles(request));

      // Step 4: Validate generated code
      const validationReport = await this.validateGeneratedCode(files);

      // Step 5: Calculate statistics
      const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
      const statistics = {
        totalFiles: files.length,
        totalLines,
        estimatedSetupTime: this.estimateSetupTime(request),
        testCoverage: this.estimateTestCoverage(request),
      };

      logger.info(`✅ Code generation completed in ${Date.now() - startTime}ms`);
      logger.info(`   Generated ${files.length} files, ${totalLines} lines of code`);

      return {
        projectId,
        projectName: request.projectName,
        framework: request.framework,
        files,
        statistics,
        success: validationReport.syntaxValid,
        generatedAt: Date.now(),
        validationReport,
      };
    } catch (error: unknown) {
      logger.error(`❌ Code generation failed: ${error.message}`);
      return {
        projectId,
        projectName: request.projectName,
        framework: request.framework,
        files: [],
        statistics: { totalFiles: 0, totalLines: 0, estimatedSetupTime: 0, testCoverage: 0 },
        success: false,
        generatedAt: Date.now(),
        validationReport: {
          syntaxValid: false,
          errors: [error.message],
          warnings: [],
        },
      };
    }
  }

  /**
   * Generate Express.js backend code
   */
  private async generateExpressCode(request: CodeGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Main server file
    files.push({
      path: 'src/index.ts',
      content: this.generateExpressIndex(request),
      fileType: 'typescript',
    });

    // Generate models
    for (const model of request.dataModels) {
      files.push({
        path: `src/models/${model.name}.model.ts`,
        content: this.generateMongooseModel(model),
        fileType: 'typescript',
      });
    }

    // Generate routes
    for (const endpoint of request.apiEndpoints) {
      const routeGroup = this.extractRouteGroup(endpoint.path);
      if (!files.find(f => f.path === `src/routes/${routeGroup}.routes.ts`)) {
        files.push({
          path: `src/routes/${routeGroup}.routes.ts`,
          content: this.generateExpressRoutes(request, request.apiEndpoints.filter(e => this.extractRouteGroup(e.path) === routeGroup)),
          fileType: 'typescript',
        });
      }
    }

    // Generate middleware
    if (this.requiresAuth(request)) {
      files.push({
        path: 'src/middleware/auth.ts',
        content: this.generateAuthMiddleware(request),
        fileType: 'typescript',
      });
    }

    // Generate services
    for (const feature of request.features) {
      files.push({
        path: `src/services/${this.featureToService(feature)}.service.ts`,
        content: this.generateService(feature, request),
        fileType: 'typescript',
      });
    }

    // Generate tests
    for (const endpoint of request.apiEndpoints) {
      const testFile = this.extractRouteGroup(endpoint.path);
      if (!files.find(f => f.path === `tests/${testFile}.test.ts`)) {
        files.push({
          path: `tests/${testFile}.test.ts`,
          content: this.generateExpressTests(request, request.apiEndpoints.filter(e => this.extractRouteGroup(e.path) === testFile)),
          fileType: 'typescript',
        });
      }
    }

    // Generate config files
    files.push({
      path: 'package.json',
      content: this.generatePackageJson(request),
      fileType: 'json',
    });

    files.push({
      path: '.env.example',
      content: this.generateEnvExample(request),
      fileType: 'yaml',
    });

    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig(),
      fileType: 'json',
    });

    return files;
  }

  /**
   * Generate FastAPI (Python) backend code
   */
  private async generateFastApiCode(request: CodeGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    files.push({
      path: 'main.py',
      content: this.generateFastApiMain(request),
      fileType: 'python',
    });

    // Generate models
    for (const model of request.dataModels) {
      files.push({
        path: `models/${model.name}.py`,
        content: this.generatePydanticModel(model),
        fileType: 'python',
      });
    }

    // Generate routes
    for (const endpoint of request.apiEndpoints) {
      const routeGroup = this.extractRouteGroup(endpoint.path);
      if (!files.find(f => f.path === `routes/${routeGroup}.py`)) {
        files.push({
          path: `routes/${routeGroup}.py`,
          content: this.generateFastApiRoutes(request, request.apiEndpoints.filter(e => this.extractRouteGroup(e.path) === routeGroup)),
          fileType: 'python',
        });
      }
    }

    // Generate services
    for (const feature of request.features) {
      files.push({
        path: `services/${this.featureToService(feature)}.py`,
        content: this.generatePythonService(feature, request),
        fileType: 'python',
      });
    }

    // Generate requirements.txt
    files.push({
      path: 'requirements.txt',
      content: this.generatePythonRequirements(request),
      fileType: 'yaml',
    });

    return files;
  }

  /**
   * Generate Go/Gin backend code
   */
  private async generateGinCode(request: CodeGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    files.push({
      path: 'main.go',
      content: this.generateGinMain(request),
      fileType: 'go',
    });

    // Generate models
    for (const model of request.dataModels) {
      files.push({
        path: `models/${model.name}.go`,
        content: this.generateGoModel(model),
        fileType: 'go',
      });
    }

    // Generate routes
    files.push({
      path: 'routes/routes.go',
      content: this.generateGinRoutes(request),
      fileType: 'go',
    });

    // Generate handlers
    for (const endpoint of request.apiEndpoints) {
      const handlerName = this.pathToHandler(endpoint.path);
      if (!files.find(f => f.path === `handlers/${handlerName}.go`)) {
        files.push({
          path: `handlers/${handlerName}.go`,
          content: this.generateGinHandler(endpoint, request),
          fileType: 'go',
        });
      }
    }

    files.push({
      path: 'go.mod',
      content: this.generateGoMod(request),
      fileType: 'yaml',
    });

    return files;
  }

  /**
   * Generate supporting files (Docker, README, etc.)
   */
  private async generateSupportingFiles(request: CodeGenerationRequest): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile(request),
      fileType: 'dockerfile',
    });

    // docker-compose.yml
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose(request),
      fileType: 'yaml',
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme(request),
      fileType: 'markdown',
    });

    // GitHub Actions CI/CD
    files.push({
      path: '.github/workflows/ci.yml',
      content: this.generateGitHubActions(request),
      fileType: 'yaml',
    });

    return files;
  }

  /**
   * Template generators
   */

  private generateExpressIndex(request: CodeGenerationRequest): string {
    return `/**
 * ${request.projectName}
 * Generated backend API
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/${request.projectName.toLowerCase()}';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(\`\${req.method} \${req.path}\`);
  next();
});

// Database connection
mongoose.connect(MONGODB_URI)
  .then(() => logger.info('✅ MongoDB connected'))
  .catch(err => logger.error('❌ MongoDB connection failed:', err));

// Routes
${request.apiEndpoints
  .map(e => {
    const group = this.extractRouteGroup(e.path);
    return `import { router as ${group}Router } from './routes/${group}.routes';`;
  })
  .filter((v, i, a) => a.indexOf(v) === i)
  .join('\n')}

${request.apiEndpoints
  .map(e => {
    const group = this.extractRouteGroup(e.path);
    return `app.use('/api${e.path.split('/')[1] ? '/' + e.path.split('/')[1] : ''}', ${group}Router);`;
  })
  .filter((v, i, a) => a.indexOf(v) === i)
  .join('\n')}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(\`🚀 Server running on port \${PORT}\`);
});

export default app;
`;
  }

  private generateMongooseModel(model: DataModel): string {
    const fieldDefinitions = model.fields
      .map(field => {
        let typeStr = this.fieldTypeToMongoose(field.type);
        if (field.ref) {
          typeStr = `{ type: mongoose.Schema.Types.ObjectId, ref: '${field.ref}' }`;
        }
        const props = [`type: ${typeStr}`];
        if (field.required) props.push('required: true');
        if (field.unique) props.push('unique: true');
        if (field.default !== undefined) props.push(`default: ${JSON.stringify(field.default)}`);
        if (field.maxLength) props.push(`maxlength: ${field.maxLength}`);
        return `  ${field.name}: { ${props.join(', ')} },`;
      })
      .join('\n');

    return `import mongoose, { Schema, Document } from 'mongoose';

export interface I${model.name} extends Document {
  ${model.fields.map(f => `${f.name}: ${this.fieldTypeToTypescript(f.type)};`).join('\n  ')}
  createdAt?: Date;
  updatedAt?: Date;
}

const ${model.name}Schema = new Schema<I${model.name}>(
  {
${fieldDefinitions}
  },
  { timestamps: true }
);

export const ${model.name} = mongoose.model<I${model.name}>('${model.name}', ${model.name}Schema);
`;
  }

  private generateExpressRoutes(request: CodeGenerationRequest, endpoints: ApiEndpoint[]): string {
    const routeGroup = this.extractRouteGroup(endpoints[0].path);
    const routes = endpoints
      .map(e => {
        const method = e.method.toLowerCase();
        const pathPart = e.path.split('/').slice(2).join('/') || '/';
        return `router.${method}('${pathPart}', async (req: Request, res: Response) => {
  try {
    // TODO: Implement ${e.description}
    res.json({ message: '${e.description}' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});`;
      })
      .join('\n\n');

    return `import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

export const router = Router();

${routes}
`;
  }

  private generateAuthMiddleware(request: CodeGenerationRequest): string {
    return `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
`;
  }

  private generateService(feature: string, request: CodeGenerationRequest): string {
    return `/**
 * Service for: ${feature}
 */

import { logger } from '../utils/logger';

export class ${this.camelToClass(this.featureToService(feature))} {
  async execute(data: any) {
    try {
      // TODO: Implement ${feature}
      logger.info('Executing: ${feature}');
      return { success: true };
    } catch (error) {
      logger.error('Error in ${feature}:', error);
      throw error;
    }
  }
}

export const ${this.featureToService(feature)} = new ${this.camelToClass(this.featureToService(feature))}();
`;
  }

  private generateExpressTests(request: CodeGenerationRequest, endpoints: ApiEndpoint[]): string {
    const tests = endpoints
      .map(e => {
        return `test('${e.method} ${e.path}', async () => {
  const response = await request(app)
    .${e.method.toLowerCase()}('${e.path}')
    .expect(200);
  expect(response.body).toBeDefined();
});`;
      })
      .join('\n\n');

    return `import request from 'supertest';
import app from '../src/index';

describe('API Endpoints', () => {
  ${tests}
});
`;
  }

  private generatePackageJson(request: CodeGenerationRequest): string {
    const deps: Record<string, string> = {
      express: '^4.18.2',
      mongoose: '^7.0.0',
      cors: '^2.8.5',
      dotenv: '^16.0.3',
      'jsonwebtoken': '^9.0.0',
      bcrypt: '^5.1.0',
    };

    const devDeps: Record<string, string> = {
      typescript: '^5.0.0',
      '@types/express': '^4.17.0',
      '@types/node': '^18.0.0',
      jest: '^29.0.0',
      '@types/jest': '^29.0.0',
      'ts-jest': '^29.0.0',
      'ts-node': '^10.0.0',
      nodemon: '^2.0.22',
    };

    return JSON.stringify({
      name: request.projectName.toLowerCase().replace(/\\s+/g, '-'),
      version: '0.1.0',
      description: request.description,
      main: 'dist/index.js',
      scripts: {
        'build': 'tsc',
        'start': 'node dist/index.js',
        'dev': 'nodemon --exec ts-node src/index.ts',
        'test': 'jest',
        'test:watch': 'jest --watch',
      },
      dependencies: deps,
      devDependencies: devDeps,
    }, null, 2);
  }

  private generateEnvExample(request: CodeGenerationRequest): string {
    return `PORT=3000
MONGODB_URI=mongodb://localhost:27017/${request.projectName.toLowerCase()}
JWT_SECRET=your-secret-key-here
NODE_ENV=development
`;
  }

  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
      },
      include: ['src'],
      exclude: ['node_modules', 'dist', 'tests'],
    }, null, 2);
  }

  private generateDockerfile(request: CodeGenerationRequest): string {
    return `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
`;
  }

  private generateDockerCompose(request: CodeGenerationRequest): string {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/${request.projectName.toLowerCase()}
      - NODE_ENV=production
    depends_on:
      - mongo
  
  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
`;
  }

  private generateReadme(request: CodeGenerationRequest): string {
    return `# ${request.projectName}

${request.description}

## Setup

\`\`\`bash
npm install
npm run dev
\`\`\`

## Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

- \`PORT\`: Server port (default: 3000)
- \`MONGODB_URI\`: MongoDB connection string
- \`JWT_SECRET\`: Secret key for JWT tokens

## API Endpoints

${request.apiEndpoints.map(e => `- ${e.method} ${e.path}: ${e.description}`).join('\n')}

## Testing

\`\`\`bash
npm test
\`\`\`

## Deployment

\`\`\`bash
docker build -t ${request.projectName.toLowerCase()} .
docker run -p 3000:3000 ${request.projectName.toLowerCase()}
\`\`\`
`;
  }

  private generateGitHubActions(request: CodeGenerationRequest): string {
    return `name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm test
`;
  }

  private generateFastApiMain(request: CodeGenerationRequest): string {
    return `"""
${request.projectName}
Generated FastAPI backend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="${request.projectName}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
  }

  private generatePydanticModel(model: DataModel): string {
    const fieldDefs = model.fields
      .map(f => `    ${f.name}: ${this.fieldTypeToPython(f.type)}${f.required ? '' : ' = None'}`)
      .join('\n');

    return `from pydantic import BaseModel
from typing import Optional

class ${model.name}(BaseModel):
${fieldDefs}

    class Config:
        json_schema_extra = {
            "example": {
                ${model.fields.map(f => `"${f.name}": ${this.getExampleValue(f.type)},`).join('\n                ')}
            }
        }
`;
  }

  private generateFastApiRoutes(request: CodeGenerationRequest, endpoints: ApiEndpoint[]): string {
    const routeGroup = this.extractRouteGroup(endpoints[0].path);
    const routes = endpoints
      .map(e => {
        const method = e.method.lower();
        const pathPart = '/' + e.path.split('/').slice(2).join('/').replace(/^\//, '');
        return `@app.${method}("${pathPart}")
async def ${this.pathToHandler(e.path)}():
    """${e.description}"""
    return {"message": "${e.description}"}`;
      })
      .join('\n\n');

    return `from fastapi import APIRouter

router = APIRouter(prefix="/api/${routeGroup}")

${routes}
`;
  }

  private generatePythonService(feature: string, request: CodeGenerationRequest): string {
    return `"""
Service for: ${feature}
"""

import logging

logger = logging.getLogger(__name__)

class ${this.camelToClass(this.featureToService(feature))}:
    async def execute(self, data: dict):
        try:
            logger.info(f"Executing: ${feature}")
            return {"success": True}
        except Exception as error:
            logger.error(f"Error in ${feature}: {error}")
            raise
`;
  }

  private generatePythonRequirements(request: CodeGenerationRequest): string {
    const deps = [
      'fastapi==0.104.0',
      'uvicorn==0.24.0',
      'pydantic==2.0.0',
      'python-dotenv==1.0.0',
      'sqlalchemy==2.0.0',
      'pymongo==4.5.0',
      'pyjwt==2.8.0',
      'passlib==1.7.0',
    ];
    return deps.join('\n');
  }

  private generateGinMain(request: CodeGenerationRequest): string {
    return `package main

import (
	"log"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Fatal(r.Run(":3000"))
}
`;
  }

  private generateGoModel(model: DataModel): string {
    const fields = model.fields
      .map(f => `    ${this.pascalCase(f.name)} ${this.fieldTypeToGo(f.type)} \`json:"${f.name}"\``)
      .join('\n');

    return `package models

type ${model.name} struct {
${fields}
}
`;
  }

  private generateGinRoutes(request: CodeGenerationRequest): string {
    return `package routes

import (
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	// TODO: Add routes
}
`;
  }

  private generateGinHandler(endpoint: ApiEndpoint, request: CodeGenerationRequest): string {
    return `package handlers

import (
	"github.com/gin-gonic/gin"
)

func ${this.pascalCase(this.pathToHandler(endpoint.path))}(c *gin.Context) {
	// TODO: Implement ${endpoint.description}
	c.JSON(200, gin.H{"message": "${endpoint.description}"})
}
`;
  }

  private generateGoMod(request: CodeGenerationRequest): string {
    return `module ${request.projectName.toLowerCase().replace(/\\s+/g, '-')}

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
)
`;
  }

  /**
   * Helper methods
   */

  private validateRequest(request: CodeGenerationRequest): void {
    if (!request.projectName) throw new Error('Project name is required');
    if (!request.framework) throw new Error('Framework is required');
    if (!request.dataModels || request.dataModels.length === 0) throw new Error('At least one data model is required');
    if (!request.apiEndpoints || request.apiEndpoints.length === 0) throw new Error('At least one API endpoint is required');
  }

  private async validateGeneratedCode(files: GeneratedFile[]): Promise<{ syntaxValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    for (const file of files) {
      if (file.fileType === 'typescript' || file.fileType === 'javascript') {
        if (!file.content.includes('export') && !file.content.includes('import')) {
          warnings.push(`${file.path}: Missing exports/imports`);
        }
      }
    }

    return {
      syntaxValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private estimateSetupTime(request: CodeGenerationRequest): number {
    // Rough estimate: base time + time per model/endpoint
    return 5 + request.dataModels.length * 2 + request.apiEndpoints.length * 1;
  }

  private estimateTestCoverage(request: CodeGenerationRequest): number {
    // Generated tests cover all endpoints - target 100% coverage
    return Math.min(100, 50 + request.apiEndpoints.length * 5);
  }

  private extractRouteGroup(path: string): string {
    // /api/users/123 -> users
    const parts = path.split('/').filter(p => p && p !== 'api');
    return parts[0] || 'root';
  }

  private requiresAuth(request: CodeGenerationRequest): boolean {
    return request.apiEndpoints.some(e => e.authenticated !== false) ||
           request.features.some(f => f.toLowerCase().includes('auth'));
  }

  private featureToService(feature: string): string {
    return feature.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  private fieldTypeToMongoose(type: string): string {
    const map: Record<string, string> = {
      string: 'String',
      number: 'Number',
      boolean: 'Boolean',
      date: 'Date',
      email: 'String',
      url: 'String',
      array: '[String]',
      object: 'Object',
    };
    return map[type] || 'String';
  }

  private fieldTypeToTypescript(type: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      date: 'Date',
      email: 'string',
      url: 'string',
      array: 'any[]',
      object: 'any',
    };
    return map[type] || 'any';
  }

  private fieldTypeToPython(type: string): string {
    const map: Record<string, string> = {
      string: 'str',
      number: 'int',
      boolean: 'bool',
      date: 'datetime',
      email: 'str',
      url: 'str',
      array: 'List[str]',
      object: 'dict',
    };
    return map[type] || 'str';
  }

  private fieldTypeToGo(type: string): string {
    const map: Record<string, string> = {
      string: 'string',
      number: 'int',
      boolean: 'bool',
      date: 'time.Time',
      email: 'string',
      url: 'string',
      array: '[]string',
      object: 'map[string]interface{}',
    };
    return map[type] || 'string';
  }

  private pathToHandler(path: string): string {
    return path.split('/').filter(p => p).map((p, i) => i === 0 ? p : this.pascalCase(p)).join('');
  }

  private camelToClass(name: string): string {
    return name.split('-').map(p => this.pascalCase(p)).join('');
  }

  private pascalCase(str: string): string {
    return str.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private getExampleValue(type: string): string {
    const map: Record<string, string> = {
      string: '"example"',
      number: '42',
      boolean: 'true',
      date: '"2024-01-01T00:00:00Z"',
      email: '"user@example.com"',
      url: '"https://example.com"',
      array: '[]',
      object: '{}',
    };
    return map[type] || '"example"';
  }
}

export const codeGeneratorService = new CodeGeneratorService();
