/**
 * Seed Hosting Plans
 * Creates default hosting plans for different platforms and project types
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { HostingPlan } from '../models/HostingPlan.model.js';
import { logger } from '../utils/logger.js';

dotenv.config();

const hostingPlans = [
  // Web App Hosting Plans
  {
    name: 'Vercel Starter',
    description: 'Perfect for small web applications and static sites',
    platform: 'vercel',
    projectType: 'web',
    price: {
      monthly: 0,
      yearly: 0,
      setup: 0
    },
    resources: {
      compute: '100 hours/month',
      storage: '100 GB',
      bandwidth: '100 GB/month',
      buildMinutes: 6000
    },
    features: [
      'Automatic HTTPS',
      'Global CDN',
      'Preview deployments',
      'Custom domains',
      'Basic analytics'
    ],
    isActive: true
  },
  {
    name: 'Vercel Pro',
    description: 'For production web applications with higher traffic',
    platform: 'vercel',
    projectType: 'web',
    price: {
      monthly: 20,
      yearly: 200,
      setup: 0
    },
    resources: {
      compute: '1000 hours/month',
      storage: '1 TB',
      bandwidth: '1 TB/month',
      buildMinutes: 60000
    },
    features: [
      'Everything in Starter',
      'Advanced analytics',
      'Password protection',
      'Team collaboration',
      'Priority support'
    ],
    isActive: true
  },
  {
    name: 'Railway Starter',
    description: 'Simple deployment for web apps and APIs',
    platform: 'railway',
    projectType: 'web',
    price: {
      monthly: 5,
      yearly: 50,
      setup: 0
    },
    resources: {
      compute: '500 hours/month',
      storage: '5 GB',
      bandwidth: '100 GB/month',
      buildMinutes: 10000
    },
    features: [
      'Automatic deployments',
      'Database included',
      'Custom domains',
      'Environment variables',
      'Logs and metrics'
    ],
    isActive: true
  },
  {
    name: 'Railway Pro',
    description: 'Scalable hosting for production applications',
    platform: 'railway',
    projectType: 'web',
    price: {
      monthly: 20,
      yearly: 200,
      setup: 0
    },
    resources: {
      compute: 'Unlimited',
      storage: '100 GB',
      bandwidth: '1 TB/month',
      buildMinutes: 100000
    },
    features: [
      'Everything in Starter',
      'Auto-scaling',
      'Multiple environments',
      'Team management',
      'Priority support'
    ],
    isActive: true
  },
  {
    name: 'AWS EC2 Basic',
    description: 'Basic cloud hosting on AWS',
    platform: 'aws',
    projectType: 'web',
    price: {
      monthly: 15,
      yearly: 150,
      setup: 0
    },
    resources: {
      compute: 't2.micro instance',
      storage: '20 GB',
      bandwidth: '1 TB/month',
      buildMinutes: 0
    },
    features: [
      'Full server control',
      'Custom configurations',
      'Auto-scaling groups',
      'Load balancing',
      'CloudWatch monitoring'
    ],
    isActive: true
  },
  {
    name: 'GCP App Engine',
    description: 'Serverless hosting on Google Cloud Platform',
    platform: 'gcp',
    projectType: 'web',
    price: {
      monthly: 10,
      yearly: 100,
      setup: 0
    },
    resources: {
      compute: 'F1 instance hours',
      storage: '5 GB',
      bandwidth: '1 GB/day free',
      buildMinutes: 0
    },
    features: [
      'Automatic scaling',
      'Zero-downtime deployments',
      'Custom domains',
      'SSL certificates',
      'Cloud monitoring'
    ],
    isActive: true
  },
  {
    name: 'Azure App Service',
    description: 'Managed web app hosting on Microsoft Azure',
    platform: 'azure',
    projectType: 'web',
    price: {
      monthly: 12,
      yearly: 120,
      setup: 0
    },
    resources: {
      compute: 'B1 Basic tier',
      storage: '10 GB',
      bandwidth: '5 GB/month',
      buildMinutes: 0
    },
    features: [
      'Auto-scaling',
      'Deployment slots',
      'Custom domains',
      'SSL certificates',
      'Application Insights'
    ],
    isActive: true
  },
  // Mobile App Hosting Plans
  {
    name: 'Expo EAS Build Basic',
    description: 'Build and deploy React Native apps with Expo',
    platform: 'expo',
    projectType: 'mobile',
    price: {
      monthly: 0,
      yearly: 0,
      setup: 0
    },
    resources: {
      compute: '10 builds/month',
      storage: '1 GB',
      bandwidth: '10 GB/month',
      buildMinutes: 0
    },
    features: [
      'iOS and Android builds',
      'Over-the-air updates',
      'Preview builds',
      'Basic analytics',
      'Community support'
    ],
    isActive: true
  },
  {
    name: 'Expo EAS Build Pro',
    description: 'Production builds with priority support',
    platform: 'expo',
    projectType: 'mobile',
    price: {
      monthly: 29,
      yearly: 290,
      setup: 0
    },
    resources: {
      compute: 'Unlimited builds',
      storage: '10 GB',
      bandwidth: '100 GB/month',
      buildMinutes: 0
    },
    features: [
      'Everything in Basic',
      'Priority builds',
      'Advanced analytics',
      'Team collaboration',
      'Priority support'
    ],
    isActive: true
  },
  {
    name: 'App Store Connect',
    description: 'Deploy iOS apps to the App Store',
    platform: 'app-store',
    projectType: 'mobile',
    price: {
      monthly: 0,
      yearly: 99, // Apple Developer Program fee
      setup: 0
    },
    resources: {
      compute: 'Unlimited',
      storage: 'Unlimited',
      bandwidth: 'Unlimited',
      buildMinutes: 0
    },
    features: [
      'App Store distribution',
      'TestFlight beta testing',
      'App analytics',
      'In-app purchases',
      'App Store optimization'
    ],
    isActive: true
  },
  {
    name: 'Google Play Console',
    description: 'Deploy Android apps to Google Play Store',
    platform: 'google-play',
    projectType: 'mobile',
    price: {
      monthly: 0,
      yearly: 25, // One-time registration fee
      setup: 0
    },
    resources: {
      compute: 'Unlimited',
      storage: 'Unlimited',
      bandwidth: 'Unlimited',
      buildMinutes: 0
    },
    features: [
      'Google Play distribution',
      'Internal testing',
      'Closed/Open beta',
      'Play Console analytics',
      'In-app billing'
    ],
    isActive: true
  },
  // API/Microservices Hosting
  {
    name: 'Render Web Service',
    description: 'Host APIs and microservices on Render',
    platform: 'render',
    projectType: 'api',
    price: {
      monthly: 7,
      yearly: 70,
      setup: 0
    },
    resources: {
      compute: '512 MB RAM',
      storage: '1 GB',
      bandwidth: '100 GB/month',
      buildMinutes: 0
    },
    features: [
      'Auto-deploy from Git',
      'Custom domains',
      'SSL certificates',
      'Health checks',
      'Log streaming'
    ],
    isActive: true
  },
  {
    name: 'Netlify Functions',
    description: 'Serverless functions on Netlify',
    platform: 'netlify',
    projectType: 'api',
    price: {
      monthly: 0,
      yearly: 0,
      setup: 0
    },
    resources: {
      compute: '125k invocations/month',
      storage: '100 GB',
      bandwidth: '100 GB/month',
      buildMinutes: 300
    },
    features: [
      'Serverless functions',
      'Edge functions',
      'Automatic HTTPS',
      'Form handling',
      'Basic analytics'
    ],
    isActive: true
  }
];

async function seedHostingPlans() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orbitai';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Clear existing plans (optional - comment out if you want to keep existing)
    // await HostingPlan.deleteMany({});

    // Insert hosting plans
    let created = 0;
    let updated = 0;

    for (const plan of hostingPlans) {
      const existing = await HostingPlan.findOne({ 
        name: plan.name,
        platform: plan.platform 
      });

      if (existing) {
        await HostingPlan.updateOne(
          { _id: existing._id },
          { $set: plan }
        );
        updated++;
        logger.info(`Updated hosting plan: ${plan.name}`);
      } else {
        await HostingPlan.create(plan);
        created++;
        logger.info(`Created hosting plan: ${plan.name}`);
      }
    }

    logger.info(`✅ Hosting plans seeding complete! Created: ${created}, Updated: ${updated}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('Failed to seed hosting plans:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedHostingPlans();
}

export { seedHostingPlans };




