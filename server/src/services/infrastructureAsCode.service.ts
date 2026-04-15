/**
 * Infrastructure-as-Code Service
 * Generates Terraform, CloudFormation, Pulumi templates
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
// import { Type, Schema } from '@google/genai';

export type IaCTool = 'terraform' | 'cloudformation' | 'pulumi';

export interface IaCTemplate {
  tool: IaCTool;
  filename: string;
  content: string;
  resources: Array<{
    type: string;
    name: string;
    provider: string;
  }>;
}

export interface IaCGenerationRequest {
  projectName: string;
  platform: 'aws' | 'gcp' | 'azure' | 'multi';
  resources: {
    compute?: {
      type: 'ec2' | 'lambda' | 'cloud-run' | 'app-service';
      instanceType?: string;
      count?: number;
    };
    database?: {
      type: 'rds' | 'dynamodb' | 'cloud-sql' | 'cosmosdb';
      engine?: string;
    };
    storage?: {
      type: 's3' | 'gcs' | 'blob-storage';
    };
    networking?: {
      vpc?: boolean;
      loadBalancer?: boolean;
    };
  };
  environment: 'development' | 'staging' | 'production';
}

class InfrastructureAsCodeService {
  /**
   * Generate IaC templates
   */
  async generateTemplates(
    request: IaCGenerationRequest,
    tools: IaCTool[] = ['terraform']
  ): Promise<IaCTemplate[]> {
    try {
      logger.info(`Generating IaC templates for ${request.platform} using ${tools.join(', ')}`);

      const templates: IaCTemplate[] = [];

      for (const tool of tools) {
        const template = await this.generateTemplateForTool(request, tool);
        if (template) {
          templates.push(template);
        }
      }

      return templates;
    } catch (error: unknown) {
      logger.error('Failed to generate IaC templates:', error);
      throw error;
    }
  }

  /**
   * Generate template for specific tool
   */
  private async generateTemplateForTool(
    request: IaCGenerationRequest,
    tool: IaCTool
  ): Promise<IaCTemplate | null> {
    const prompt = this.getIaCPrompt(request, tool);

    try {
      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'code_generation',
        agentRole: 'Integration Agent',
        context: {
          agentRole: 'Integration Agent',
          tools: []
        }
      });

      const resources = this.extractResources(request);

      return {
        tool,
        filename: this.getFilename(tool, request.platform),
        content: response.content,
        resources
      };
    } catch (error: unknown) {
      logger.warn(`Failed to generate ${tool} template:`, (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  /**
   * Get prompt for IaC tool
   */
  private getIaCPrompt(request: IaCGenerationRequest, tool: IaCTool): string {
    const resourceDesc = this.describeResources(request.resources);

    switch (tool) {
      case 'terraform':
        return `Generate Terraform configuration for ${request.platform}:

Project: ${request.projectName}
Environment: ${request.environment}

Resources needed:
${resourceDesc}

Generate complete Terraform files including:
- main.tf (resource definitions)
- variables.tf (input variables)
- outputs.tf (output values)
- terraform.tfvars.example (example variable values)

Use ${request.platform} provider and follow best practices.`;

      case 'cloudformation':
        return `Generate AWS CloudFormation template (YAML) for:

Project: ${request.projectName}
Environment: ${request.environment}

Resources needed:
${resourceDesc}

Generate complete CloudFormation template with:
- Resource definitions
- Parameters
- Outputs
- Conditions (if needed)

Follow AWS best practices.`;

      case 'pulumi':
        return `Generate Pulumi program (TypeScript) for ${request.platform}:

Project: ${request.projectName}
Environment: ${request.environment}

Resources needed:
${resourceDesc}

Generate complete Pulumi program with:
- Resource definitions
- Configuration
- Outputs

Use ${request.platform} provider.`;

      default:
        return '';
    }
  }

  /**
   * Describe resources
   */
  private describeResources(resources: IaCGenerationRequest['resources']): string {
    const desc: string[] = [];

    if (resources.compute) {
      desc.push(`- Compute: ${resources.compute.type} (${resources.compute.instanceType || 'default'}, count: ${resources.compute.count || 1})`);
    }

    if (resources.database) {
      desc.push(`- Database: ${resources.database.type} (${resources.database.engine || 'default'})`);
    }

    if (resources.storage) {
      desc.push(`- Storage: ${resources.storage.type}`);
    }

    if (resources.networking) {
      if (resources.networking.vpc) desc.push('- VPC');
      if (resources.networking.loadBalancer) desc.push('- Load Balancer');
    }

    return desc.join('\n');
  }

  /**
   * Extract resources list
   */
  private extractResources(request: IaCGenerationRequest): IaCTemplate['resources'] {
    const resources: IaCTemplate['resources'] = [];

    if (request.resources.compute) {
      resources.push({
        type: request.resources.compute.type,
        name: `${request.projectName}-compute`,
        provider: request.platform
      });
    }

    if (request.resources.database) {
      resources.push({
        type: request.resources.database.type,
        name: `${request.projectName}-database`,
        provider: request.platform
      });
    }

    if (request.resources.storage) {
      resources.push({
        type: request.resources.storage.type,
        name: `${request.projectName}-storage`,
        provider: request.platform
      });
    }

    return resources;
  }

  /**
   * Get filename for tool
   */
  private getFilename(tool: IaCTool, _platform: string): string {
    switch (tool) {
      case 'terraform':
        return 'main.tf';
      case 'cloudformation':
        return 'template.yaml';
      case 'pulumi':
        return 'index.ts';
      default:
        return 'infrastructure.yaml';
    }
  }
}

export const infrastructureAsCodeService = new InfrastructureAsCodeService();



