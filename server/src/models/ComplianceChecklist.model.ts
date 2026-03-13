/**
 * Compliance Checklist Model
 * Tracks compliance checklists for various standards
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IComplianceChecklist extends Document {
  projectId: string;
  standard: 'gdpr' | 'hipaa' | 'soc2' | 'pci_dss' | 'iso27001' | 'aspice' | 'custom';
  checklistItems: Array<{
    id: string;
    category: string;
    requirement: string;
    description: string;
    status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable' | 'not_assessed';
    evidence: string[]; // Artifact IDs
    notes?: string;
    assessedAt?: Date;
    assessedBy?: string;
  }>;
  overallCompliance: number; // 0-100
  lastAssessed: Date;
  assessedBy?: string;
}

const ComplianceChecklistSchema = new Schema<IComplianceChecklist>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    standard: {
      type: String,
      required: true,
      enum: ['gdpr', 'hipaa', 'soc2', 'pci_dss', 'iso27001', 'aspice', 'custom'],
      index: true
    },
    checklistItems: [{
      id: String,
      category: String,
      requirement: String,
      description: String,
      status: {
        type: String,
        enum: ['compliant', 'non_compliant', 'partial', 'not_applicable', 'not_assessed'],
        default: 'not_assessed'
      },
      evidence: [String],
      notes: String,
      assessedAt: Date,
      assessedBy: String
    }],
    overallCompliance: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    lastAssessed: {
      type: Date,
      default: Date.now
    },
    assessedBy: String
  },
  {
    timestamps: true
  }
);

// Indexes
ComplianceChecklistSchema.index({ projectId: 1, standard: 1 }, { unique: true });
ComplianceChecklistSchema.index({ projectId: 1, overallCompliance: -1 });

export const ComplianceChecklist = mongoose.model<IComplianceChecklist>('ComplianceChecklist', ComplianceChecklistSchema);



