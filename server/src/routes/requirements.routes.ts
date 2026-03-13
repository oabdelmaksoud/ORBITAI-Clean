/**
 * Requirements Routes
 * API endpoints for requirements validation, compliance, and coverage
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirementsValidationService } from '../services/requirementsValidation.service.js';
import { requirementsComplianceService } from '../services/requirementsCompliance.service.js';
import { requirementsImpactAnalysisService } from '../services/requirementsImpactAnalysis.service.js';
import { aspiceComplianceService } from '../services/aspiceCompliance.service.js';
import { requirementsDependencyService } from '../services/requirementsDependency.service.js';
import { nonFunctionalRequirementsService } from '../services/nonFunctionalRequirements.service.js';
import { traceabilityMatrixService } from '../services/traceabilityMatrix.service.js';
import { Artifact } from '../models/Artifact.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * GET /api/v1/requirements/:projectId/coverage
 * Get requirements coverage report
 */
router.get('/:projectId/coverage', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting requirements coverage for project: ${projectId}`);

    // Get all artifacts
    const artifacts = await Artifact.find({ projectId }).lean();
    const reqArtifacts = artifacts.filter(a => a.type === 'requirement');

    if (reqArtifacts.length === 0) {
      return res.json({
        success: true,
        data: {
          projectId,
          totalRequirements: 0,
          implemented: 0,
          partial: 0,
          missing: 0,
          coverage: 0,
          requirements: [],
          issues: []
        }
      });
    }

    // Extract requirements
    const requirements = requirementsValidationService.extractRequirements(reqArtifacts);

    // Get validation report
    const validationReport = await requirementsValidationService.validateRequirementsCoverage(
      projectId,
      requirements,
      artifacts
    );

    res.json({
      success: true,
      data: validationReport
    });
  } catch (error: unknown) {
    logger.error('Failed to get requirements coverage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get requirements coverage',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/compliance
 * Get requirements compliance score
 */
router.get('/:projectId/compliance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting requirements compliance for project: ${projectId}`);

    const score = await requirementsComplianceService.calculateComplianceScore(projectId);

    res.json({
      success: true,
      data: score
    });
  } catch (error: unknown) {
    logger.error('Failed to get requirements compliance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get requirements compliance',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/missing
 * Get missing requirements
 */
router.get('/:projectId/missing', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting missing requirements for project: ${projectId}`);

    // Get all artifacts
    const artifacts = await Artifact.find({ projectId }).lean();
    const reqArtifacts = artifacts.filter(a => a.type === 'requirement');

    if (reqArtifacts.length === 0) {
      return res.json({
        success: true,
        data: {
          missing: [],
          partial: [],
          total: 0
        }
      });
    }

    // Extract requirements
    const requirements = requirementsValidationService.extractRequirements(reqArtifacts);

    // Get validation report
    const validationReport = await requirementsValidationService.validateRequirementsCoverage(
      projectId,
      requirements,
      artifacts
    );

    const missing = validationReport.requirements.filter(r => r.status === 'missing');
    const partial = validationReport.requirements.filter(r => r.status === 'partial');

    res.json({
      success: true,
      data: {
        missing: missing.map(r => ({
          id: r.id,
          description: r.description,
          priority: r.priority,
          sourceArtifactTitle: r.sourceArtifactTitle
        })),
        partial: partial.map(r => ({
          id: r.id,
          description: r.description,
          priority: r.priority,
          hasCode: r.linkedCode.length > 0,
          hasTests: r.linkedTests.length > 0,
          hasDesign: r.linkedDesigns.length > 0
        })),
        total: missing.length + partial.length
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get missing requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get missing requirements',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/requirements/:projectId/validate
 * Run full requirements validation
 */
router.post('/:projectId/validate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Running requirements validation for project: ${projectId}`);

    // Get all artifacts
    const artifacts = await Artifact.find({ projectId }).lean();
    const reqArtifacts = artifacts.filter(a => a.type === 'requirement');

    if (reqArtifacts.length === 0) {
      return res.json({
        success: true,
        data: {
          validationReport: {
            projectId,
            totalRequirements: 0,
            implemented: 0,
            partial: 0,
            missing: 0,
            coverage: 0,
            requirements: [],
            issues: [],
            generatedAt: new Date()
          },
          traceabilityReport: {
            projectId,
            totalRequirements: 0,
            requirementsWithTraceRefs: 0,
            requirementsWithoutTraceRefs: 0,
            traceabilityScore: 0,
            missingLinks: []
          },
          complianceReport: null
        }
      });
    }

    // Extract requirements
    const requirements = requirementsValidationService.extractRequirements(reqArtifacts);

    // Get validation report
    const validationReport = await requirementsValidationService.validateRequirementsCoverage(
      projectId,
      requirements,
      artifacts
    );

    // Get traceability report
    const traceabilityReport = requirementsValidationService.checkTraceability(
      requirements,
      artifacts
    );
    traceabilityReport.projectId = projectId;

    // Get compliance report (full)
    const complianceReport = await requirementsComplianceService.generateComplianceReport(projectId);

    res.json({
      success: true,
      data: {
        validationReport,
        traceabilityReport,
        complianceReport
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to validate requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate requirements',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/report
 * Get full compliance report
 */
router.get('/:projectId/report', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting compliance report for project: ${projectId}`);

    const report = await requirementsComplianceService.generateComplianceReport(projectId);

    res.json({
      success: true,
      data: report
    });
  } catch (error: unknown) {
    logger.error('Failed to get compliance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get compliance report',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/requirements/:projectId/:requirementId/impact
 * Analyze impact of requirement changes
 */
router.post('/:projectId/:requirementId/impact', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params;
    const { changes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Changes array is required'
      });
    }

    logger.info(`Analyzing impact of changes to requirement ${requirementId} in project ${projectId}`);

    const impactReport = await requirementsImpactAnalysisService.analyzeRequirementChange(
      projectId,
      requirementId,
      changes
    );

    const impactScore = requirementsImpactAnalysisService.calculateImpactScore(impactReport);

    res.json({
      success: true,
      data: {
        ...impactReport,
        impactScore
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to analyze requirement impact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze requirement impact',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/aspice
 * Get ASPICE compliance report
 */
router.get('/:projectId/aspice', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { level } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const targetLevel = level ? parseInt(level as string, 10) : 3;
    if (targetLevel < 1 || targetLevel > 5) {
      return res.status(400).json({
        success: false,
        message: 'ASPICE level must be between 1 and 5'
      });
    }

    logger.info(`Getting ASPICE Level ${targetLevel} compliance report for project: ${projectId}`);

    const report = await aspiceComplianceService.generateComplianceReport(projectId, targetLevel);

    res.json({
      success: true,
      data: report
    });
  } catch (error: unknown) {
    logger.error('Failed to get ASPICE compliance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ASPICE compliance report',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/requirements/:projectId/aspice/map
 * Map requirements to ASPICE process areas
 */
router.post('/:projectId/aspice/map', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { level } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const targetLevel = level || 3;
    if (targetLevel < 1 || targetLevel > 5) {
      return res.status(400).json({
        success: false,
        message: 'ASPICE level must be between 1 and 5'
      });
    }

    logger.info(`Mapping requirements to ASPICE Level ${targetLevel} for project: ${projectId}`);

    const complianceRecords = await aspiceComplianceService.mapRequirementsToASPICE(projectId, targetLevel);

    res.json({
      success: true,
      data: {
        mapped: complianceRecords.length,
        processAreas: complianceRecords.map(cr => ({
          processArea: cr.processArea,
          processAreaName: cr.processAreaName,
          complianceScore: cr.complianceScore,
          requirementsCount: cr.requirements.length
        }))
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to map requirements to ASPICE:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to map requirements to ASPICE',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/dependencies
 * Get requirement dependency analysis
 */
router.get('/:projectId/dependencies', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting requirement dependencies for project: ${projectId}`);

    const analysis = await requirementsDependencyService.analyzeDependencies(projectId);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error: unknown) {
    logger.error('Failed to get requirement dependencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get requirement dependencies',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/requirements/:projectId/dependencies
 * Add a dependency relationship
 */
router.post('/:projectId/dependencies', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { requirementId, targetRequirementId, dependencyType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!requirementId || !targetRequirementId || !dependencyType) {
      return res.status(400).json({
        success: false,
        message: 'requirementId, targetRequirementId, and dependencyType are required'
      });
    }

    logger.info(`Adding dependency: ${requirementId} ${dependencyType} ${targetRequirementId}`);

    await requirementsDependencyService.addDependency(
      projectId,
      requirementId,
      targetRequirementId,
      dependencyType
    );

    res.json({
      success: true,
      message: 'Dependency added successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to add dependency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add dependency',
      error: error.message
    });
  }
});

/**
 * DELETE /api/v1/requirements/:projectId/dependencies
 * Remove a dependency relationship
 */
router.delete('/:projectId/dependencies', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { requirementId, targetRequirementId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!requirementId || !targetRequirementId) {
      return res.status(400).json({
        success: false,
        message: 'requirementId and targetRequirementId are required'
      });
    }

    logger.info(`Removing dependency: ${requirementId} -> ${targetRequirementId}`);

    await requirementsDependencyService.removeDependency(
      projectId,
      requirementId,
      targetRequirementId
    );

    res.json({
      success: true,
      message: 'Dependency removed successfully'
    });
  } catch (error: unknown) {
    logger.error('Failed to remove dependency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove dependency',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/nfr
 * Get non-functional requirements tracing report
 */
router.get('/:projectId/nfr', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting NFR trace report for project: ${projectId}`);

    const report = await nonFunctionalRequirementsService.traceNFRs(projectId);

    res.json({
      success: true,
      data: report
    });
  } catch (error: unknown) {
    logger.error('Failed to get NFR trace report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get NFR trace report',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/traceability-matrix
 * Get traceability matrix
 */
router.get('/:projectId/traceability-matrix', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    logger.info(`Getting traceability matrix for project: ${projectId}`);

    const matrix = await traceabilityMatrixService.generateMatrix(projectId);

    res.json({
      success: true,
      data: matrix
    });
  } catch (error: unknown) {
    logger.error('Failed to get traceability matrix:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get traceability matrix',
      error: error.message
    });
  }
});

/**
 * GET /api/v1/requirements/:projectId/traceability-matrix/export
 * Export traceability matrix
 */
router.get('/:projectId/traceability-matrix/export', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { format, includeUnlinked, filterByType } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const exportFormat = (format as string) || 'csv';
    if (!['csv', 'excel', 'json'].includes(exportFormat)) {
      return res.status(400).json({
        success: false,
        message: 'Format must be csv, excel, or json'
      });
    }

    logger.info(`Exporting traceability matrix for project: ${projectId} as ${exportFormat}`);

    const matrix = await traceabilityMatrixService.generateMatrix(projectId);

    const options = {
      format: exportFormat as 'csv' | 'excel' | 'json',
      includeUnlinked: includeUnlinked === 'true',
      filterByType: filterByType ? (filterByType as string).split(',') : undefined
    };

    let content: string;
    let contentType: string;
    let filename: string;

    if (exportFormat === 'json') {
      content = traceabilityMatrixService.exportToJSON(matrix, options);
      contentType = 'application/json';
      filename = `traceability-matrix-${projectId}.json`;
    } else if (exportFormat === 'excel') {
      content = traceabilityMatrixService.exportToExcel(matrix, options);
      contentType = 'text/csv';
      filename = `traceability-matrix-${projectId}.csv`;
    } else {
      content = traceabilityMatrixService.exportToCSV(matrix, options);
      contentType = 'text/csv';
      filename = `traceability-matrix-${projectId}.csv`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error: unknown) {
    logger.error('Failed to export traceability matrix:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export traceability matrix',
      error: error.message
    });
  }
});

export default router;
