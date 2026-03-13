/**
 * Script to enable agent_customization and agent_deletion feature flags
 */
import mongoose from 'mongoose';
import { FeatureFlag } from '../src/models/FeatureFlag.model.js';
import config from '../src/config/env.js';

async function enableAgentFeatures() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri);
    console.log('Connected!');

    // Enable agent_customization for all authenticated users
    const customizationResult = await FeatureFlag.findOneAndUpdate(
      { featureKey: 'agent_customization' },
      { 
        $set: { 
          enabledRoles: ['user', 'editor', 'admin', 'superadmin'],
          isActive: true
        } 
      },
      { new: true }
    );
    console.log('agent_customization updated:', customizationResult?.enabledRoles);

    // Enable agent_deletion for admin and superadmin only
    const deletionResult = await FeatureFlag.findOneAndUpdate(
      { featureKey: 'agent_deletion' },
      { 
        $set: { 
          enabledRoles: ['admin', 'superadmin'],
          isActive: true
        } 
      },
      { new: true }
    );
    console.log('agent_deletion updated:', deletionResult?.enabledRoles);

    console.log('\n✅ Agent features enabled successfully!');
    console.log('- agent_customization: Available to all authenticated users');
    console.log('- agent_deletion: Available to admin and superadmin only');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

enableAgentFeatures();

