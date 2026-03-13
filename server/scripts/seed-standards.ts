/**
 * Script to seed quality standards into the database
 * Usage: npm run seed-standards
 * 
 * This script populates the database with comprehensive quality standards
 * based on industry research and best practices.
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { QualityStandard } from '../src/models/QualityStandard.model.js';

const STANDARDS = [
  // Automotive & Functional Safety
  {
    id: 'aspice',
    name: 'ASPICE',
    description: 'Automotive SPICE - Process Assessment Model for automotive software development',
    fullDescription: 'Automotive SPICE (Software Process Improvement and Capability Determination) is a framework for assessing and improving software development processes in the automotive industry. It provides a structured approach to process assessment and improvement.',
    category: ['automotive', 'safety'],
    projectTypes: ['embedded', 'firmware'],
    industries: ['automotive'],
    keywords: ['aspice', 'automotive', 'spice', 'process', 'assessment', 'automotive-software'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'Automotive SIG',
    version: '3.1'
  },
  {
    id: 'iso26262',
    name: 'ISO 26262',
    description: 'Functional Safety road vehicles - Automotive safety standard',
    fullDescription: 'ISO 26262 is an international standard for functional safety of electrical and electronic systems in road vehicles. It addresses the entire safety lifecycle from concept to decommissioning.',
    category: ['automotive', 'safety'],
    projectTypes: ['embedded', 'firmware'],
    industries: ['automotive'],
    keywords: ['iso26262', 'functional-safety', 'automotive', 'asil', 'safety-critical', 'road-vehicles'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'ISO',
    version: '2018'
  },
  {
    id: 'iec61508',
    name: 'IEC 61508',
    description: 'Functional Safety of Electrical/Electronic/Programmable Electronic Safety Systems',
    fullDescription: 'IEC 61508 is the international standard for functional safety of electrical, electronic, and programmable electronic safety-related systems. It provides a generic approach to safety lifecycle.',
    category: ['safety', 'embedded'],
    projectTypes: ['embedded', 'firmware'],
    industries: ['automotive', 'industrial', 'nuclear'],
    keywords: ['iec61508', 'functional-safety', 'safety-critical', 'sil', 'safety-integrity-level'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'IEC',
    version: '2010'
  },
  
  // Aerospace & Aviation
  {
    id: 'do178c',
    name: 'DO-178C',
    description: 'Software Considerations in Airborne Systems and Equipment Certification',
    fullDescription: 'DO-178C is the primary standard for software development in airborne systems. It defines software life cycle processes and objectives for software used in civil aviation products.',
    category: ['aerospace', 'safety'],
    projectTypes: ['embedded', 'firmware'],
    industries: ['aerospace'],
    keywords: ['do178c', 'aerospace', 'aviation', 'airborne', 'certification', 'rtca'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'RTCA',
    version: '2012'
  },
  {
    id: 'do254',
    name: 'DO-254',
    description: 'Design Assurance Guidance for Airborne Electronic Hardware',
    fullDescription: 'DO-254 provides guidance for the development of airborne electronic hardware, including complex electronic hardware used in safety-critical aviation systems.',
    category: ['aerospace', 'safety'],
    projectTypes: ['embedded', 'hardware'],
    industries: ['aerospace'],
    keywords: ['do254', 'aerospace', 'hardware', 'electronic-hardware', 'avionics'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'RTCA',
    version: '2000'
  },
  {
    id: 'arp4754a',
    name: 'ARP 4754A',
    description: 'Guidelines for Development of Civil Aircraft and Systems',
    fullDescription: 'ARP 4754A provides guidelines for the development of civil aircraft and systems, focusing on the aircraft and system development process.',
    category: ['aerospace', 'safety'],
    projectTypes: ['embedded', 'system'],
    industries: ['aerospace'],
    keywords: ['arp4754a', 'aerospace', 'aircraft', 'systems', 'safety-assessment'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'SAE',
    version: '2010'
  },
  
  // Railway
  {
    id: 'en50128',
    name: 'EN 50128',
    description: 'Railway applications - Software for railway control and protection systems',
    fullDescription: 'EN 50128 specifies procedures and technical requirements for the development of programmable electronic systems for use in railway control and protection applications.',
    category: ['railway', 'safety'],
    projectTypes: ['embedded', 'firmware'],
    industries: ['railway'],
    keywords: ['en50128', 'railway', 'rail', 'train', 'control-systems', 'safety-critical'],
    complianceLevel: 'required',
    region: ['EU'],
    source: 'CENELEC',
    version: '2011'
  },
  {
    id: 'iec62279',
    name: 'IEC 62279',
    description: 'Railway applications - Communication, signalling and processing systems',
    fullDescription: 'IEC 62279 specifies requirements for software used in railway control and protection systems, including communication and signalling applications.',
    category: ['railway', 'safety'],
    projectTypes: ['embedded', 'communication'],
    industries: ['railway'],
    keywords: ['iec62279', 'railway', 'signalling', 'communication', 'railway-systems'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'IEC',
    version: '2015'
  },
  
  // Healthcare & Medical Devices
  {
    id: 'iec62304',
    name: 'IEC 62304',
    description: 'Medical Device Software Life Cycle Processes',
    fullDescription: 'IEC 62304 specifies life cycle requirements for the development of medical device software. It covers software development, maintenance, and risk management.',
    category: ['medical', 'safety'],
    projectTypes: ['embedded', 'firmware', 'mobile-app', 'web-app'],
    industries: ['healthcare'],
    keywords: ['iec62304', 'medical-device', 'healthcare', 'software-lifecycle', 'fda'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'IEC',
    version: '2006'
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act - Healthcare data protection',
    fullDescription: 'HIPAA establishes national standards to protect sensitive patient health information from being disclosed without the patient\'s consent or knowledge.',
    category: ['healthcare', 'security', 'privacy'],
    projectTypes: ['web-app', 'mobile-app', 'api'],
    industries: ['healthcare'],
    keywords: ['hipaa', 'healthcare', 'patient-data', 'phi', 'protected-health-information', 'privacy'],
    complianceLevel: 'required',
    region: ['US'],
    source: 'US Government',
    version: '1996'
  },
  {
    id: 'fda21cfr',
    name: 'FDA 21 CFR Part 820',
    description: 'Quality System Regulation for Medical Devices',
    fullDescription: 'FDA 21 CFR Part 820 establishes quality system requirements for the design, manufacture, packaging, labeling, storage, installation, and servicing of medical devices.',
    category: ['medical', 'quality'],
    projectTypes: ['embedded', 'firmware', 'medical-device'],
    industries: ['healthcare'],
    keywords: ['fda', '21cfr820', 'medical-device', 'quality-system', 'fda-regulation'],
    complianceLevel: 'required',
    region: ['US'],
    source: 'FDA',
    version: '1996'
  },
  {
    id: 'iso13485',
    name: 'ISO 13485',
    description: 'Medical Devices - Quality Management Systems',
    fullDescription: 'ISO 13485 specifies requirements for a quality management system for organizations involved in the design, development, production, installation, and servicing of medical devices.',
    category: ['medical', 'quality'],
    projectTypes: ['embedded', 'firmware', 'medical-device'],
    industries: ['healthcare'],
    keywords: ['iso13485', 'medical-device', 'quality-management', 'qms', 'medical-equipment'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'ISO',
    version: '2016'
  },
  
  // Web Application Security & Accessibility
  {
    id: 'owasp',
    name: 'OWASP Top 10',
    description: 'OWASP Top 10 - Web Application Security Risks',
    fullDescription: 'OWASP Top 10 is a standard awareness document for developers and web application security. It represents a broad consensus about the most critical security risks to web applications.',
    category: ['security', 'web'],
    projectTypes: ['web-app', 'api', 'mobile-app'],
    industries: ['general', 'e-commerce', 'finance', 'healthcare'],
    keywords: ['owasp', 'web-security', 'application-security', 'security-risks', 'vulnerabilities'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'OWASP',
    version: '2021'
  },
  {
    id: 'wcag',
    name: 'WCAG 2.1',
    description: 'Web Content Accessibility Guidelines 2.1 - Accessibility standards',
    fullDescription: 'WCAG 2.1 provides guidelines for making web content more accessible to people with disabilities. It covers a wide range of recommendations for making web content more accessible.',
    category: ['accessibility', 'web'],
    projectTypes: ['web-app', 'mobile-app'],
    industries: ['general', 'government', 'education'],
    keywords: ['wcag', 'accessibility', 'a11y', 'ada', 'section508', 'web-accessibility'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'W3C',
    version: '2.1'
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description: 'Information Security Management Systems',
    fullDescription: 'ISO 27001 is an international standard for information security management systems (ISMS). It provides a framework for managing information security risks.',
    category: ['security', 'information-security'],
    projectTypes: ['web-app', 'api', 'cloud'],
    industries: ['general', 'finance', 'healthcare', 'government'],
    keywords: ['iso27001', 'information-security', 'isms', 'cybersecurity', 'data-protection'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO',
    version: '2022'
  },
  {
    id: 'nist',
    name: 'NIST Cybersecurity Framework',
    description: 'Framework for Improving Critical Infrastructure Cybersecurity',
    fullDescription: 'The NIST Cybersecurity Framework provides a policy framework of computer security guidance for how private sector organizations can assess and improve their ability to prevent, detect, and respond to cyber attacks.',
    category: ['security', 'cybersecurity'],
    projectTypes: ['web-app', 'api', 'cloud', 'infrastructure'],
    industries: ['general', 'government', 'finance', 'critical-infrastructure'],
    keywords: ['nist', 'cybersecurity-framework', 'critical-infrastructure', 'security-framework'],
    complianceLevel: 'recommended',
    region: ['US'],
    source: 'NIST',
    version: '1.1'
  },
  
  // Data Protection & Privacy
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'General Data Protection Regulation - EU data privacy law',
    fullDescription: 'GDPR is a regulation in EU law on data protection and privacy. It applies to all organizations processing personal data of EU residents, regardless of location.',
    category: ['privacy', 'data-protection'],
    projectTypes: ['web-app', 'mobile-app', 'api'],
    industries: ['general', 'e-commerce', 'healthcare', 'finance'],
    keywords: ['gdpr', 'data-protection', 'privacy', 'eu', 'personal-data', 'data-privacy'],
    complianceLevel: 'required',
    region: ['EU'],
    source: 'EU',
    version: '2018'
  },
  {
    id: 'ccpa',
    name: 'CCPA',
    description: 'California Consumer Privacy Act - Data privacy regulation',
    fullDescription: 'CCPA gives California residents the right to know what personal information is collected, used, shared, or sold, and the right to delete personal information held by businesses.',
    category: ['privacy', 'data-protection'],
    projectTypes: ['web-app', 'mobile-app', 'api'],
    industries: ['general', 'e-commerce', 'retail'],
    keywords: ['ccpa', 'california', 'consumer-privacy', 'data-privacy', 'us-privacy'],
    complianceLevel: 'required',
    region: ['US', 'California'],
    source: 'California State',
    version: '2020'
  },
  {
    id: 'pipeda',
    name: 'PIPEDA',
    description: 'Personal Information Protection and Electronic Documents Act - Canada',
    fullDescription: 'PIPEDA governs how private sector organizations collect, use, and disclose personal information in the course of commercial business in Canada.',
    category: ['privacy', 'data-protection'],
    projectTypes: ['web-app', 'mobile-app', 'api'],
    industries: ['general', 'e-commerce'],
    keywords: ['pipeda', 'canada', 'data-protection', 'privacy', 'canadian-privacy'],
    complianceLevel: 'required',
    region: ['Canada'],
    source: 'Government of Canada',
    version: '2000'
  },
  
  // Financial & Payment Processing
  {
    id: 'pci-dss',
    name: 'PCI-DSS',
    description: 'Payment Card Industry Data Security Standard',
    fullDescription: 'PCI-DSS is a set of security standards designed to ensure that all companies that accept, process, store, or transmit credit card information maintain a secure environment.',
    category: ['security', 'finance'],
    projectTypes: ['web-app', 'api', 'payment'],
    industries: ['finance', 'e-commerce', 'retail'],
    keywords: ['pci-dss', 'pci', 'payment-card', 'credit-card', 'payment-security', 'card-data'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'PCI SSC',
    version: '3.2.1'
  },
  {
    id: 'sox',
    name: 'SOX',
    description: 'Sarbanes-Oxley Act - Financial reporting compliance',
    fullDescription: 'SOX is a US federal law that sets requirements for all US public company boards, management, and public accounting firms. It focuses on financial reporting accuracy and transparency.',
    category: ['finance', 'compliance'],
    projectTypes: ['web-app', 'api', 'financial-system'],
    industries: ['finance'],
    keywords: ['sox', 'sarbanes-oxley', 'financial-reporting', 'compliance', 'public-company'],
    complianceLevel: 'required',
    region: ['US'],
    source: 'US Government',
    version: '2002'
  },
  {
    id: 'basel',
    name: 'Basel III',
    description: 'International banking regulations for risk management',
    fullDescription: 'Basel III is a set of international banking regulations developed by the Basel Committee on Banking Supervision to strengthen bank capital requirements and risk management.',
    category: ['finance', 'risk-management'],
    projectTypes: ['financial-system', 'banking'],
    industries: ['finance'],
    keywords: ['basel', 'basel3', 'banking-regulation', 'risk-management', 'capital-requirements'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'Basel Committee',
    version: '2010'
  },
  
  // Cloud & SaaS
  {
    id: 'soc2',
    name: 'SOC 2',
    description: 'Service Organization Control 2 - Trust service criteria for cloud services',
    fullDescription: 'SOC 2 is an auditing procedure that ensures service providers securely manage data to protect the interests of their organization and the privacy of their clients.',
    category: ['security', 'cloud'],
    projectTypes: ['cloud', 'saas', 'api'],
    industries: ['general', 'saas', 'cloud'],
    keywords: ['soc2', 'cloud-security', 'saas', 'trust-services', 'service-organization'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'AICPA',
    version: '2017'
  },
  {
    id: 'iso20000',
    name: 'ISO 20000',
    description: 'IT Service Management Systems',
    fullDescription: 'ISO 20000 is the international standard for IT service management. It specifies requirements for establishing, implementing, maintaining, and continually improving a service management system.',
    category: ['it-service-management', 'cloud'],
    projectTypes: ['cloud', 'saas', 'it-services'],
    industries: ['general', 'saas', 'cloud'],
    keywords: ['iso20000', 'itsm', 'it-service-management', 'service-management', 'cloud-services'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO',
    version: '2018'
  },
  
  // Software Development Lifecycle
  {
    id: 'iso12207',
    name: 'ISO/IEC 12207',
    description: 'Software Life Cycle Processes - Software development lifecycle standard',
    fullDescription: 'ISO/IEC 12207 establishes a common framework for software life cycle processes, with well-defined terminology that can be referenced by the software industry.',
    category: ['software-development', 'lifecycle'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['iso12207', 'software-lifecycle', 'sdlc', 'software-processes', 'lifecycle-processes'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO/IEC',
    version: '2017'
  },
  {
    id: 'iso29119',
    name: 'ISO/IEC 29119',
    description: 'Software Testing - Testing standards and processes',
    fullDescription: 'ISO/IEC 29119 is a series of standards for software testing that define vocabulary, processes, documentation, techniques, and a process assessment model.',
    category: ['testing', 'quality'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['iso29119', 'software-testing', 'test-processes', 'test-documentation', 'testing-standards'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO/IEC',
    version: '2013'
  },
  {
    id: 'ieee830',
    name: 'IEEE 830',
    description: 'IEEE 830 - Software Requirements Specifications',
    fullDescription: 'IEEE 830 provides recommendations for the structure and content of software requirements specifications (SRS). It helps ensure requirements are complete, consistent, and verifiable.',
    category: ['requirements', 'software-development'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['ieee830', 'requirements', 'srs', 'software-requirements', 'requirements-specification'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'IEEE',
    version: '1998'
  },
  {
    id: 'iso25010',
    name: 'ISO/IEC 25010',
    description: 'Systems and Software Quality Models',
    fullDescription: 'ISO/IEC 25010 defines quality models for systems and software, including quality characteristics and sub-characteristics that can be used to evaluate software quality.',
    category: ['quality', 'software-development'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['iso25010', 'software-quality', 'quality-model', 'quality-characteristics', 'sqae'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO/IEC',
    version: '2011'
  },
  
  // Project Management
  {
    id: 'iso21500',
    name: 'ISO 21500',
    description: 'Guidance on Project Management',
    fullDescription: 'ISO 21500 provides guidance on concepts and processes of project management that are important for, and have impact on, the performance of projects.',
    category: ['project-management'],
    projectTypes: ['general'],
    industries: ['general'],
    keywords: ['iso21500', 'project-management', 'pm', 'project-processes', 'project-guidance'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO',
    version: '2012'
  },
  {
    id: 'iso10006',
    name: 'ISO 10006',
    description: 'Quality Management in Projects',
    fullDescription: 'ISO 10006 provides guidelines for quality management in projects. It focuses on the application of quality management principles to project processes.',
    category: ['project-management', 'quality'],
    projectTypes: ['general'],
    industries: ['general'],
    keywords: ['iso10006', 'quality-management', 'project-quality', 'qms-projects'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO',
    version: '2017'
  },
  {
    id: 'pmbok',
    name: 'PMBOK Guide',
    description: 'Project Management Body of Knowledge - PMI standard',
    fullDescription: 'PMBOK Guide is a set of standard terminology and guidelines for project management. It provides a framework for managing projects across various industries.',
    category: ['project-management'],
    projectTypes: ['general'],
    industries: ['general'],
    keywords: ['pmbok', 'project-management', 'pmi', 'project-framework', 'project-processes'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'PMI',
    version: '7th Edition'
  },
  
  // Process Improvement
  {
    id: 'cmmi',
    name: 'CMMI',
    description: 'Capability Maturity Model Integration - Process improvement framework',
    fullDescription: 'CMMI is a process improvement framework that provides organizations with the essential elements of effective processes. It helps improve performance and capability.',
    category: ['process-improvement', 'quality'],
    projectTypes: ['general'],
    industries: ['general', 'enterprise'],
    keywords: ['cmmi', 'process-improvement', 'maturity-model', 'capability-maturity', 'process-framework'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'CMMI Institute',
    version: '2.0'
  },
  {
    id: 'iso9001',
    name: 'ISO 9001',
    description: 'Quality Management Systems',
    fullDescription: 'ISO 9001 specifies requirements for a quality management system. It helps organizations demonstrate their ability to consistently provide products and services that meet customer and regulatory requirements.',
    category: ['quality', 'management'],
    projectTypes: ['general'],
    industries: ['general'],
    keywords: ['iso9001', 'quality-management', 'qms', 'quality-system', 'iso9000'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO',
    version: '2015'
  },
  
  // Nuclear & Energy
  {
    id: 'iec61513',
    name: 'IEC 61513',
    description: 'Nuclear Power Plants - Instrumentation and control systems',
    fullDescription: 'IEC 61513 provides requirements for instrumentation and control systems important to safety in nuclear power plants. It covers the entire lifecycle of I&C systems.',
    category: ['nuclear', 'safety'],
    projectTypes: ['embedded', 'control-system'],
    industries: ['nuclear', 'energy'],
    keywords: ['iec61513', 'nuclear', 'power-plant', 'instrumentation', 'control-systems', 'safety-critical'],
    complianceLevel: 'required',
    region: ['global'],
    source: 'IEC',
    version: '2011'
  },
  
  // General Software Quality
  {
    id: 'iso9126',
    name: 'ISO/IEC 9126',
    description: 'Software Product Quality - Quality characteristics and metrics',
    fullDescription: 'ISO/IEC 9126 defines a quality model for software products, including quality characteristics and metrics that can be used to evaluate software quality.',
    category: ['quality', 'software-development'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['iso9126', 'software-quality', 'quality-characteristics', 'quality-metrics'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'ISO/IEC',
    version: '2001'
  },
  {
    id: 'ieee1012',
    name: 'IEEE 1012',
    description: 'Software Verification and Validation',
    fullDescription: 'IEEE 1012 provides a framework for software verification and validation (V&V) processes. It defines V&V processes, activities, and tasks throughout the software lifecycle.',
    category: ['testing', 'verification', 'validation'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['ieee1012', 'verification', 'validation', 'v&v', 'software-v&v'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'IEEE',
    version: '2016'
  },
  {
    id: 'ieee1028',
    name: 'IEEE 1028',
    description: 'Software Reviews and Audits',
    fullDescription: 'IEEE 1028 provides requirements for software reviews and audits. It defines processes for conducting software reviews, walkthroughs, inspections, and audits.',
    category: ['quality', 'reviews', 'audits'],
    projectTypes: ['web-app', 'mobile-app', 'api', 'embedded'],
    industries: ['general'],
    keywords: ['ieee1028', 'software-reviews', 'audits', 'inspections', 'walkthroughs'],
    complianceLevel: 'recommended',
    region: ['global'],
    source: 'IEEE',
    version: '2008'
  }
];

async function seedStandards() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || config.mongodbUri;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing standards (optional - comment out if you want to keep existing)
    // await QualityStandard.deleteMany({});
    // console.log('✅ Cleared existing standards');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const standardData of STANDARDS) {
      try {
        const existing = await QualityStandard.findOne({ id: standardData.id });
        
        if (existing) {
          // Update existing standard
          Object.assign(existing, standardData);
          await existing.save();
          updated++;
          console.log(`✅ Updated standard: ${standardData.name}`);
        } else {
          // Create new standard
          await QualityStandard.create(standardData);
          created++;
          console.log(`✅ Created standard: ${standardData.name}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to seed standard ${standardData.name}:`, error.message);
        skipped++;
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${STANDARDS.length}`);

    // Verify standards count
    const totalStandards = await QualityStandard.countDocuments({ isActive: true });
    console.log(`\n✅ Total active standards in database: ${totalStandards}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to seed standards:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedStandards();
}

export { seedStandards };
