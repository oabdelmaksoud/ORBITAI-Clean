/**
 * Seed Homepage Content Service
 * Seeds default homepage content sections to the database
 */

import { PageContent } from '../models/PageContent.model.js';
import { logger } from '../utils/logger.js';

const HOMEPAGE_SECTIONS = [
  {
    pageKey: 'home',
    sectionKey: 'hero',
    content: {
      title: 'The Autonomous Software Architect.',
      subtitle: 'V-Model SDLC Engine Active',
      description: 'Stop coding blindly. OrbitAI orchestrates a swarm of agents to plan, verify, and build your software with strict adherence to Risk Assessment and Scope Control.',
      ctaText: 'Start Building Free',
      ctaLink: '#signup',
      buttons: [
        { text: 'Start Building Free', link: '#signup', variant: 'primary' },
        { text: 'Launch Console', link: '#launch', variant: 'secondary' }
      ]
    },
    sortOrder: 1,
    isActive: true
  },
  {
    pageKey: 'home',
    sectionKey: 'features',
    content: {
      title: 'Platform Features',
      description: 'Everything you need to build better software',
      features: [
        {
          title: 'Multi-Agent Orchestration',
          description: 'Intelligent agents work together to plan, design, implement, and test your software',
          icon: 'Workflow',
          color: 'blue'
        },
        {
          title: 'V-Model SDLC',
          description: 'Strict adherence to V-Model methodology with verification at every phase',
          icon: 'Shield',
          color: 'green'
        },
        {
          title: 'Risk Assessment',
          description: 'Automated risk analysis and mitigation strategies built into every project',
          icon: 'AlertTriangle',
          color: 'orange'
        },
        {
          title: 'Scope Control',
          description: 'Real-time tracking and enforcement of project scope boundaries',
          icon: 'Target',
          color: 'purple'
        },
        {
          title: 'Code Generation',
          description: 'AI-powered code generation with syntax validation and best practices',
          icon: 'Code',
          color: 'indigo'
        },
        {
          title: 'Quality Assurance',
          description: 'Automated testing, code review, and quality metrics tracking',
          icon: 'CheckCircle',
          color: 'emerald'
        }
      ]
    },
    sortOrder: 2,
    isActive: true
  },
  {
    pageKey: 'home',
    sectionKey: 'testimonials',
    content: {
      title: 'What Our Users Say',
      testimonials: [
        {
          name: 'Sarah Chen',
          role: 'CTO',
          company: 'TechCorp',
          avatar: '',
          content: 'OrbitAI transformed how we build software. The multi-agent system catches issues we never would have found.',
          rating: 5
        },
        {
          name: 'Michael Rodriguez',
          role: 'Lead Developer',
          company: 'StartupXYZ',
          avatar: '',
          content: 'The V-Model enforcement and risk assessment features are game-changers. We ship with confidence now.',
          rating: 5
        },
        {
          name: 'Emily Watson',
          role: 'Product Manager',
          company: 'InnovateLabs',
          avatar: '',
          content: 'Scope control and automated verification save us weeks of rework. This is the future of software development.',
          rating: 5
        }
      ]
    },
    sortOrder: 3,
    isActive: true
  },
  {
    pageKey: 'home',
    sectionKey: 'faq',
    content: {
      title: 'Frequently Asked Questions',
      faqs: [
        {
          question: 'How does OrbitAI differ from other AI coding assistants?',
          answer: 'OrbitAI uses a multi-agent orchestration system with strict V-Model SDLC enforcement, automated risk assessment, and scope control. It\'s not just code generation - it\'s a complete software development lifecycle management system.'
        },
        {
          question: 'What is the V-Model SDLC?',
          answer: 'The V-Model is a software development methodology that emphasizes verification and validation at each phase. OrbitAI enforces this model to ensure quality and reduce risk throughout development.'
        },
        {
          question: 'Can I use OrbitAI for any programming language?',
          answer: 'OrbitAI supports multiple programming languages and frameworks. The agents adapt to your project\'s tech stack and requirements.'
        },
        {
          question: 'How does risk assessment work?',
          answer: 'Our Risk Assessment Agent analyzes your project requirements, identifies potential risks, and suggests mitigation strategies before development begins.'
        },
        {
          question: 'Is my code secure?',
          answer: 'Yes. OrbitAI runs in isolated environments and never stores your code without explicit permission. All data is encrypted and secure.'
        },
        {
          question: 'Can I integrate OrbitAI with my existing tools?',
          answer: 'OrbitAI can integrate with popular development tools, version control systems, and CI/CD pipelines through our API.'
        }
      ]
    },
    sortOrder: 4,
    isActive: true
  },
  {
    pageKey: 'home',
    sectionKey: 'pricing',
    content: {
      plansHeading: 'Choose Your Plan',
      plansSubheading: 'Select the perfect plan for your needs'
    },
    sortOrder: 5,
    isActive: true
  },
  {
    pageKey: 'home',
    sectionKey: 'stats',
    content: {
      title: 'Our Impact',
      stats: [
        {
          label: 'Projects Completed',
          value: '10,000+',
          description: 'Successfully delivered'
        },
        {
          label: 'Lines of Code Generated',
          value: '50M+',
          description: 'With quality assurance'
        },
        {
          label: 'Risk Issues Prevented',
          value: '25,000+',
          description: 'Early detection'
        },
        {
          label: 'Developer Hours Saved',
          value: '100,000+',
          description: 'Through automation'
        }
      ]
    },
    sortOrder: 6,
    isActive: true
  }
];

/**
 * Seed homepage content to database
 */
export async function seedHomepageContent(): Promise<void> {
  try {
    logger.info('🌱 Starting automatic homepage content seeding...');

    let created = 0;
    let updated = 0;

    for (const section of HOMEPAGE_SECTIONS) {
      try {
        const existing = await PageContent.findOne({
          pageKey: section.pageKey,
          sectionKey: section.sectionKey
        });

        if (existing) {
          // Update existing section
          await PageContent.updateOne(
            { pageKey: section.pageKey, sectionKey: section.sectionKey },
            { $set: section }
          );
          updated++;
        } else {
          // Create new section
          await PageContent.create(section);
          created++;
        }
      } catch (sectionError: any) {
        logger.warn(`  ⚠️ Skipped section ${section.sectionKey}: ${sectionError.message}`);
      }
    }

    logger.info(`✅ Homepage content seeding complete: ${created} created, ${updated} updated`);
  } catch (error: any) {
    logger.warn('Homepage content seeding failed:', error.message);
  }
}




