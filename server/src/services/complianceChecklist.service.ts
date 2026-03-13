/**
 * Compliance Checklist Service
 * Generates compliance checklists for GDPR, HIPAA, SOC2, PCI DSS, ISO 27001
 */

import { logger } from '../utils/logger.js';
import { ComplianceChecklist, IComplianceChecklist } from '../models/ComplianceChecklist.model.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

// Compliance standard templates
const COMPLIANCE_TEMPLATES = {
  gdpr: {
    name: 'GDPR (General Data Protection Regulation)',
    items: [
      { id: 'GDPR-001', category: 'Data Protection', requirement: 'Lawful basis for processing', description: 'Document lawful basis for all personal data processing' },
      { id: 'GDPR-002', category: 'Data Protection', requirement: 'Consent management', description: 'Implement consent collection and management system' },
      { id: 'GDPR-003', category: 'Data Subject Rights', requirement: 'Right to access', description: 'Users can request access to their personal data' },
      { id: 'GDPR-004', category: 'Data Subject Rights', requirement: 'Right to deletion', description: 'Users can request deletion of their personal data' },
      { id: 'GDPR-005', category: 'Data Subject Rights', requirement: 'Right to portability', description: 'Users can export their data in machine-readable format' },
      { id: 'GDPR-006', category: 'Data Security', requirement: 'Encryption at rest', description: 'Personal data encrypted when stored' },
      { id: 'GDPR-007', category: 'Data Security', requirement: 'Encryption in transit', description: 'Personal data encrypted during transmission' },
      { id: 'GDPR-008', category: 'Privacy', requirement: 'Privacy policy', description: 'Clear privacy policy published and accessible' },
      { id: 'GDPR-009', category: 'Data Breach', requirement: 'Breach notification', description: 'Process for notifying authorities within 72 hours' },
      { id: 'GDPR-010', category: 'Data Processing', requirement: 'Data minimization', description: 'Only collect data necessary for purpose' }
    ]
  },
  hipaa: {
    name: 'HIPAA (Health Insurance Portability and Accountability Act)',
    items: [
      { id: 'HIPAA-001', category: 'PHI Protection', requirement: 'Access controls', description: 'Role-based access controls for PHI' },
      { id: 'HIPAA-002', category: 'PHI Protection', requirement: 'Encryption', description: 'PHI encrypted at rest and in transit' },
      { id: 'HIPAA-003', category: 'PHI Protection', requirement: 'Audit logs', description: 'Comprehensive audit logs for PHI access' },
      { id: 'HIPAA-004', category: 'PHI Protection', requirement: 'Authentication', description: 'Strong authentication for PHI access' },
      { id: 'HIPAA-005', category: 'Administrative', requirement: 'Security officer', description: 'Designated security officer' },
      { id: 'HIPAA-006', category: 'Administrative', requirement: 'Training', description: 'Security awareness training for staff' },
      { id: 'HIPAA-007', category: 'Physical', requirement: 'Facility controls', description: 'Physical safeguards for PHI storage' },
      { id: 'HIPAA-008', category: 'Technical', requirement: 'Integrity controls', description: 'Mechanisms to prevent unauthorized PHI alteration' },
      { id: 'HIPAA-009', category: 'Technical', requirement: 'Transmission security', description: 'Secure transmission of PHI' },
      { id: 'HIPAA-010', category: 'Business Associate', requirement: 'BAAs', description: 'Business Associate Agreements in place' }
    ]
  },
  soc2: {
    name: 'SOC 2 (Service Organization Control 2)',
    items: [
      { id: 'SOC2-001', category: 'Security', requirement: 'Access controls', description: 'Logical and physical access controls' },
      { id: 'SOC2-002', category: 'Security', requirement: 'System monitoring', description: 'Continuous monitoring and logging' },
      { id: 'SOC2-003', category: 'Security', requirement: 'Vulnerability management', description: 'Regular vulnerability scanning and patching' },
      { id: 'SOC2-004', category: 'Availability', requirement: 'Uptime monitoring', description: 'System availability monitoring and reporting' },
      { id: 'SOC2-005', category: 'Availability', requirement: 'Incident response', description: 'Incident response procedures documented' },
      { id: 'SOC2-006', category: 'Confidentiality', requirement: 'Data classification', description: 'Data classification and handling procedures' },
      { id: 'SOC2-007', category: 'Confidentiality', requirement: 'Encryption', description: 'Encryption for sensitive data' },
      { id: 'SOC2-008', category: 'Processing Integrity', requirement: 'Data validation', description: 'Input validation and processing controls' },
      { id: 'SOC2-009', category: 'Processing Integrity', requirement: 'Error handling', description: 'Error detection and correction procedures' },
      { id: 'SOC2-010', category: 'Privacy', requirement: 'Privacy notice', description: 'Privacy notice and consent management' }
    ]
  },
  pci_dss: {
    name: 'PCI DSS (Payment Card Industry Data Security Standard)',
    items: [
      { id: 'PCI-001', category: 'Network Security', requirement: 'Firewall configuration', description: 'Firewall rules configured and maintained' },
      { id: 'PCI-002', category: 'Network Security', requirement: 'Default passwords', description: 'No default passwords in use' },
      { id: 'PCI-003', category: 'Cardholder Data', requirement: 'Data protection', description: 'Cardholder data protected at rest' },
      { id: 'PCI-004', category: 'Cardholder Data', requirement: 'Encryption in transit', description: 'Cardholder data encrypted during transmission' },
      { id: 'PCI-005', category: 'Vulnerability Management', requirement: 'Antivirus', description: 'Antivirus software installed and updated' },
      { id: 'PCI-006', category: 'Vulnerability Management', requirement: 'Secure systems', description: 'Systems developed and maintained securely' },
      { id: 'PCI-007', category: 'Access Control', requirement: 'Access restriction', description: 'Cardholder data access restricted to need-to-know' },
      { id: 'PCI-008', category: 'Access Control', requirement: 'Unique IDs', description: 'Unique user IDs for access' },
      { id: 'PCI-009', category: 'Physical Security', requirement: 'Physical access', description: 'Physical access to cardholder data restricted' },
      { id: 'PCI-010', category: 'Monitoring', requirement: 'Network monitoring', description: 'Network resources and cardholder data monitored' }
    ]
  },
  iso27001: {
    name: 'ISO 27001 (Information Security Management)',
    items: [
      { id: 'ISO-001', category: 'Information Security Policy', requirement: 'Policy document', description: 'Information security policy documented' },
      { id: 'ISO-002', category: 'Organization', requirement: 'Roles and responsibilities', description: 'Security roles and responsibilities defined' },
      { id: 'ISO-003', category: 'Human Resources', requirement: 'Background checks', description: 'Background verification for personnel' },
      { id: 'ISO-004', category: 'Asset Management', requirement: 'Asset inventory', description: 'Information assets identified and inventoried' },
      { id: 'ISO-005', category: 'Access Control', requirement: 'Access management', description: 'User access management procedures' },
      { id: 'ISO-006', category: 'Cryptography', requirement: 'Encryption', description: 'Cryptographic controls implemented' },
      { id: 'ISO-007', category: 'Operations Security', requirement: 'Malware protection', description: 'Controls against malware' },
      { id: 'ISO-008', category: 'Communications Security', requirement: 'Network security', description: 'Network security controls' },
      { id: 'ISO-009', category: 'Incident Management', requirement: 'Incident response', description: 'Information security incident management' },
      { id: 'ISO-010', category: 'Business Continuity', requirement: 'Continuity planning', description: 'Information security continuity' }
    ]
  }
};

export interface ComplianceReport {
  projectId: string;
  standard: string;
  overallCompliance: number;
  compliantItems: number;
  nonCompliantItems: number;
  partialItems: number;
  notAssessedItems: number;
  checklistItems: Array<{
    id: string;
    category: string;
    requirement: string;
    status: string;
    evidence: string[];
  }>;
  gaps: Array<{
    itemId: string;
    requirement: string;
    gap: string;
    severity: 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  generatedAt: Date;
}

class ComplianceChecklistService {
  /**
   * Generate compliance checklist for a standard
   */
  async generateChecklist(
    projectId: string,
    standard: IComplianceChecklist['standard']
  ): Promise<IComplianceChecklist> {
    try {
      logger.info(`Generating ${standard} compliance checklist for project ${projectId}`);

      const template = COMPLIANCE_TEMPLATES[standard];
      if (!template) {
        throw new Error(`Unknown compliance standard: ${standard}`);
      }

      // Get project artifacts for evidence
      const artifacts = await Artifact.find({ projectId }).lean();

      // Create checklist items
      const checklistItems = template.items.map(item => ({
        id: item.id,
        category: item.category,
        requirement: item.requirement,
        description: item.description,
        status: 'not_assessed' as const,
        evidence: this.findEvidence(artifacts, item.requirement, standard),
        notes: undefined,
        assessedAt: undefined,
        assessedBy: undefined
      }));

      // Auto-assess based on evidence
      for (const item of checklistItems) {
        if (item.evidence.length > 0) {
          item.status = 'compliant';
          item.assessedAt = new Date();
        }
      }

      // Calculate overall compliance
      const overallCompliance = this.calculateCompliance(checklistItems);

      // Create or update checklist
      const checklist = await ComplianceChecklist.findOneAndUpdate(
        { projectId, standard },
        {
          projectId,
          standard,
          checklistItems,
          overallCompliance,
          lastAssessed: new Date()
        },
        { upsert: true, new: true }
      );

      return checklist;
    } catch (error: unknown) {
      logger.error('Failed to generate compliance checklist:', error);
      throw error;
    }
  }

  /**
   * Find evidence for a requirement
   */
  private findEvidence(
    artifacts: IArtifact[],
    requirement: string,
    standard: string
  ): string[] {
    const evidence: string[] = [];
    const reqLower = requirement.toLowerCase();
    const keywords = reqLower.split(/\s+/).filter(w => w.length > 3);

    for (const artifact of artifacts) {
      const content = (artifact.content || '').toLowerCase();
      const title = artifact.title.toLowerCase();

      // Check if artifact relates to requirement
      const matches = keywords.filter(kw => 
        content.includes(kw) || title.includes(kw)
      );

      if (matches.length >= 2) {
        evidence.push(artifact._id.toString());
      }

      // Standard-specific checks
      if (standard === 'gdpr' && (content.includes('consent') || content.includes('privacy'))) {
        if (reqLower.includes('consent') || reqLower.includes('privacy')) {
          evidence.push(artifact._id.toString());
        }
      }

      if (standard === 'hipaa' && (content.includes('phi') || content.includes('health'))) {
        if (reqLower.includes('phi') || reqLower.includes('health')) {
          evidence.push(artifact._id.toString());
        }
      }

      if (standard === 'pci_dss' && (content.includes('payment') || content.includes('card'))) {
        if (reqLower.includes('payment') || reqLower.includes('card')) {
          evidence.push(artifact._id.toString());
        }
      }
    }

    return Array.from(new Set(evidence));
  }

  /**
   * Calculate compliance percentage
   */
  private calculateCompliance(items: IComplianceChecklist['checklistItems']): number {
    if (items.length === 0) return 0;

    const compliant = items.filter(i => i.status === 'compliant').length;
    const partial = items.filter(i => i.status === 'partial').length;
    const notApplicable = items.filter(i => i.status === 'not_applicable').length;
    const assessed = items.length - items.filter(i => i.status === 'not_assessed').length;

    if (assessed === 0) return 0;

    // Compliant = 100%, Partial = 50%, Non-compliant = 0%
    const score = (compliant * 100 + partial * 50) / assessed;
    return Math.round(score);
  }

  /**
   * Auto-validate compliance
   */
  async validateCompliance(
    projectId: string,
    standard: IComplianceChecklist['standard']
  ): Promise<ComplianceReport> {
    try {
      let checklist = await ComplianceChecklist.findOne({ projectId, standard });

      if (!checklist) {
        checklist = await this.generateChecklist(projectId, standard);
      }

      // Re-assess with current artifacts
      const artifacts = await Artifact.find({ projectId }).lean();

      for (const item of checklist.checklistItems) {
        const evidence = this.findEvidence(artifacts, item.requirement, standard);
        item.evidence = evidence;

        // Auto-assess
        if (evidence.length >= 2) {
          item.status = 'compliant';
        } else if (evidence.length === 1) {
          item.status = 'partial';
        } else if (item.status === 'not_assessed') {
          item.status = 'non_compliant';
        }
      }

      checklist.overallCompliance = this.calculateCompliance(checklist.checklistItems);
      checklist.lastAssessed = new Date();
      await checklist.save();

      // Identify gaps
      const gaps = this.identifyGaps(checklist);

      return {
        projectId,
        standard,
        overallCompliance: checklist.overallCompliance,
        compliantItems: checklist.checklistItems.filter(i => i.status === 'compliant').length,
        nonCompliantItems: checklist.checklistItems.filter(i => i.status === 'non_compliant').length,
        partialItems: checklist.checklistItems.filter(i => i.status === 'partial').length,
        notAssessedItems: checklist.checklistItems.filter(i => i.status === 'not_assessed').length,
        checklistItems: checklist.checklistItems.map(item => ({
          id: item.id,
          category: item.category,
          requirement: item.requirement,
          status: item.status,
          evidence: item.evidence
        })),
        gaps,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to validate compliance:', error);
      throw error;
    }
  }

  /**
   * Identify compliance gaps
   */
  private identifyGaps(checklist: IComplianceChecklist): ComplianceReport['gaps'] {
    const gaps: ComplianceReport['gaps'] = [];

    for (const item of checklist.checklistItems) {
      if (item.status === 'non_compliant' || item.status === 'partial') {
        const severity = item.status === 'non_compliant' ? 'high' : 'medium';
        gaps.push({
          itemId: item.id,
          requirement: item.requirement,
          gap: `Missing or insufficient evidence for: ${item.description}`,
          severity,
          recommendation: this.getRecommendation(item.requirement, checklist.standard)
        });
      }
    }

    return gaps;
  }

  /**
   * Get recommendation for requirement
   */
  private getRecommendation(requirement: string, standard: string): string {
    const reqLower = requirement.toLowerCase();

    if (reqLower.includes('encryption')) {
      return 'Implement encryption for data at rest and in transit';
    }
    if (reqLower.includes('access') || reqLower.includes('authentication')) {
      return 'Implement role-based access control and strong authentication';
    }
    if (reqLower.includes('audit') || reqLower.includes('log')) {
      return 'Implement comprehensive audit logging';
    }
    if (reqLower.includes('consent') || reqLower.includes('privacy')) {
      return 'Implement consent management and privacy controls';
    }
    if (reqLower.includes('incident') || reqLower.includes('breach')) {
      return 'Document and implement incident response procedures';
    }

    return `Implement controls to meet ${requirement} requirement`;
  }
}

export const complianceChecklistService = new ComplianceChecklistService();



