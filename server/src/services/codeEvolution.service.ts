/**
 * Code Evolution Service
 * Tracks code changes between versions and identifies regression patterns
 */

import { logger } from '../utils/logger.js';
import { CodeEvolution, ICodeEvolution } from '../models/CodeEvolution.model.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { codeQualityAssuranceService } from './codeQualityAssurance.service.js';

export interface CodeEvolutionReport {
  projectId: string;
  artifactId: string;
  versions: Array<{
    version: string;
    timestamp: Date;
    qualityScore: number;
    complexity: number;
    lineCount: number;
    functionCount: number;
    testCount: number;
  }>;
  qualityTrend: 'improving' | 'stable' | 'degrading';
  regressionPatterns: Array<{
    pattern: string;
    frequency: number;
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  changeSummary: {
    totalVersions: number;
    averageQualityChange: number;
    qualityVariance: number;
    refactoringEffectiveness: number; // 0-100
  };
  generatedAt: Date;
}

class CodeEvolutionService {
  /**
   * Track code evolution snapshot
   */
  async trackSnapshot(
    projectId: string,
    artifactId: string,
    version: string
  ): Promise<ICodeEvolution> {
    try {
      logger.info(`Tracking code evolution snapshot for artifact ${artifactId} version ${version}`);

      const artifact = await Artifact.findOne({ _id: artifactId, projectId });
      if (!artifact) {
        throw new Error('Artifact not found');
      }

      // Get previous version for comparison
      const previousVersion = await CodeEvolution.findOne({
        projectId,
        artifactId,
      }).sort({ timestamp: -1 });

      // Analyze current code
      const qualityScore = await codeQualityAssuranceService.calculateQualityScore(
        artifact.content,
        artifact.metadata?.language || 'typescript'
      );

      const complexity = this.calculateComplexity(artifact.content);
      const lineCount = artifact.content.split('\n').length;
      const functionCount = (artifact.content.match(/(?:function|const|let|var)\s+\w+\s*[=:]/g) || []).length;
      const testCount = (artifact.content.match(/(?:test|it|describe|expect)/gi) || []).length;

      // Detect changes
      const changes = previousVersion
        ? this.detectChanges(previousVersion.snapshot.content, artifact.content)
        : [];

      // Determine quality trend
      const qualityTrend = previousVersion
        ? this.determineQualityTrend(previousVersion.snapshot.qualityScore, qualityScore)
        : 'stable';

      // Detect regression patterns
      const regressionPatterns = previousVersion
        ? this.detectRegressionPatterns(previousVersion, {
          qualityScore,
          complexity,
          lineCount,
          functionCount,
          testCount
        })
        : [];

      const evolution = new CodeEvolution({
        projectId,
        artifactId,
        version,
        snapshot: {
          content: artifact.content,
          qualityScore,
          complexity,
          lineCount,
          functionCount,
          testCount
        },
        changes,
        qualityTrend,
        regressionPatterns,
        timestamp: new Date()
      });

      await evolution.save();

      return evolution;
    } catch (error: unknown) {
      logger.error('Failed to track code evolution snapshot:', error);
      throw error;
    }
  }

  /**
   * Detect changes between versions
   */
  private detectChanges(oldContent: string, newContent: string): Array<{
    type: 'added' | 'modified' | 'deleted';
    location: string;
    description: string;
  }> {
    const changes: Array<{
      type: 'added' | 'modified' | 'deleted';
      location: string;
      description: string;
    }> = [];

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-by-line comparison
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (!oldLine && newLine) {
        changes.push({
          type: 'added',
          location: `Line ${i + 1}`,
          description: `Added: ${newLine.substring(0, 50)}`
        });
      } else if (oldLine && !newLine) {
        changes.push({
          type: 'deleted',
          location: `Line ${i + 1}`,
          description: `Deleted: ${oldLine.substring(0, 50)}`
        });
      } else if (oldLine && newLine && oldLine.trim() !== newLine.trim()) {
        changes.push({
          type: 'modified',
          location: `Line ${i + 1}`,
          description: `Modified: ${newLine.substring(0, 50)}`
        });
      }
    }

    return changes.slice(0, 50); // Limit to top 50 changes
  }

  /**
   * Determine quality trend
   */
  private determineQualityTrend(
    oldScore: number,
    newScore: number
  ): 'improving' | 'stable' | 'degrading' {
    const diff = newScore - oldScore;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'degrading';
    return 'stable';
  }

  /**
   * Detect regression patterns
   */
  private detectRegressionPatterns(
    previous: ICodeEvolution,
    current: {
      qualityScore: number;
      complexity: number;
      lineCount: number;
      functionCount: number;
      testCount: number;
    }
  ): string[] {
    const patterns: string[] = [];

    // Quality degradation
    if (current.qualityScore < previous.snapshot.qualityScore - 10) {
      patterns.push('quality_degradation');
    }

    // Complexity increase
    if (current.complexity > previous.snapshot.complexity * 1.2) {
      patterns.push('complexity_increase');
    }

    // Test count decrease
    if (current.testCount < previous.snapshot.testCount) {
      patterns.push('test_coverage_decrease');
    }

    // Code bloat (lines increase without quality improvement)
    if (current.lineCount > previous.snapshot.lineCount * 1.3 && 
        current.qualityScore <= previous.snapshot.qualityScore) {
      patterns.push('code_bloat');
    }

    return patterns;
  }

  /**
   * Calculate complexity
   */
  private calculateComplexity(code: string): number {
    const decisions = (code.match(/\b(?:if|else|switch|case|while|for|catch)\b/g) || []).length;
    const functions = (code.match(/(?:function|const|let|var)\s+\w+\s*[=:]/g) || []).length;
    return Math.max(1, decisions - functions + 2);
  }

  /**
   * Generate evolution report
   */
  async generateReport(
    projectId: string,
    artifactId: string
  ): Promise<CodeEvolutionReport> {
    try {
      const evolutions = await CodeEvolution.find({
        projectId,
        artifactId
      }).sort({ timestamp: 1 }).lean();

      if (evolutions.length === 0) {
        return {
          projectId,
          artifactId,
          versions: [],
          qualityTrend: 'stable',
          regressionPatterns: [],
          changeSummary: {
            totalVersions: 0,
            averageQualityChange: 0,
            qualityVariance: 0,
            refactoringEffectiveness: 0
          },
          generatedAt: new Date()
        };
      }

      const versions = evolutions.map(e => ({
        version: e.version,
        timestamp: e.timestamp,
        qualityScore: e.snapshot.qualityScore,
        complexity: e.snapshot.complexity,
        lineCount: e.snapshot.lineCount,
        functionCount: e.snapshot.functionCount,
        testCount: e.snapshot.testCount
      }));

      // Calculate quality trend
      const qualityTrend = this.calculateOverallTrend(versions);

      // Aggregate regression patterns
      const patternFrequency = new Map<string, number>();
      for (const evo of evolutions) {
        for (const pattern of evo.regressionPatterns) {
          patternFrequency.set(pattern, (patternFrequency.get(pattern) || 0) + 1);
        }
      }

      const regressionPatterns = Array.from(patternFrequency.entries()).map(([pattern, frequency]) => ({
        pattern,
        frequency,
        severity: frequency > 3 ? 'high' : frequency > 1 ? 'medium' : 'low',
        description: this.getPatternDescription(pattern)
      }));

      // Calculate change summary
      const qualityChanges = [];
      for (let i = 1; i < versions.length; i++) {
        qualityChanges.push(versions[i].qualityScore - versions[i - 1].qualityScore);
      }

      const averageQualityChange = qualityChanges.length > 0
        ? qualityChanges.reduce((sum, change) => sum + change, 0) / qualityChanges.length
        : 0;

      const qualityVariance = this.calculateVariance(versions.map(v => v.qualityScore));

      // Refactoring effectiveness: improvement in quality without significant complexity increase
      let refactoringEffectiveness = 0;
      if (versions.length > 1) {
        const firstVersion = versions[0];
        const lastVersion = versions[versions.length - 1];
        const qualityImprovement = lastVersion.qualityScore - firstVersion.qualityScore;
        const complexityChange = (lastVersion.complexity - firstVersion.complexity) / firstVersion.complexity;
        
        if (qualityImprovement > 0 && complexityChange < 0.1) {
          refactoringEffectiveness = Math.min(100, qualityImprovement * 2);
        }
      }

      return {
        projectId,
        artifactId,
        versions,
        qualityTrend,
        regressionPatterns,
        changeSummary: {
          totalVersions: versions.length,
          averageQualityChange: Math.round(averageQualityChange * 100) / 100,
          qualityVariance: Math.round(qualityVariance * 100) / 100,
          refactoringEffectiveness: Math.round(refactoringEffectiveness)
        },
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to generate code evolution report:', error);
      throw error;
    }
  }

  /**
   * Calculate overall trend
   */
  private calculateOverallTrend(versions: CodeEvolutionReport['versions']): 'improving' | 'stable' | 'degrading' {
    if (versions.length < 2) return 'stable';

    const first = versions[0].qualityScore;
    const last = versions[versions.length - 1].qualityScore;
    const diff = last - first;

    if (diff > 10) return 'improving';
    if (diff < -10) return 'degrading';
    return 'stable';
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Get pattern description
   */
  private getPatternDescription(pattern: string): string {
    const descriptions: Record<string, string> = {
      'quality_degradation': 'Code quality has decreased over time',
      'complexity_increase': 'Code complexity has increased significantly',
      'test_coverage_decrease': 'Test coverage has decreased',
      'code_bloat': 'Code size increased without quality improvement'
    };
    return descriptions[pattern] || pattern;
  }
}

export const codeEvolutionService = new CodeEvolutionService();



