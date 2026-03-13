/**
 * Script to seed default feature flags
 * Usage: npm run seed-feature-flags
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { FeatureFlag } from '../src/models/FeatureFlag.model.js';

async function seedFeatureFlags() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || config.mongodbUri;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Default feature flags
    const defaultFlags = [
      // Project Features
      {
        featureKey: 'project_creation',
        featureName: 'Create Projects',
        description: 'Create new SDLC projects with AI assistance. Users can start projects from scratch or use templates.',
        category: 'projects',
        enabledRoles: ['guest', 'user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Plus',
          color: 'blue'
        }
      },
      {
        featureKey: 'project_deletion',
        featureName: 'Delete Projects',
        description: 'Permanently delete projects and all associated data. This action cannot be undone.',
        category: 'projects',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Trash2',
          color: 'red'
        }
      },
      {
        featureKey: 'project_sharing',
        featureName: 'Share Projects',
        description: 'Share projects with other users via public links. Control who can view or edit shared projects.',
        category: 'projects',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Share2',
          color: 'green'
        }
      },
      {
        featureKey: 'project_export',
        featureName: 'Export Projects',
        description: 'Export project data, artifacts, and code in various formats (ZIP, JSON, PDF).',
        category: 'projects',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Download',
          color: 'purple'
        }
      },
      {
        featureKey: 'project_import',
        featureName: 'Import Projects',
        description: 'Import projects from exported files or external sources. Restore projects from backups.',
        category: 'projects',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Upload',
          color: 'blue'
        }
      },
      // AI Features
      {
        featureKey: 'ai_chat',
        featureName: 'AI Chat',
        description: 'Interactive AI chat assistant for project guidance, requirements gathering, and technical questions.',
        category: 'ai',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'MessageCircle',
          color: 'blue'
        }
      },
      {
        featureKey: 'ai_code_generation',
        featureName: 'AI Code Generation',
        description: 'Generate code snippets, functions, and complete modules using AI. Supports multiple programming languages.',
        category: 'ai',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Code',
          color: 'green'
        }
      },
      {
        featureKey: 'ai_task_automation',
        featureName: 'AI Task Automation',
        description: 'Automate project tasks using AI agents. HAND-OFF AI mode for autonomous task execution.',
        category: 'ai',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Zap',
          color: 'yellow'
        }
      },
      {
        featureKey: 'ai_suggestions',
        featureName: 'AI Suggestions',
        description: 'Receive AI-powered suggestions for improvements, optimizations, and best practices.',
        category: 'ai',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Sparkles',
          color: 'purple'
        }
      },
      {
        featureKey: 'chat_history',
        featureName: 'Chat History',
        description: 'Access and manage saved chat conversations and history. View, load, and delete previous conversations.',
        category: 'ai',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'MessageSquare',
          color: 'blue'
        }
      },
      {
        featureKey: 'multi_llm_access',
        featureName: 'Multi-LLM Access',
        description: 'Access to multiple LLM providers (Gemini, OpenAI, Anthropic, etc.) with intelligent routing.',
        category: 'ai',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Brain',
          color: 'purple'
        }
      },
      // Agent Features
      {
        featureKey: 'agent_creation',
        featureName: 'Create Agents',
        description: 'Create and configure specialized AI agents for different roles (Orchestrator, Developer, Designer, etc.).',
        category: 'agents',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Bot',
          color: 'blue'
        }
      },
      {
        featureKey: 'agent_customization',
        featureName: 'Customize Agents',
        description: 'Customize agent behavior, instructions, and capabilities to match project requirements.',
        category: 'agents',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Settings',
          color: 'gray'
        }
      },
      {
        featureKey: 'agent_deletion',
        featureName: 'Delete Agents',
        description: 'Remove agents from projects. Agents can be recreated if needed.',
        category: 'agents',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Trash2',
          color: 'red'
        }
      },
      {
        featureKey: 'agent_automation',
        featureName: 'Agent Automation',
        description: 'Enable autonomous agent execution and task automation workflows.',
        category: 'agents',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Play',
          color: 'green'
        }
      },
      // Export Features
      {
        featureKey: 'export_data',
        featureName: 'Export Data',
        description: 'Export project data, tasks, and artifacts in JSON, CSV, or other formats for backup or analysis.',
        category: 'export',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'FileDown',
          color: 'green'
        }
      },
      {
        featureKey: 'export_code',
        featureName: 'Export Code',
        description: 'Export generated code as ZIP files with full project structure and dependencies.',
        category: 'export',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Package',
          color: 'blue'
        }
      },
      {
        featureKey: 'export_reports',
        featureName: 'Export Reports',
        description: 'Generate and export project reports, documentation, and status summaries in PDF or Word format.',
        category: 'export',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'FileText',
          color: 'purple'
        }
      },
      // Admin Features
      {
        featureKey: 'admin_console',
        featureName: 'Admin Console',
        description: 'Access comprehensive admin dashboard with user management, analytics, and system configuration.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Shield',
          color: 'red'
        }
      },
      {
        featureKey: 'user_management',
        featureName: 'User Management',
        description: 'Manage users, assign roles, update permissions, and control user access to features.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Users',
          color: 'blue'
        }
      },
      {
        featureKey: 'package_management',
        featureName: 'Package Management',
        description: 'Create and manage subscription packages, set pricing, and configure plan limits.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Package',
          color: 'purple'
        }
      },
      {
        featureKey: 'audit_logs',
        featureName: 'Audit Logs',
        description: 'View detailed audit logs of all system activities, user actions, and administrative changes.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'FileText',
          color: 'gray'
        }
      },
      {
        featureKey: 'feature_flags',
        featureName: 'Feature Flags',
        description: 'Manage feature flags, control feature access by role and environment, and enable/disable features.',
        category: 'admin',
        enabledRoles: ['superadmin'],
        isActive: true,
        metadata: {
          icon: 'ToggleLeft',
          color: 'orange'
        }
      },
      {
        featureKey: 'system_settings',
        featureName: 'System Settings',
        description: 'Configure system-wide settings, environment variables, API keys, and server configuration.',
        category: 'admin',
        enabledRoles: ['superadmin'],
        isActive: true,
        metadata: {
          icon: 'Settings',
          color: 'blue'
        }
      },
      {
        featureKey: 'environment_switching',
        featureName: 'Environment Switching',
        description: 'Switch between development, staging, and production environments in the frontend interface.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Globe',
          color: 'purple'
        }
      },
      {
        featureKey: 'financial_dashboard',
        featureName: 'Financial Dashboard',
        description: 'View financial analytics, revenue reports, subscription metrics, and billing information.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'TrendingUp',
          color: 'green'
        }
      },
      {
        featureKey: 'analytics_dashboard',
        featureName: 'Analytics Dashboard',
        description: 'Access comprehensive analytics including user activity, project metrics, and system performance.',
        category: 'admin',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'BarChart',
          color: 'blue'
        }
      },
      // Workspace Features
      {
        featureKey: 'code_editor',
        featureName: 'Code Editor',
        description: 'Access to integrated code editor with syntax highlighting, auto-completion, and code formatting.',
        category: 'workspace',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Code2',
          color: 'blue'
        }
      },
      {
        featureKey: 'artifact_viewer',
        featureName: 'Artifact Viewer',
        description: 'View, edit, and manage project artifacts including documents, diagrams, and generated files.',
        category: 'workspace',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'FileText',
          color: 'green'
        }
      },
      {
        featureKey: 'preview_mode',
        featureName: 'Preview Mode',
        description: 'Preview project prototypes, wireframes, and generated HTML/CSS output in real-time.',
        category: 'workspace',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Eye',
          color: 'purple'
        }
      },
      {
        featureKey: 'terminal_access',
        featureName: 'Terminal Access',
        description: 'Access to integrated terminal for running commands, scripts, and development tools.',
        category: 'workspace',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Terminal',
          color: 'gray'
        }
      },
      // Advanced Features
      {
        featureKey: 'cloud_deployment',
        featureName: 'Cloud Deployment',
        description: 'Deploy projects to cloud platforms (AWS, Azure, GCP) with automated CI/CD pipelines.',
        category: 'advanced',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Cloud',
          color: 'blue'
        }
      },
      {
        featureKey: 'api_access',
        featureName: 'API Access',
        description: 'Access to REST API endpoints for programmatic project management and automation.',
        category: 'advanced',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Network',
          color: 'green'
        }
      },
      {
        featureKey: 'webhooks',
        featureName: 'Webhooks',
        description: 'Configure webhooks to receive real-time notifications and integrate with external systems.',
        category: 'advanced',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Webhook',
          color: 'orange'
        }
      },
      {
        featureKey: 'third_party_integrations',
        featureName: 'Third-party Integrations',
        description: 'Integrate with external services like Slack, GitHub, Jira, and other development tools.',
        category: 'advanced',
        enabledRoles: ['admin', 'superadmin'],
        isActive: true,
        metadata: {
          icon: 'Plug',
          color: 'purple'
        }
      },
      // Template Features
      {
        featureKey: 'template_use',
        featureName: 'Use Templates',
        description: 'Use pre-built project templates to quickly start new projects with best practices.',
        category: 'templates',
        enabledRoles: ['user', 'admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Layout',
          color: 'blue'
        }
      },
      {
        featureKey: 'template_creation',
        featureName: 'Create Templates',
        description: 'Create custom project templates from existing projects for reuse across teams.',
        category: 'templates',
        enabledRoles: ['admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'FilePlus',
          color: 'green'
        }
      },
      {
        featureKey: 'template_sharing',
        featureName: 'Share Templates',
        description: 'Share project templates with other users or make them publicly available.',
        category: 'templates',
        enabledRoles: ['admin', 'superadmin', 'editor'],
        isActive: true,
        metadata: {
          icon: 'Share2',
          color: 'purple'
        }
      }
    ];

    console.log(`\n📦 Seeding ${defaultFlags.length} feature flags...\n`);

    // Upsert each feature flag
    for (const flagData of defaultFlags) {
      const existing = await FeatureFlag.findOne({ featureKey: flagData.featureKey });
      
      if (existing) {
        // Update existing flag - include enabledRoles and isActive to ensure they're up to date
        await FeatureFlag.updateOne(
          { featureKey: flagData.featureKey },
          {
            $set: {
              featureName: flagData.featureName,
              description: flagData.description,
              category: flagData.category,
              enabledRoles: flagData.enabledRoles,
              isActive: flagData.isActive,
              enabledEnvironments: flagData.enabledEnvironments || [],
              metadata: flagData.metadata
            }
          }
        );
        console.log(`  ✅ Updated: ${flagData.featureKey} (enabledRoles: ${flagData.enabledRoles.join(', ')})`);
      } else {
        // Create new flag
        await FeatureFlag.create(flagData);
        console.log(`  ✅ Created: ${flagData.featureKey}`);
      }
    }

    console.log(`\n✅ Successfully seeded ${defaultFlags.length} feature flags!`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error seeding feature flags:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

seedFeatureFlags();
