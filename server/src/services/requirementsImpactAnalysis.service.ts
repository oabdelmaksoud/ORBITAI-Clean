/**
 * Requirements Impact Analysis Service
 * Analyzes the impact of requirement changes on code, tests, and designs
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { requirementsValidationService, ParsedRequirement } from './requirementsValidation.service.js';
import { neo4jService } from './neo4j.service.js';

export interface RequirementChange {
  requirementId: string;
  changeType: 'added' | 'modified' | 'deleted' | 'priority_changed';
  oldValue?: string;
  newValue?: string;
  description: string;
}

export interface AffectedArtifact {
  artifactId: string;
  artifactTitle: string;
  artifactType: string;
  impactLevel: 'high' | 'medium' | 'low';
  impactReason: string;
  changeRequired: boolean;
  estimatedEffort?: number; // hours
}

export interface ImpactAnalysisReport {
  requirementId: string;
  requirementTitle: string;
  changeType: string;
  affectedArtifacts: AffectedArtifact[];
  totalAffected: number;
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
  estimatedTotalEffort: number; // hours
  riskAssessment: 'high' | 'medium' | 'low';
  suggestedChangeOrder: string[]; // Artifact IDs in suggested order
  dependencyGraph: DependencyNode[];
  generatedAt: Date;
}

export interface DependencyNode {
  id: string;
  type: 'requirement' | 'code' | 'test' | 'design';
  title: string;
  dependencies: string[]; // IDs of dependent nodes
  dependents: string[]; // IDs that depend on this node
}

class RequirementsImpactAnalysisService {
  /**
   * Analyze the impact of requirement changes
   */
  async analyzeRequirementChange(
    projectId: string,
    requirementId: string,
    changes: RequirementChange[]
  ): Promise<ImpactAnalysisReport> {
    try {
      logger.info(`Analyzing impact of changes to requirement ${requirementId} in project ${projectId}`);

      // Get the requirement artifact
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      }).lean();

      const allRequirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const requirement = allRequirements.find(r => r.id === requirementId);

      if (!requirement) {
        throw new Error(`Requirement ${requirementId} not found`);
      }

      // Find all linked artifacts via traceRefs
      const allArtifacts = await Artifact.find({ projectId }).lean();
      const linkedArtifacts = this.findLinkedArtifacts(requirement, allArtifacts);

      // Build dependency graph
      const dependencyGraph = await this.buildDependencyGraph(
        projectId,
        requirementId,
        linkedArtifacts,
        allArtifacts
      );

      // Analyze impact for each linked artifact
      const affectedArtifacts: AffectedArtifact[] = [];

      for (const artifact of linkedArtifacts) {
        const impact = await this.analyzeArtifactImpact(
          artifact,
          changes,
          requirement,
          dependencyGraph
        );
        if (impact) {
          affectedArtifacts.push(impact);
        }
      }

      // Calculate impact metrics
      const highImpactCount = affectedArtifacts.filter(a => a.impactLevel === 'high').length;
      const mediumImpactCount = affectedArtifacts.filter(a => a.impactLevel === 'medium').length;
      const lowImpactCount = affectedArtifacts.filter(a => a.impactLevel === 'low').length;

      const estimatedTotalEffort = affectedArtifacts.reduce(
        (sum, a) => sum + (a.estimatedEffort || 0),
        0
      );

      // Assess overall risk
      const riskAssessment = this.assessRisk(
        changes,
        highImpactCount,
        mediumImpactCount,
        requirement.priority
      );

      // Suggest change order (topological sort of dependencies)
      const suggestedChangeOrder = this.suggestChangeOrder(
        affectedArtifacts,
        dependencyGraph
      );

      return {
        requirementId,
        requirementTitle: requirement.description.substring(0, 100),
        changeType: changes[0]?.changeType || 'modified',
        affectedArtifacts,
        totalAffected: affectedArtifacts.length,
        highImpactCount,
        mediumImpactCount,
        lowImpactCount,
        estimatedTotalEffort,
        riskAssessment,
        suggestedChangeOrder,
        dependencyGraph,
        generatedAt: new Date()
      };
    } catch (error: any) {
      logger.error('Failed to analyze requirement change impact:', error);
      throw error;
    }
  }

  /**
   * Find all artifacts linked to a requirement
   */
  private findLinkedArtifacts(
    requirement: ParsedRequirement,
    allArtifacts: IArtifact[]
  ): IArtifact[] {
    const linked: IArtifact[] = [];

    // Check traceRefs
    if (requirement.traceRefs && requirement.traceRefs.length > 0) {
      for (const ref of requirement.traceRefs) {
        const artifact = allArtifacts.find(a => a._id.toString() === ref);
        if (artifact) {
          linked.push(artifact);
        }
      }
    }

    // Check linked code, tests, designs
    const allLinkedIds = [
      ...requirement.linkedCode,
      ...requirement.linkedTests,
      ...requirement.linkedDesigns
    ];

    for (const id of allLinkedIds) {
      const artifact = allArtifacts.find(a => a._id.toString() === id);
      if (artifact && !linked.find(l => l._id.toString() === artifact._id.toString())) {
        linked.push(artifact);
      }
    }

    // Also search by requirement ID in content
    const normalizeId = (id: string) => id.replace(/[-\s_]/g, '').toUpperCase();
    const normalizedReqId = normalizeId(requirement.id);
    const exactMatch = new RegExp(`\\b${requirement.id.replace(/[-\s]/g, '[-\\s]?')}\\b`, 'i');

    for (const artifact of allArtifacts) {
      if (linked.find(l => l._id.toString() === artifact._id.toString())) continue;

      if (
        exactMatch.test(artifact.title) ||
        exactMatch.test(artifact.content) ||
        (artifact.tags && artifact.tags.some(tag => exactMatch.test(tag)))
      ) {
        linked.push(artifact);
      }
    }

    return linked;
  }

  /**
   * Build dependency graph using Knowledge Graph
   */
  private async buildDependencyGraph(
    projectId: string,
    requirementId: string,
    linkedArtifacts: IArtifact[],
    allArtifacts: IArtifact[]
  ): Promise<DependencyNode[]> {
    const nodes: DependencyNode[] = [];

    // Add requirement node
    nodes.push({
      id: requirementId,
      type: 'requirement',
      title: `Requirement ${requirementId}`,
      dependencies: [],
      dependents: []
    });

    // Add artifact nodes
    for (const artifact of linkedArtifacts) {
      const artifactType = this.getArtifactType(artifact.type);
      nodes.push({
        id: artifact._id.toString(),
        type: artifactType,
        title: artifact.title,
        dependencies: [],
        dependents: []
      });
    }

    // Try to use Knowledge Graph to find dependencies
    try {
      // Use Neo4j if available
      if (neo4jService.isAvailable()) {
        for (const artifact of linkedArtifacts) {
          const artifactId = artifact._id.toString();
          const artifactType = this.getArtifactType(artifact.type);
          
          // Find outgoing relationships (dependencies)
          const outgoingPaths = await neo4jService.traverseGraph(
            artifactId,
            artifactType,
            ['DEPENDS_ON', 'IMPLEMENTS', 'TESTS'],
            2,
            'outgoing'
          );

          for (const path of outgoingPaths) {
            for (const rel of path.relationships) {
              if (rel.type === 'DEPENDS_ON' || rel.type === 'IMPLEMENTS' || rel.type === 'TESTS') {
                const targetNode = nodes.find(n => n.id === rel.endNodeId);
                if (targetNode) {
                  const currentNode = nodes.find(n => n.id === artifactId);
                  if (currentNode && !currentNode.dependencies.includes(rel.endNodeId)) {
                    currentNode.dependencies.push(rel.endNodeId);
                  }
                }
              }
            }
          }

          // Find incoming relationships (dependents)
          const incomingPaths = await neo4jService.traverseGraph(
            artifactId,
            artifactType,
            ['DEPENDS_ON', 'IMPLEMENTS', 'TESTS'],
            2,
            'incoming'
          );

          for (const path of incomingPaths) {
            for (const rel of path.relationships) {
              if (rel.type === 'DEPENDS_ON' || rel.type === 'IMPLEMENTS' || rel.type === 'TESTS') {
                const sourceNode = nodes.find(n => n.id === rel.startNodeId);
                if (sourceNode) {
                  const currentNode = nodes.find(n => n.id === artifactId);
                  if (currentNode && !currentNode.dependents.includes(rel.startNodeId)) {
                    currentNode.dependents.push(rel.startNodeId);
                  }
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      logger.debug('Knowledge Graph not available, using traceRefs for dependencies:', error.message);
      
      // Fallback: use traceRefs to infer dependencies
      for (const artifact of linkedArtifacts) {
        const currentNode = nodes.find(n => n.id === artifact._id.toString());
        if (currentNode && artifact.traceRefs) {
          for (const ref of artifact.traceRefs) {
            const refArtifact = allArtifacts.find(a => a._id.toString() === ref.toString());
            if (refArtifact && linkedArtifacts.find(la => la._id.toString() === ref.toString())) {
              if (!currentNode.dependencies.includes(ref.toString())) {
                currentNode.dependencies.push(ref.toString());
              }
            }
          }
        }
      }
    }

    return nodes;
  }

  /**
   * Analyze impact on a specific artifact
   */
  private async analyzeArtifactImpact(
    artifact: IArtifact,
    changes: RequirementChange[],
    requirement: ParsedRequirement,
    dependencyGraph: DependencyNode[]
  ): Promise<AffectedArtifact | null> {
    const artifactType = this.getArtifactType(artifact.type);
    const node = dependencyGraph.find(n => n.id === artifact._id.toString());

    // Determine impact level
    let impactLevel: 'high' | 'medium' | 'low' = 'low';
    let impactReason = '';
    let changeRequired = false;
    let estimatedEffort = 0;

    // Check change type
    const hasDeletion = changes.some(c => c.changeType === 'deleted');
    const hasModification = changes.some(c => c.changeType === 'modified');
    const hasPriorityChange = changes.some(c => c.changeType === 'priority_changed');

    if (hasDeletion) {
      impactLevel = 'high';
      impactReason = 'Requirement deleted - artifact may need removal or significant refactoring';
      changeRequired = true;
      estimatedEffort = artifactType === 'code' ? 4 : artifactType === 'test' ? 2 : 1;
    } else if (hasModification) {
      // Check how closely artifact is tied to requirement
      const hasDirectReference = artifact.content?.includes(requirement.id) || 
                                 artifact.title?.includes(requirement.id);
      const hasTraceRef = artifact.traceRefs?.some(ref => ref.toString() === requirement.id);

      if (hasDirectReference || hasTraceRef) {
        impactLevel = 'high';
        impactReason = 'Artifact directly references requirement - likely needs updates';
        changeRequired = true;
        estimatedEffort = artifactType === 'code' ? 3 : artifactType === 'test' ? 2 : 1;
      } else {
        impactLevel = 'medium';
        impactReason = 'Artifact linked to requirement via traceRefs - may need updates';
        changeRequired = true;
        estimatedEffort = artifactType === 'code' ? 2 : artifactType === 'test' ? 1 : 0.5;
      }
    } else if (hasPriorityChange) {
      impactLevel = 'low';
      impactReason = 'Priority change - may affect implementation order but not functionality';
      changeRequired = false;
      estimatedEffort = 0;
    }

    // Adjust based on dependencies
    if (node && node.dependents.length > 0) {
      impactLevel = impactLevel === 'low' ? 'medium' : impactLevel;
      impactReason += ` (${node.dependents.length} dependent artifact(s))`;
      estimatedEffort += node.dependents.length * 0.5; // Additional effort for dependent changes
    }

    // Adjust based on artifact type
    if (artifactType === 'test' && changeRequired) {
      estimatedEffort += 1; // Tests often need updates when code changes
    }

    return {
      artifactId: artifact._id.toString(),
      artifactTitle: artifact.title,
      artifactType: artifact.type,
      impactLevel,
      impactReason,
      changeRequired,
      estimatedEffort: Math.round(estimatedEffort * 10) / 10
    };
  }

  /**
   * Assess overall risk
   */
  private assessRisk(
    changes: RequirementChange[],
    highImpactCount: number,
    mediumImpactCount: number,
    priority: ParsedRequirement['priority']
  ): 'high' | 'medium' | 'low' {
    const hasDeletion = changes.some(c => c.changeType === 'deleted');
    const hasCriticalPriority = priority === 'critical';

    if (hasDeletion || (highImpactCount > 5) || (hasCriticalPriority && highImpactCount > 2)) {
      return 'high';
    }

    if (highImpactCount > 2 || mediumImpactCount > 5 || (hasCriticalPriority && mediumImpactCount > 2)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Suggest change order (topological sort)
   */
  private suggestChangeOrder(
    affectedArtifacts: AffectedArtifact[],
    dependencyGraph: DependencyNode[]
  ): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        // Circular dependency detected
        logger.warn(`Circular dependency detected involving ${nodeId}`);
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);
      const node = dependencyGraph.find(n => n.id === nodeId);
      
      if (node) {
        // Visit dependencies first
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      
      // Only add if it's an affected artifact
      if (affectedArtifacts.find(a => a.artifactId === nodeId)) {
        order.push(nodeId);
      }
    };

    // Visit all affected artifacts
    for (const artifact of affectedArtifacts) {
      if (!visited.has(artifact.artifactId)) {
        visit(artifact.artifactId);
      }
    }

    return order;
  }

  /**
   * Get artifact type for dependency graph
   */
  private getArtifactType(type: string): 'requirement' | 'code' | 'test' | 'design' {
    if (type === 'requirement') return 'requirement';
    if (type === 'code' || type === 'build') return 'code';
    if (type === 'test-plan' || type === 'audit-report') return 'test';
    if (type === 'design' || type === 'image') return 'design';
    return 'code'; // Default
  }

  /**
   * Calculate impact score (0-100)
   */
  calculateImpactScore(report: ImpactAnalysisReport): number {
    let score = 0;

    // Base score from affected count
    score += Math.min(30, report.totalAffected * 2);

    // High impact artifacts
    score += report.highImpactCount * 15;

    // Medium impact artifacts
    score += report.mediumImpactCount * 5;

    // Risk assessment
    if (report.riskAssessment === 'high') score += 20;
    else if (report.riskAssessment === 'medium') score += 10;

    // Effort (normalized)
    score += Math.min(20, report.estimatedTotalEffort * 2);

    return Math.min(100, Math.round(score));
  }
}

export const requirementsImpactAnalysisService = new RequirementsImpactAnalysisService();



