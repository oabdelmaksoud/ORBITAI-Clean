/**
 * ASPICE Compliance Model
 * Tracks compliance with ASPICE (Automotive SPICE) standards
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IASPICECompliance extends Document {
  projectId: string;
  processArea: string; // SYS.1, SYS.2, SWE.1, etc.
  processAreaName: string;
  level: number; // 1-5 (ASPICE level)
  complianceScore: number; // 0-100
  requirements: Array<{
    requirementId: string;
    requirementTitle: string;
    mapped: boolean;
    evidence: string[]; // Artifact IDs that provide evidence
  }>;
  workProducts: Array<{
    workProductId: string;
    workProductType: string;
    status: 'complete' | 'partial' | 'missing';
    evidence: string[]; // Artifact IDs
  }>;
  practices: Array<{
    practiceId: string;
    practiceName: string;
    implemented: boolean;
    evidence: string[]; // Artifact IDs
  }>;
  lastAssessed: Date;
  assessedBy?: string;
  notes?: string;
}

const ASPICEComplianceSchema = new Schema<IASPICECompliance>(
  {
    projectId: {
      type: String,
      required: true,
      index: true
    },
    processArea: {
      type: String,
      required: true,
      enum: [
        'SYS.1', 'SYS.2', 'SYS.3', 'SYS.4', 'SYS.5',
        'SWE.1', 'SWE.2', 'SWE.3', 'SWE.4', 'SWE.5', 'SWE.6',
        'SUP.1', 'SUP.2', 'SUP.8', 'SUP.9', 'SUP.10',
        'MAN.3', 'MAN.5'
      ],
      index: true
    },
    processAreaName: {
      type: String,
      required: true
    },
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 3
    },
    complianceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0
    },
    requirements: [{
      requirementId: String,
      requirementTitle: String,
      mapped: { type: Boolean, default: false },
      evidence: [String]
    }],
    workProducts: [{
      workProductId: String,
      workProductType: String,
      status: {
        type: String,
        enum: ['complete', 'partial', 'missing'],
        default: 'missing'
      },
      evidence: [String]
    }],
    practices: [{
      practiceId: String,
      practiceName: String,
      implemented: { type: Boolean, default: false },
      evidence: [String]
    }],
    lastAssessed: {
      type: Date,
      default: Date.now
    },
    assessedBy: String,
    notes: String
  },
  {
    timestamps: true
  }
);

// Indexes
ASPICEComplianceSchema.index({ projectId: 1, processArea: 1 }, { unique: true });
ASPICEComplianceSchema.index({ projectId: 1, complianceScore: -1 });

export const ASPICECompliance = mongoose.model<IASPICECompliance>(
  'ASPICECompliance',
  ASPICEComplianceSchema
);



