/**
 * Swagger/OpenAPI Configuration
 * Provides API documentation
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ORBITAI API',
      version: '1.0.0',
      description: 'ORBITAI Cloud Infrastructure Backend API Documentation',
      contact: {
        name: 'ORBITAI Support',
        email: 'support@orbitai.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.orbitai.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login or /api/auth/register',
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Projects', description: 'Project management endpoints' },
      { name: 'Agents', description: 'AI agent operations' },
      { name: 'Tasks', description: 'Task management endpoints' },
      { name: 'Artifacts', description: 'Artifact management endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Admin', description: 'Admin management endpoints' },
      { name: 'LLM', description: 'LLM management and usage endpoints' },
      { name: 'Performance', description: 'Performance monitoring endpoints' },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/routes/*.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);


