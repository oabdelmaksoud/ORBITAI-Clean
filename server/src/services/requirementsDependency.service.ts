/**
 * Requirements Dependency Service
 * Tracks parent/child relationships between requirements and detects circular dependencies
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { requirementsValidationService, ParsedRequirement } from './requirementsValidation.service.js';

export interface RequirementDependency {
  requirementId: string;
  parentId?: string;
  childIds: string[];
  dependencyType: 'epic' | 'feature' | 'story' | 'task' | 'depends_on' | 'blocks' | 'related';
  level: number; // Depth in hierarchy (0 = root)
}

export interface DependencyGraph {
  requirements: Map<string, RequirementDependency>;
  circularDependencies: Array<{
    path: string[];
    severity: 'high' | 'medium' | 'low';
  }>;
  rootRequirements: string[]; // Requirements with no parents
  leafRequirements: string[]; // Requirements with no children
  maxDepth: number;
}

export interface DependencyAnalysis {
  projectId: string;
  totalRequirements: number;
  requirementsWithDependencies: number;
  requirementsWithoutDependencies: number;
  dependencyGraph: DependencyGraph;
  circularDependencies: Array<{
    path: string[];
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  hierarchyLevels: Array<{
    level: number;
    requirementIds: string[];
    count: number;
  }>;
  orphanedRequirements: string[]; // Requirements not connected to any hierarchy
  generatedAt: Date;
}

class RequirementsDependencyService {
  /**
   * Analyze requirement dependencies for a project
   */
  async analyzeDependencies(projectId: string): Promise<DependencyAnalysis> {
    try {
      logger.info(`Analyzing requirement dependencies for project ${projectId}`);

      // Get all requirements
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      }).lean();

      if (reqArtifacts.length === 0) {
        return {
          projectId,
          totalRequirements: 0,
          requirementsWithDependencies: 0,
          requirementsWithoutDependencies: 0,
          dependencyGraph: {
            requirements: new Map(),
            circularDependencies: [],
            rootRequirements: [],
            leafRequirements: [],
            maxDepth: 0
          },
          circularDependencies: [],
          hierarchyLevels: [],
          orphanedRequirements: [],
          generatedAt: new Date()
        };
      }

      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const allArtifacts = await Artifact.find({ projectId }).lean();

      // Build dependency graph
      const dependencyGraph = await this.buildDependencyGraph(requirements, allArtifacts);

      // Detect circular dependencies
      const circularDependencies = this.detectCircularDependencies(dependencyGraph);

      // Analyze hierarchy
      const hierarchyLevels = this.analyzeHierarchy(dependencyGraph);
      const rootRequirements = Array.from(dependencyGraph.requirements.values())
        .filter(dep => !dep.parentId)
        .map(dep => dep.requirementId);
      const leafRequirements = Array.from(dependencyGraph.requirements.values())
        .filter(dep => dep.childIds.length === 0)
        .map(dep => dep.requirementId);

      // Find orphaned requirements
      const orphanedRequirements = requirements
        .filter(req => !dependencyGraph.requirements.has(req.id))
        .map(req => req.id);

      const requirementsWithDependencies = Array.from(dependencyGraph.requirements.values())
        .filter(dep => dep.parentId || dep.childIds.length > 0).length;

      return {
        projectId,
        totalRequirements: requirements.length,
        requirementsWithDependencies,
        requirementsWithoutDependencies: requirements.length - requirementsWithDependencies,
        dependencyGraph: {
          ...dependencyGraph,
          rootRequirements,
          leafRequirements,
          maxDepth: hierarchyLevels.length > 0 ? Math.max(...hierarchyLevels.map(h => h.level)) : 0
        },
        circularDependencies: circularDependencies.map(circ => ({
          ...circ,
          description: `Circular dependency detected: ${circ.path.join(' → ')} → ${circ.path[0]}`
        })),
        hierarchyLevels,
        orphanedRequirements,
        generatedAt: new Date()
      };
    } catch (error: any) {
      logger.error('Failed to analyze requirement dependencies:', error);
      throw error;
    }
  }

  /**
   * Build dependency graph from requirements
   */
  private async buildDependencyGraph(
    requirements: ParsedRequirement[],
    allArtifacts: IArtifact[]
  ): Promise<DependencyGraph> {
    const requirementsMap = new Map<string, RequirementDependency>();

    // Initialize all requirements
    for (const req of requirements) {
      requirementsMap.set(req.id, {
        requirementId: req.id,
        childIds: [],
        dependencyType: this.inferDependencyType(req),
        level: 0
      });
    }

    // Extract dependencies from requirement content and traceRefs
    for (const req of requirements) {
      const dep = requirementsMap.get(req.id)!;
      
      // Parse dependencies from requirement description
      const dependencies = this.extractDependenciesFromContent(req, requirements);

      for (const depInfo of dependencies) {
        const targetDep = requirementsMap.get(depInfo.targetId);
        if (targetDep) {
          // Add as child
          if (!dep.childIds.includes(depInfo.targetId)) {
            dep.childIds.push(depInfo.targetId);
          }

          // Set parent
          if (!targetDep.parentId) {
            targetDep.parentId = req.id;
            targetDep.dependencyType = depInfo.type;
          }
        }
      }

      // Check traceRefs for parent relationships
      if (req.traceRefs && req.traceRefs.length > 0) {
        for (const ref of req.traceRefs) {
          // Check if ref is a requirement ID
          const parentReq = requirements.find(r => r.id === ref.toString() || r.sourceArtifactId === ref.toString());
          if (parentReq && parentReq.id !== req.id) {
            if (!dep.parentId) {
              dep.parentId = parentReq.id;
            }
            const parentDep = requirementsMap.get(parentReq.id);
            if (parentDep && !parentDep.childIds.includes(req.id)) {
              parentDep.childIds.push(req.id);
            }
          }
        }
      }
    }

    // Calculate hierarchy levels
    this.calculateLevels(requirementsMap);

    return {
      requirements: requirementsMap,
      circularDependencies: [],
      rootRequirements: [],
      leafRequirements: [],
      maxDepth: 0
    };
  }

  /**
   * Extract dependencies from requirement content
   */
  private extractDependenciesFromContent(
    requirement: ParsedRequirement,
    allRequirements: ParsedRequirement[]
  ): Array<{ targetId: string; type: RequirementDependency['dependencyType'] }> {
    const dependencies: Array<{ targetId: string; type: RequirementDependency['dependencyType'] }> = [];
    const content = `${requirement.description} ${requirement.sourceArtifactTitle}`.toLowerCase();

    // Pattern 1: Explicit references (depends on REQ-001, blocks FR-002, etc.)
    const explicitPatterns = [
      /depends?\s+on\s+([A-Z]+-\d+)/gi,
      /blocks?\s+([A-Z]+-\d+)/gi,
      /related\s+to\s+([A-Z]+-\d+)/gi,
      /parent:\s*([A-Z]+-\d+)/gi,
      /child:\s*([A-Z]+-\d+)/gi,
      /epic:\s*([A-Z]+-\d+)/gi,
      /feature:\s*([A-Z]+-\d+)/gi
    ];

    for (const pattern of explicitPatterns) {
      const matches = requirement.description.matchAll(pattern);
      for (const match of matches) {
        const targetId = match[1].toUpperCase();
        const targetReq = allRequirements.find(r => r.id.toUpperCase() === targetId);
        if (targetReq) {
          let depType: RequirementDependency['dependencyType'] = 'depends_on';
          if (pattern.source.includes('block')) depType = 'blocks';
          else if (pattern.source.includes('parent') || pattern.source.includes('epic')) depType = 'epic';
          else if (pattern.source.includes('feature')) depType = 'feature';
          else if (pattern.source.includes('related')) depType = 'related';

          dependencies.push({ targetId: targetReq.id, type: depType });
        }
      }
    }

    // Pattern 2: Hierarchical naming (EPIC-001, EPIC-001-FEATURE-001, etc.)
    const hierarchicalPattern = /^([A-Z]+-\d+)-([A-Z]+-\d+)/i;
    const match = requirement.id.match(hierarchicalPattern);
    if (match) {
      const parentId = match[1];
      const parentReq = allRequirements.find(r => r.id === parentId);
      if (parentReq) {
        dependencies.push({ targetId: parentReq.id, type: 'epic' });
      }
    }

    return dependencies;
  }

  /**
   * Infer dependency type from requirement
   */
  private inferDependencyType(requirement: ParsedRequirement): RequirementDependency['dependencyType'] {
    const id = requirement.id.toUpperCase();
    if (id.startsWith('EPIC-')) return 'epic';
    if (id.startsWith('FEATURE-') || id.startsWith('FR-')) return 'feature';
    if (id.startsWith('STORY-') || id.startsWith('UC-')) return 'story';
    if (id.startsWith('TASK-')) return 'task';
    return 'depends_on';
  }

  /**
   * Calculate hierarchy levels
   */
  private calculateLevels(requirementsMap: Map<string, RequirementDependency>): void {
    // Find root requirements (no parents)
    const roots = Array.from(requirementsMap.values())
      .filter(dep => !dep.parentId)
      .map(dep => dep.requirementId);

    // BFS to assign levels
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = roots.map(id => ({ id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (visited.has(id)) continue;
      visited.add(id);

      const dep = requirementsMap.get(id);
      if (dep) {
        dep.level = level;

        // Add children to queue
        for (const childId of dep.childIds) {
          if (!visited.has(childId)) {
            queue.push({ id: childId, level: level + 1 });
          }
        }
      }
    }

    // Handle any remaining unvisited (orphaned with circular refs)
    for (const [id, dep] of requirementsMap.entries()) {
      if (!visited.has(id)) {
        dep.level = 0; // Default to root level
      }
    }
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: DependencyGraph): Array<{
    path: string[];
    severity: 'high' | 'medium' | 'low';
  }> {
    const circular: Array<{ path: string[]; severity: 'high' | 'medium' | 'low' }> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (reqId: string, path: string[]): void => {
      if (recursionStack.has(reqId)) {
        // Circular dependency found
        const cycleStart = path.indexOf(reqId);
        const cycle = path.slice(cycleStart);
        cycle.push(reqId); // Complete the cycle

        const severity = cycle.length <= 3 ? 'high' : cycle.length <= 5 ? 'medium' : 'low';
        circular.push({ path: cycle, severity });
        return;
      }

      if (visited.has(reqId)) {
        return;
      }

      visited.add(reqId);
      recursionStack.add(reqId);

      const dep = graph.requirements.get(reqId);
      if (dep) {
        for (const childId of dep.childIds) {
          dfs(childId, [...path, reqId]);
        }
      }

      recursionStack.delete(reqId);
    };

    // Start DFS from each requirement
    for (const reqId of graph.requirements.keys()) {
      if (!visited.has(reqId)) {
        dfs(reqId, []);
      }
    }

    // Remove duplicates (same cycle found from different starting points)
    const uniqueCircular = circular.filter((circ, index, self) =>
      index === self.findIndex(c => 
        c.path.length === circ.path.length &&
        c.path.every((id, i) => id === circ.path[i])
      )
    );

    return uniqueCircular;
  }

  /**
   * Analyze hierarchy levels
   */
  private analyzeHierarchy(graph: DependencyGraph): Array<{
    level: number;
    requirementIds: string[];
    count: number;
  }> {
    const levelMap = new Map<number, string[]>();

    for (const dep of graph.requirements.values()) {
      if (!levelMap.has(dep.level)) {
        levelMap.set(dep.level, []);
      }
      levelMap.get(dep.level)!.push(dep.requirementId);
    }

    return Array.from(levelMap.entries())
      .map(([level, ids]) => ({
        level,
        requirementIds: ids,
        count: ids.length
      }))
      .sort((a, b) => a.level - b.level);
  }

  /**
   * Add a dependency relationship
   */
  async addDependency(
    projectId: string,
    requirementId: string,
    targetRequirementId: string,
    dependencyType: RequirementDependency['dependencyType']
  ): Promise<void> {
    try {
      // Get requirement artifacts
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      }).lean();

      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const sourceReq = requirements.find(r => r.id === requirementId);
      const targetReq = requirements.find(r => r.id === targetRequirementId);

      if (!sourceReq || !targetReq) {
        throw new Error('One or both requirements not found');
      }

      // Update source requirement artifact to include dependency in content
      const sourceArtifact = await Artifact.findOne({
        _id: sourceReq.sourceArtifactId
      });

      if (sourceArtifact) {
        const depText = `\n\nDependency: ${dependencyType} ${targetRequirementId}`;
        if (!sourceArtifact.content.includes(depText)) {
          sourceArtifact.content += depText;
          await sourceArtifact.save();
        }

        // Add to traceRefs if not already present
        if (!sourceArtifact.traceRefs?.includes(targetReq.sourceArtifactId)) {
          sourceArtifact.traceRefs = sourceArtifact.traceRefs || [];
          sourceArtifact.traceRefs.push(targetReq.sourceArtifactId);
          await sourceArtifact.save();
        }
      }

      logger.info(`Added dependency: ${requirementId} ${dependencyType} ${targetRequirementId}`);
    } catch (error: any) {
      logger.error('Failed to add dependency:', error);
      throw error;
    }
  }

  /**
   * Remove a dependency relationship
   */
  async removeDependency(
    projectId: string,
    requirementId: string,
    targetRequirementId: string
  ): Promise<void> {
    try {
      const reqArtifacts = await Artifact.find({
        projectId,
        type: 'requirement'
      }).lean();

      const requirements = requirementsValidationService.extractRequirements(reqArtifacts);
      const sourceReq = requirements.find(r => r.id === requirementId);

      if (!sourceReq) {
        throw new Error('Requirement not found');
      }

      const sourceArtifact = await Artifact.findOne({
        _id: sourceReq.sourceArtifactId
      });

      if (sourceArtifact) {
        // Remove from traceRefs
        if (sourceArtifact.traceRefs) {
          const targetReq = requirements.find(r => r.id === targetRequirementId);
          if (targetReq) {
            sourceArtifact.traceRefs = sourceArtifact.traceRefs.filter(
              ref => ref.toString() !== targetReq.sourceArtifactId
            );
            await sourceArtifact.save();
          }
        }

        // Remove from content (simple pattern match)
        const depPattern = new RegExp(`\\n\\nDependency: [^\\n]+ ${targetRequirementId}`, 'g');
        sourceArtifact.content = sourceArtifact.content.replace(depPattern, '');
        await sourceArtifact.save();
      }

      logger.info(`Removed dependency: ${requirementId} -> ${targetRequirementId}`);
    } catch (error: any) {
      logger.error('Failed to remove dependency:', error);
      throw error;
    }
  }
}

export const requirementsDependencyService = new RequirementsDependencyService();



