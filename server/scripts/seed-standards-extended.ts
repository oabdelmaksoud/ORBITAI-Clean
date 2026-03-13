/**
 * Extended Quality Standards
 * Additional standards to add to the database
 * Run after initial seed: npm run seed-standards
 * Then add these: tsx scripts/seed-standards-extended.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QualityStandard } from '../src/models/QualityStandard.model.js';
import { connectDatabase } from '../src/config/database.js';

dotenv.config();

const additionalStandards = [
  // Software Engineering & Quality
  {
    id: 'iso25010',
    name: 'ISO/IEC 25010',
    description: 'Systems and Software Quality Model',
    fullDescription: 'ISO/IEC 25010 defines a quality model for software product quality and system quality in use. It provides a comprehensive framework for quality characteristics including functional suitability, reliability, usability, efficiency, maintainability, portability, compatibility, and security.',
    category: ['software-engineering', 'quality'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['iso25010', 'quality', 'software-quality', 'quality-model', 'sqale', 'maintainability', 'reliability'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC',
    version: '2011',
  },
  {
    id: 'iso90003',
    name: 'ISO/IEC 90003',
    description: 'Guidelines for Applying ISO 9001 to Software',
    fullDescription: 'ISO/IEC 90003 provides guidance for organizations in the application of ISO 9001:2015 to computer software and related services. It covers acquisition, supply, development, operation, and maintenance of software.',
    category: ['software-engineering', 'quality'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['iso90003', 'iso9001', 'quality-management', 'software', 'process'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC',
    version: '2018',
  },
  {
    id: 'iso10006',
    name: 'ISO 10006',
    description: 'Quality Management in Projects',
    fullDescription: 'ISO 10006:2018 provides guidance on quality management in projects. It is applicable to organizations undertaking projects of varying complexity and duration, aiming to satisfy project stakeholders by introducing quality management practices.',
    category: ['project-management', 'quality'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['iso10006', 'project-management', 'quality-management', 'project-quality'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO',
    version: '2018',
  },
  {
    id: 'iso21500',
    name: 'ISO 21500',
    description: 'Guidance on Project Management',
    fullDescription: 'ISO 21500 provides guidance on project management, explaining core principles and good practices applicable to projects of varying complexity and duration. It covers project management processes, subject groups, and concepts.',
    category: ['project-management'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['iso21500', 'project-management', 'pmbok', 'project-processes'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO',
    version: '2021',
  },
  {
    id: 'ieee1012',
    name: 'IEEE 1012',
    description: 'Software Verification and Validation',
    fullDescription: 'IEEE 1012 provides a framework for software verification and validation (V&V) processes. It defines V&V processes, activities, and tasks for software life cycle processes.',
    category: ['software-engineering', 'testing'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['ieee1012', 'verification', 'validation', 'v&v', 'testing', 'quality-assurance'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'IEEE',
    version: '2016',
  },
  {
    id: 'ieee730',
    name: 'IEEE 730',
    description: 'Software Quality Assurance',
    fullDescription: 'IEEE 730 specifies the processes, activities, and tasks for software quality assurance (SQA). It provides a framework for establishing, implementing, and maintaining SQA processes.',
    category: ['software-engineering', 'quality'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['ieee730', 'quality-assurance', 'sqa', 'software-quality'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'IEEE',
    version: '2014',
  },
  {
    id: 'ieee29148',
    name: 'IEEE 29148',
    description: 'Systems and Software Engineering - Requirements Engineering',
    fullDescription: 'IEEE 29148 provides requirements for processes and products used to elicit, analyze, specify, verify, and validate requirements. It covers requirements engineering throughout the system and software life cycle.',
    category: ['software-engineering', 'requirements'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['ieee29148', 'requirements', 'requirements-engineering', 'elicitation', 'specification'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'IEEE',
    version: '2018',
  },

  // Security & Cybersecurity
  {
    id: 'iso27002',
    name: 'ISO/IEC 27002',
    description: 'Information Security Controls',
    fullDescription: 'ISO/IEC 27002 provides guidelines for organizational information security standards and information security management practices. It includes a comprehensive set of information security controls.',
    category: ['security', 'information-security'],
    projectTypes: ['web-app', 'api', 'desktop-app', 'mobile-app', 'embedded'],
    industries: ['general', 'finance', 'government'],
    keywords: ['iso27002', 'security', 'information-security', 'controls', 'cybersecurity'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC',
    version: '2022',
  },
  {
    id: 'nist-csf',
    name: 'NIST CSF',
    description: 'NIST Cybersecurity Framework',
    fullDescription: 'The NIST Cybersecurity Framework provides a policy framework of computer security guidance for how private sector organizations can assess and improve their ability to prevent, detect, and respond to cyber attacks.',
    category: ['security', 'cybersecurity'],
    projectTypes: ['web-app', 'api', 'desktop-app', 'mobile-app', 'embedded'],
    industries: ['general', 'government', 'finance', 'critical-infrastructure'],
    keywords: ['nist', 'cybersecurity', 'framework', 'security', 'risk-management'],
    complianceLevel: 'recommended' as const,
    region: ['US'],
    source: 'NIST',
    version: '1.1',
  },
  {
    id: 'iso27017',
    name: 'ISO/IEC 27017',
    description: 'Cloud Security Controls',
    fullDescription: 'ISO/IEC 27017 provides guidelines for information security controls applicable to the provision and use of cloud services. It provides additional implementation guidance for ISO/IEC 27002 controls.',
    category: ['security', 'cloud'],
    projectTypes: ['web-app', 'api', 'cloud-service'],
    industries: ['general', 'cloud-services'],
    keywords: ['iso27017', 'cloud', 'cloud-security', 'saas', 'paas', 'iaas'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC',
    version: '2015',
  },
  {
    id: 'iso27018',
    name: 'ISO/IEC 27018',
    description: 'Cloud Privacy Controls',
    fullDescription: 'ISO/IEC 27018 establishes commonly accepted control objectives, controls, and guidelines for implementing measures to protect personally identifiable information (PII) in public cloud computing environments.',
    category: ['privacy', 'cloud'],
    projectTypes: ['web-app', 'api', 'cloud-service'],
    industries: ['general', 'cloud-services'],
    keywords: ['iso27018', 'cloud', 'privacy', 'pii', 'data-protection', 'cloud-privacy'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC',
    version: '2019',
  },
  {
    id: 'cwe',
    name: 'CWE',
    description: 'Common Weakness Enumeration',
    fullDescription: 'CWE is a community-developed list of common software security weaknesses. It serves as a common language for describing security vulnerabilities and weaknesses in software.',
    category: ['security', 'vulnerability'],
    projectTypes: ['web-app', 'api', 'desktop-app', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['cwe', 'vulnerability', 'weakness', 'security', 'cve'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'MITRE',
    version: '4.13',
  },
  {
    id: 'cve',
    name: 'CVE',
    description: 'Common Vulnerabilities and Exposures',
    fullDescription: 'CVE is a dictionary of common names for publicly known cybersecurity vulnerabilities. It provides a standardized identifier for security vulnerabilities.',
    category: ['security', 'vulnerability'],
    projectTypes: ['web-app', 'api', 'desktop-app', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['cve', 'vulnerability', 'security', 'cybersecurity', 'exploit'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'MITRE',
    version: 'ongoing',
  },

  // Privacy & Data Protection
  {
    id: 'pipeda',
    name: 'PIPEDA',
    description: 'Personal Information Protection and Electronic Documents Act',
    fullDescription: 'PIPEDA is Canada\'s federal privacy law for private-sector organizations. It sets out ground rules for how businesses must handle personal information in the course of commercial activity.',
    category: ['privacy', 'data-protection'],
    projectTypes: ['web-app', 'api', 'mobile-app'],
    industries: ['general'],
    keywords: ['pipeda', 'privacy', 'canada', 'data-protection', 'personal-information'],
    complianceLevel: 'required' as const,
    region: ['CA'],
    source: 'Government of Canada',
    version: '2000',
  },
  {
    id: 'lgpd',
    name: 'LGPD',
    description: 'Lei Geral de Proteção de Dados',
    fullDescription: 'LGPD is Brazil\'s comprehensive data protection law. It establishes rules for the collection, processing, storage, and protection of personal data of individuals in Brazil.',
    category: ['privacy', 'data-protection'],
    projectTypes: ['web-app', 'api', 'mobile-app'],
    industries: ['general'],
    keywords: ['lgpd', 'privacy', 'brazil', 'data-protection', 'personal-data'],
    complianceLevel: 'required' as const,
    region: ['BR'],
    source: 'Brazilian Government',
    version: '2020',
  },

  // Aviation & Aerospace
  {
    id: 'do178c',
    name: 'DO-178C',
    description: 'Software Considerations in Airborne Systems',
    fullDescription: 'DO-178C is the primary document by which the certification authorities approve all commercial software-based aerospace systems. It defines software life cycle processes and objectives.',
    category: ['aviation', 'aerospace', 'safety'],
    projectTypes: ['embedded', 'avionics'],
    industries: ['aviation', 'aerospace'],
    keywords: ['do178c', 'aviation', 'aerospace', 'safety', 'airborne', 'certification'],
    complianceLevel: 'required' as const,
    region: ['global'],
    source: 'RTCA',
    version: '2011',
  },
  {
    id: 'do254',
    name: 'DO-254',
    description: 'Design Assurance Guidance for Airborne Electronic Hardware',
    fullDescription: 'DO-254 provides guidance for the development of airborne electronic hardware. It complements DO-178C for software and covers hardware development processes.',
    category: ['aviation', 'aerospace', 'hardware'],
    projectTypes: ['embedded', 'hardware'],
    industries: ['aviation', 'aerospace'],
    keywords: ['do254', 'aviation', 'hardware', 'electronic-hardware', 'certification'],
    complianceLevel: 'required' as const,
    region: ['global'],
    source: 'RTCA',
    version: '2000',
  },

  // Railway
  {
    id: 'en50128',
    name: 'EN 50128',
    description: 'Railway Applications - Software for Railway Control',
    fullDescription: 'EN 50128 specifies procedures and technical requirements for the development of programmable electronic systems for use in railway control and protection applications.',
    category: ['railway', 'safety'],
    projectTypes: ['embedded', 'railway-software'],
    industries: ['railway', 'transportation'],
    keywords: ['en50128', 'railway', 'rail', 'safety', 'control', 'signaling'],
    complianceLevel: 'required' as const,
    region: ['EU'],
    source: 'CENELEC',
    version: '2011',
  },

  // Nuclear
  {
    id: 'iec60880',
    name: 'IEC 60880',
    description: 'Nuclear Power Plants - Software for Computers',
    fullDescription: 'IEC 60880 provides requirements for software used in nuclear power plant systems performing category A functions (functions important to safety).',
    category: ['nuclear', 'safety'],
    projectTypes: ['embedded', 'nuclear-software'],
    industries: ['nuclear', 'energy'],
    keywords: ['iec60880', 'nuclear', 'safety', 'power-plant', 'critical-safety'],
    complianceLevel: 'required' as const,
    region: ['global'],
    source: 'IEC',
    version: '2006',
  },

  // Accessibility
  {
    id: 'section508',
    name: 'Section 508',
    description: 'Section 508 Accessibility Standards',
    fullDescription: 'Section 508 requires federal agencies to make their electronic and information technology accessible to people with disabilities. It applies to federal agencies and contractors.',
    category: ['accessibility', 'web'],
    projectTypes: ['web-app', 'desktop-app', 'mobile-app'],
    industries: ['government', 'federal'],
    keywords: ['section508', 'accessibility', 'ada', 'federal', 'government', 'disability'],
    complianceLevel: 'required' as const,
    region: ['US'],
    source: 'GSA',
    version: '2018',
  },
  {
    id: 'en301549',
    name: 'EN 301 549',
    description: 'Accessibility Requirements for ICT Products',
    fullDescription: 'EN 301 549 specifies accessibility requirements for ICT products and services. It is the European standard for digital accessibility.',
    category: ['accessibility'],
    projectTypes: ['web-app', 'desktop-app', 'mobile-app'],
    industries: ['general', 'government'],
    keywords: ['en301549', 'accessibility', 'ict', 'europe', 'a11y'],
    complianceLevel: 'required' as const,
    region: ['EU'],
    source: 'ETSI',
    version: '2021',
  },

  // Financial Services
  {
    id: 'basel-iii',
    name: 'Basel III',
    description: 'Basel III Regulatory Framework',
    fullDescription: 'Basel III is a comprehensive set of reform measures developed by the Basel Committee on Banking Supervision to strengthen regulation, supervision, and risk management of the banking sector.',
    category: ['finance', 'banking', 'regulatory'],
    projectTypes: ['web-app', 'api', 'banking-system'],
    industries: ['finance', 'banking'],
    keywords: ['basel-iii', 'banking', 'regulatory', 'capital', 'risk-management'],
    complianceLevel: 'required' as const,
    region: ['global'],
    source: 'BCBS',
    version: '2010',
  },
  {
    id: 'mifid-ii',
    name: 'MiFID II',
    description: 'Markets in Financial Instruments Directive II',
    fullDescription: 'MiFID II is a legislative framework for investment services in the European Union. It regulates investment firms, trading venues, and investor protection.',
    category: ['finance', 'regulatory'],
    projectTypes: ['web-app', 'api', 'trading-system'],
    industries: ['finance', 'investment'],
    keywords: ['mifid-ii', 'finance', 'investment', 'trading', 'eu', 'regulatory'],
    complianceLevel: 'required' as const,
    region: ['EU'],
    source: 'EU',
    version: '2018',
  },

  // Energy & Utilities
  {
    id: 'iec61508',
    name: 'IEC 61508',
    description: 'Functional Safety of Electrical/Electronic/Programmable Electronic Systems',
    fullDescription: 'IEC 61508 is a basic functional safety standard applicable to all electrical, electronic, and programmable electronic safety-related systems. It provides a framework for safety lifecycle management.',
    category: ['safety', 'industrial'],
    projectTypes: ['embedded', 'industrial-software'],
    industries: ['energy', 'manufacturing', 'industrial'],
    keywords: ['iec61508', 'functional-safety', 'safety-integrity', 'sil', 'industrial'],
    complianceLevel: 'required' as const,
    region: ['global'],
    source: 'IEC',
    version: '2010',
  },

  // DevOps & Continuous Delivery
  {
    id: 'iso20000',
    name: 'ISO/IEC 20000',
    description: 'IT Service Management',
    fullDescription: 'ISO/IEC 20000 is the international standard for IT service management. It specifies requirements for the service provider to plan, establish, implement, operate, monitor, review, maintain, and improve an SMS.',
    category: ['it-service-management', 'devops'],
    projectTypes: ['web-app', 'api', 'cloud-service'],
    industries: ['general', 'it-services'],
    keywords: ['iso20000', 'itsm', 'service-management', 'itil', 'devops'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC',
    version: '2018',
  },

  // Testing
  {
    id: 'iso29119',
    name: 'ISO/IEC/IEEE 29119',
    description: 'Software Testing Standards',
    fullDescription: 'ISO/IEC/IEEE 29119 provides a comprehensive set of standards for software testing. It covers test processes, test documentation, test techniques, and keyword-driven testing.',
    category: ['testing', 'software-engineering'],
    projectTypes: ['web-app', 'desktop-app', 'api', 'mobile-app', 'embedded'],
    industries: ['general'],
    keywords: ['iso29119', 'testing', 'test-processes', 'test-documentation', 'test-techniques'],
    complianceLevel: 'recommended' as const,
    region: ['global'],
    source: 'ISO/IEC/IEEE',
    version: '2013-2022',
  },
];

async function seedExtendedStandards() {
  try {
    await connectDatabase();
    console.log('✅ Connected to database');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const standard of additionalStandards) {
      const existing = await QualityStandard.findOne({ id: standard.id }).exec();

      if (existing) {
        await QualityStandard.updateOne(
          { id: standard.id },
          { $set: standard }
        ).exec();
        updated++;
        console.log(`✅ Updated: ${standard.name}`);
      } else {
        await QualityStandard.create(standard);
        created++;
        console.log(`✅ Created: ${standard.name}`);
      }
    }

    console.log(`\n✅ Extended standards seeding complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total: ${additionalStandards.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding extended standards:', error);
    process.exit(1);
  }
}

seedExtendedStandards();

