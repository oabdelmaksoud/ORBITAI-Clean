/**
 * Script to seed initial packages
 * Usage: npm run seed-packages
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { Package } from '../src/models/Package.model.js';

async function seedPackages() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || config.mongodbUri;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Default packages
    const defaultPackages = [
      {
        displayName: 'Starter',
        description: 'Perfect for getting started',
        price: 0,
        billingCycle: 'lifetime' as const,
        features: [
          { key: 'maxAgents', label: 'Max Agents', value: 3, type: 'number' as const },
          { key: 'basicArtifacts', label: 'Basic Artifacts', value: true, type: 'boolean' as const },
          { key: 'communitySupport', label: 'Community Support', value: true, type: 'boolean' as const },
          { key: 'maxProjects', label: 'Max Projects', value: 1, type: 'number' as const },
          { key: 'basicLLM', label: 'Basic LLM Access (Gemini Flash)', value: true, type: 'boolean' as const },
          { key: 'limitedTokens', label: '100K Tokens/Month', value: 100000, type: 'number' as const }
        ],
        limits: {
          maxProjects: 1,
          maxAgents: 3,
          maxTasks: 10,
          maxStorageGB: 1,
          maxAPICalls: 1000,
          maxTeamMembers: 1,
          maxMonthlyBudget: 50,
          maxFileSizeMB: 10,
          maxMCPServers: 3,
          maxArtifactsPerProject: 50,
          maxBackupVersions: 3,
          maxConcurrentExecutions: 1,
          internetAccessEnabled: false,
          codeExecutionEnabled: false,
          cloudDeploymentEnabled: false,
          // LLM limits
          maxLLMCallsPerMonth: 1000,
          maxTokensPerMonth: 100000,
          allowedLLMModels: ['gemini-2.5-flash'],
          multiLLMEnabled: false,
          premiumModelsEnabled: false
        },
        isActive: true,
        isDefault: true,
        sortOrder: 1,
        metadata: {
          color: 'bg-slate-100',
          icon: 'Layout',
          highlight: false
        }
      },
      {
        displayName: 'Pro',
        description: 'For professional developers',
        price: 49,
        billingCycle: 'monthly' as const,
        features: [
          { key: 'unlimitedAgents', label: 'Unlimited Agents', value: true, type: 'boolean' as const },
          { key: 'autoPilot', label: 'Auto-Pilot Mode', value: true, type: 'boolean' as const },
          { key: 'codeExport', label: 'Code Export (ZIP)', value: true, type: 'boolean' as const },
          { key: 'prioritySupport', label: 'Priority Support', value: true, type: 'boolean' as const },
          { key: 'cloudDeployment', label: 'Cloud Deployment', value: true, type: 'boolean' as const },
          { key: 'multiLLM', label: 'Multi-LLM Intelligent Routing', value: true, type: 'boolean' as const },
          { key: 'premiumModels', label: 'Premium Models (GPT-4o, Claude, DeepSeek, Grok)', value: true, type: 'boolean' as const },
          { key: 'advancedLLM', label: '5M Tokens/Month', value: 5000000, type: 'number' as const }
        ],
        limits: {
          maxProjects: 10,
          maxAgents: -1, // Unlimited
          maxTasks: 100,
          maxStorageGB: 10,
          maxAPICalls: 10000,
          maxTeamMembers: 5,
          maxMonthlyBudget: 500,
          maxFileSizeMB: 50,
          maxMCPServers: 10,
          maxArtifactsPerProject: 500,
          maxBackupVersions: 10,
          maxConcurrentExecutions: 5,
          internetAccessEnabled: true,
          codeExecutionEnabled: true,
          cloudDeploymentEnabled: true,
          // LLM limits
          maxLLMCallsPerMonth: 50000,
          maxTokensPerMonth: 5000000,
          allowedLLMModels: [
            'gemini-2.5-flash',
            'gemini-3-pro',
            'gpt-4o',
            'gpt-4o-mini',
            'claude-3-5-sonnet',
            'deepseek-chat',
            'deepseek-coder',
            'grok-beta'
          ],
          multiLLMEnabled: true,
          premiumModelsEnabled: true
        },
        isActive: true,
        isDefault: false,
        sortOrder: 2,
        metadata: {
          color: 'bg-primary',
          icon: 'Zap',
          highlight: true
        }
      },
      {
        displayName: 'Enterprise',
        description: 'For teams and organizations',
        price: 199,
        billingCycle: 'monthly' as const,
        features: [
          { key: 'everythingInPro', label: 'Everything in Pro', value: true, type: 'boolean' as const },
          { key: 'adminPortal', label: 'Admin Portal', value: true, type: 'boolean' as const },
          { key: 'sso', label: 'SSO & Audit Logs', value: true, type: 'boolean' as const },
          { key: 'customModels', label: 'Custom Models', value: true, type: 'boolean' as const },
          { key: 'dedicatedSupport', label: 'Dedicated Support', value: true, type: 'boolean' as const },
          { key: 'unlimitedLLM', label: 'Unlimited LLM Access', value: true, type: 'boolean' as const },
          { key: 'allModels', label: 'All Premium Models + Custom', value: true, type: 'boolean' as const },
          { key: 'unlimitedTokens', label: 'Unlimited Tokens/Month', value: true, type: 'boolean' as const },
          { key: 'priorityLLMRouting', label: 'Priority LLM Routing', value: true, type: 'boolean' as const }
        ],
        limits: {
          maxProjects: -1, // Unlimited
          maxAgents: -1, // Unlimited
          maxTasks: -1, // Unlimited
          maxStorageGB: 100,
          maxAPICalls: 100000,
          maxTeamMembers: -1, // Unlimited
          maxMonthlyBudget: -1, // Unlimited
          maxFileSizeMB: 500,
          maxMCPServers: -1, // Unlimited
          maxArtifactsPerProject: -1, // Unlimited
          maxBackupVersions: 100,
          maxConcurrentExecutions: -1, // Unlimited
          internetAccessEnabled: true,
          codeExecutionEnabled: true,
          cloudDeploymentEnabled: true,
          // LLM limits - Unlimited for Enterprise
          maxLLMCallsPerMonth: -1, // Unlimited
          maxTokensPerMonth: -1, // Unlimited
          allowedLLMModels: [
            'gemini-2.5-flash',
            'gemini-3-pro',
            'gpt-4o',
            'gpt-4o-mini',
            'claude-3-5-sonnet',
            'deepseek-chat',
            'deepseek-coder',
            'grok-beta'
          ],
          multiLLMEnabled: true,
          premiumModelsEnabled: true
        },
        isActive: true,
        isDefault: false,
        sortOrder: 3,
        metadata: {
          color: 'bg-slate-900',
          icon: 'Shield',
          highlight: false
        }
      }
    ];

    // Clear existing packages
    await Package.deleteMany({});
    console.log('✅ Cleared existing packages');

    // Insert default packages
    for (const pkg of defaultPackages) {
      const existing = await Package.findOne({ displayName: pkg.displayName });
      if (existing) {
        await Package.updateOne({ displayName: pkg.displayName }, pkg);
        console.log(`✅ Updated package: ${pkg.displayName}`);
      } else {
        await Package.create(pkg);
        console.log(`✅ Created package: ${pkg.displayName}`);
      }
    }

    console.log(`\n✅ Successfully seeded ${defaultPackages.length} packages!`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error seeding packages:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

seedPackages();

