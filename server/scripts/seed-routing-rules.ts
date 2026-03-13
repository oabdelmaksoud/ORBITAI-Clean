/**
 * Script to seed default routing rules for LLM Router
 * Usage: npm run seed-routing-rules
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../src/config/database.js';
import { RoutingRule } from '../src/models/RoutingRule.model.js';

dotenv.config();

const DEFAULT_ROUTING_RULES = [
  {
    name: 'Fast Chat Responses',
    priority: 10,
    enabled: true,
    description: 'Route simple chat/conversation tasks to fast, low-cost models',
    conditions: {
      taskTypes: ['chat', 'conversation'],
      complexity: ['simple'],
      requestTypes: ['chat']
    },
    actions: {
      preferredModel: 'gemini-2.5-flash',
      preferredProvider: 'gemini',
      costPreference: 'low',
      maxLatency: 1000
    }
  },
  {
    name: 'Code Generation to GPT-4o',
    priority: 9,
    enabled: true,
    description: 'Route code generation tasks to GPT-4o for best quality',
    conditions: {
      taskTypes: ['code-generation'],
      complexity: ['moderate', 'complex']
    },
    actions: {
      preferredModel: 'gpt-4o',
      preferredProvider: 'openai',
      costPreference: 'quality'
    }
  },
  {
    name: 'Structured Output to Gemini 3 Pro',
    priority: 8,
    enabled: true,
    description: 'Route structured output tasks to Gemini 3 Pro',
    conditions: {
      taskTypes: ['structured-output', 'project-preview'],
      complexity: ['moderate', 'complex']
    },
    actions: {
      preferredModel: 'gemini-3-pro',
      preferredProvider: 'gemini',
      costPreference: 'balanced'
    }
  },
  {
    name: 'High Quality Analysis Tasks',
    priority: 7,
    enabled: true,
    description: 'Route analysis tasks to high-quality models',
    conditions: {
      taskTypes: ['analysis'],
      complexity: ['complex']
    },
    actions: {
      preferredProvider: 'anthropic',
      costPreference: 'quality'
    }
  },
  {
    name: 'Real-Time Tasks to Fast Models',
    priority: 6,
    enabled: true,
    description: 'Route real-time tasks to ultra-fast models',
    conditions: {
      requestTypes: ['chat', 'conversation']
    },
    actions: {
      preferredProvider: 'groq',
      maxLatency: 500,
      costPreference: 'low'
    }
  },
  {
    name: 'Orchestrator Agent Optimization',
    priority: 5,
    enabled: true,
    description: 'Optimize routing for Orchestrator agent tasks',
    conditions: {
      agentRoles: ['Orchestrator']
    },
    actions: {
      preferredModel: 'gemini-3-pro',
      preferredProvider: 'gemini',
      costPreference: 'balanced'
    }
  },
  {
    name: 'Implementation Agent Code Tasks',
    priority: 4,
    enabled: true,
    description: 'Route Implementation Agent code tasks to best code models',
    conditions: {
      agentRoles: ['Implementation Agent'],
      taskTypes: ['code-generation']
    },
    actions: {
      preferredModel: 'gpt-4o',
      preferredProvider: 'openai',
      costPreference: 'quality'
    }
  },
  {
    name: 'Cost-Sensitive Tasks',
    priority: 3,
    enabled: true,
    description: 'Route cost-sensitive tasks to low-cost models',
    conditions: {
      complexity: ['simple']
    },
    actions: {
      preferredProvider: 'gemini',
      costPreference: 'low',
      costLimit: 0.001
    }
  },
  {
    name: 'Long Context Tasks',
    priority: 2,
    enabled: true,
    description: 'Route long-context tasks to models with large context windows',
    conditions: {
      taskTypes: ['long-context', 'documentation']
    },
    actions: {
      preferredModel: 'gemini-3-pro',
      preferredProvider: 'gemini',
      costPreference: 'balanced'
    }
  },
  {
    name: 'Function Calling Required',
    priority: 1,
    enabled: true,
    description: 'Route tasks requiring function calling to compatible models',
    conditions: {
      requestTypes: ['function-calling']
    },
    actions: {
      preferredProvider: 'gemini',
      blockedProviders: ['grok'],
      costPreference: 'balanced'
    }
  }
];

async function seedRoutingRules() {
  try {
    console.log('🌱 Starting routing rules seeding...\n');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Connected to database\n');

    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const ruleData of DEFAULT_ROUTING_RULES) {
      try {
        // Check if rule already exists (by name)
        const existing = await RoutingRule.findOne({ name: ruleData.name });
        
        if (existing) {
          // Update existing rule
          await RoutingRule.findByIdAndUpdate(existing._id, ruleData, { new: true });
          updated++;
          console.log(`↻ Updated rule: ${ruleData.name}`);
        } else {
          // Create new rule
          await RoutingRule.create(ruleData);
          created++;
          console.log(`✅ Created rule: ${ruleData.name}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to seed rule ${ruleData.name}:`, error.message);
        skipped++;
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ↻ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📦 Total: ${DEFAULT_ROUTING_RULES.length}`);
    
    console.log('\n✨ Routing rules seeding completed successfully!');
    
    // Show all enabled rules
    const enabledRules = await RoutingRule.find({ enabled: true }).sort({ priority: -1 });
    console.log(`\n📋 Enabled Rules (${enabledRules.length}):`);
    enabledRules.forEach(rule => {
      console.log(`   • [Priority ${rule.priority}] ${rule.name} - ${rule.description || 'No description'}`);
    });
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to seed routing rules:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedRoutingRules();
}

export { seedRoutingRules };




