/**
 * Workflow Engine Service
 * Manages BPMN workflows and execution
 * Inspired by Flowable/jBPM concepts
 */

import { Workflow, IWorkflow } from '../models/Workflow.model.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  currentNodeId?: string;
  variables: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  history: Array<{
    nodeId: string;
    nodeName: string;
    status: 'started' | 'completed' | 'failed';
    timestamp: Date;
    agentRole?: string;
    result?: any;
  }>;
}

export interface WorkflowNode {
  id: string;
  type: 'start' | 'task' | 'gateway' | 'end';
  name: string;
  properties?: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

class WorkflowEngineService {
  private executions: Map<string, WorkflowExecution> = new Map();

  /**
   * Create a new workflow
   */
  async createWorkflow(
    name: string,
    description: string,
    bpmnDefinition: IWorkflow['bpmnDefinition'],
    userId: string
  ): Promise<IWorkflow> {
    const id = `wf-${crypto.randomUUID()}`;

    const workflow = await Workflow.create({
      id,
      name,
      description,
      bpmnDefinition,
      version: 1,
      status: 'draft',
      execution: {
        enabled: false,
        autoStart: false,
        maxConcurrent: 1
      },
      agentAssignments: [],
      variables: [],
      statistics: {
        timesExecuted: 0,
        averageDuration: 0,
        successRate: 0
      },
      tags: [],
      category: 'general',
      createdBy: userId,
      updatedBy: userId
    });

    logger.info(`Created workflow: ${id} - ${name}`);
    return workflow;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    variables: Record<string, any> = {},
    context?: { projectId?: string; userId?: string }
  ): Promise<WorkflowExecution> {
    const workflow = await Workflow.findOne({ id: workflowId });
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== 'active') {
      throw new Error(`Workflow is not active: ${workflow.status}`);
    }

    const executionId = `exec-${crypto.randomUUID()}`;
    const execution: WorkflowExecution = {
      executionId,
      workflowId,
      status: 'running',
      variables: { ...variables },
      startTime: new Date(),
      history: []
    };

    this.executions.set(executionId, execution);

    try {
      // Find start node
      const startNode = workflow.bpmnDefinition.nodes.find(n => n.type === 'start');
      if (!startNode) {
        throw new Error('No start node found in workflow');
      }

      execution.currentNodeId = startNode.id;
      execution.history.push({
        nodeId: startNode.id,
        nodeName: startNode.name,
        status: 'started',
        timestamp: new Date()
      });

      // Execute workflow (simplified - would need full BPMN engine)
      await this.executeNode(workflow, execution, startNode, context);

      // Update statistics
      await this.updateWorkflowStatistics(workflow, execution);

      return execution;
    } catch (error: unknown) {
      execution.status = 'failed';
      execution.error = (error instanceof Error ? error.message : String(error));
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      
      logger.error(`Workflow execution failed: ${executionId}`, error);
      throw error;
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    workflow: IWorkflow,
    execution: WorkflowExecution,
    node: WorkflowNode,
    context?: { projectId?: string; userId?: string }
  ): Promise<void> {
    switch (node.type) {
      case 'start':
        // Move to next node
        await this.moveToNextNode(workflow, execution, node);
        break;

      case 'task':
        // Find agent assignment
        const assignment = workflow.agentAssignments.find(a => a.nodeId === node.id);
        if (assignment) {
          // Execute task with agent (simplified)
          logger.info(`Executing task ${node.name} with agent ${assignment.agentRole}`);
          
          // Simulate task execution
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          execution.history.push({
            nodeId: node.id,
            nodeName: node.name,
            status: 'completed',
            timestamp: new Date(),
            agentRole: assignment.agentRole
          });

          // Move to next node
          await this.moveToNextNode(workflow, execution, node);
        } else {
          throw new Error(`No agent assignment for task node: ${node.id}`);
        }
        break;

      case 'gateway':
        // Evaluate conditions and choose path
        const nextNode = await this.evaluateGateway(workflow, execution, node);
        if (nextNode) {
          await this.executeNode(workflow, execution, nextNode, context);
        }
        break;

      case 'end':
        execution.status = 'completed';
        execution.endTime = new Date();
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
        execution.history.push({
          nodeId: node.id,
          nodeName: node.name,
          status: 'completed',
          timestamp: new Date()
        });
        break;
    }
  }

  /**
   * Move to next node
   */
  private async moveToNextNode(
    workflow: IWorkflow,
    execution: WorkflowExecution,
    currentNode: WorkflowNode
  ): Promise<void> {
    const outgoingEdges = workflow.bpmnDefinition.edges.filter(e => e.source === currentNode.id);
    
    if (outgoingEdges.length === 0) {
      // No outgoing edges - workflow ends
      execution.status = 'completed';
      execution.endTime = new Date();
      return;
    }

    // For now, take first edge (would need condition evaluation for gateways)
    const nextEdge = outgoingEdges[0];
    const nextNode = workflow.bpmnDefinition.nodes.find(n => n.id === nextEdge.target);
    
    if (nextNode) {
      execution.currentNodeId = nextNode.id;
      await this.executeNode(workflow, execution, nextNode);
    }
  }

  /**
   * Evaluate gateway conditions
   */
  private async evaluateGateway(
    workflow: IWorkflow,
    execution: WorkflowExecution,
    gateway: WorkflowNode
  ): Promise<WorkflowNode | null> {
    const outgoingEdges = workflow.bpmnDefinition.edges.filter(e => e.source === gateway.id);
    
    // Simple condition evaluation (would need proper expression engine)
    for (const edge of outgoingEdges) {
      if (!edge.condition) {
        // Default path
        return workflow.bpmnDefinition.nodes.find(n => n.id === edge.target) || null;
      }

      // Evaluate condition (simplified)
      try {
        // In real implementation, would use expression evaluator
        const conditionMet = this.evaluateCondition(edge.condition, execution.variables);
        if (conditionMet) {
          return workflow.bpmnDefinition.nodes.find(n => n.id === edge.target) || null;
        }
      } catch (error: unknown) {
        logger.warn(`Failed to evaluate condition: ${edge.condition}`, error);
      }
    }

    return null;
  }

  /**
   * Evaluate condition expression
   */
  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    // Simplified condition evaluation
    // In production, would use proper expression evaluator
    
    // Replace variable references
    let evaluated = condition;
    for (const [key, value] of Object.entries(variables)) {
      evaluated = evaluated.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
    }

    // Simple boolean evaluation (very basic)
    try {
      // Only allow safe comparisons
      if (evaluated.includes('==')) {
        const [left, right] = evaluated.split('==').map(s => s.trim());
        return left === right;
      }
      if (evaluated.includes('!=')) {
        const [left, right] = evaluated.split('!=').map(s => s.trim());
        return left !== right;
      }
      if (evaluated.includes('>')) {
        const [left, right] = evaluated.split('>').map(s => parseFloat(s.trim()));
        return left > right;
      }
      if (evaluated.includes('<')) {
        const [left, right] = evaluated.split('<').map(s => parseFloat(s.trim()));
        return left < right;
      }
      
      return Boolean(evaluated);
    } catch {
      return false;
    }
  }

  /**
   * Update workflow statistics
   */
  private async updateWorkflowStatistics(
    workflow: IWorkflow,
    execution: WorkflowExecution
  ): Promise<void> {
    const stats = workflow.statistics;
    stats.timesExecuted += 1;
    stats.lastExecuted = new Date();

    if (execution.duration) {
      const currentAvg = stats.averageDuration;
      const newAvg = (currentAvg * (stats.timesExecuted - 1) + execution.duration) / stats.timesExecuted;
      stats.averageDuration = newAvg;
    }

    if (execution.status === 'completed') {
      const currentSuccessRate = stats.successRate;
      const newSuccessRate = (currentSuccessRate * (stats.timesExecuted - 1) + 100) / stats.timesExecuted;
      stats.successRate = newSuccessRate;
    } else {
      const currentSuccessRate = stats.successRate;
      const newSuccessRate = (currentSuccessRate * (stats.timesExecuted - 1) + 0) / stats.timesExecuted;
      stats.successRate = newSuccessRate;
    }

    await workflow.save();
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): WorkflowExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * List all executions
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Convert workflow to BPMN XML (simplified)
   */
  async exportToBPMN(workflowId: string): Promise<string> {
    const workflow = await Workflow.findOne({ id: workflowId });
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Generate simplified BPMN XML
    const bpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="Definitions_${workflow.id}"
                  targetNamespace="http://orbitai.com/bpmn">
  <bpmn:process id="${workflow.bpmnDefinition.processId}" name="${workflow.bpmnDefinition.processName}" isExecutable="true">
    ${workflow.bpmnDefinition.nodes.map(node => {
      switch (node.type) {
        case 'start':
          return `<bpmn:startEvent id="${node.id}" name="${node.name}"/>`;
        case 'task':
          return `<bpmn:task id="${node.id}" name="${node.name}"/>`;
        case 'gateway':
          return `<bpmn:exclusiveGateway id="${node.id}" name="${node.name}"/>`;
        case 'end':
          return `<bpmn:endEvent id="${node.id}" name="${node.name}"/>`;
        default:
          return '';
      }
    }).join('\n    ')}
    ${workflow.bpmnDefinition.edges.map(edge => 
      `<bpmn:sequenceFlow id="${edge.id}" sourceRef="${edge.source}" targetRef="${edge.target}"/>`
    ).join('\n    ')}
  </bpmn:process>
</bpmn:definitions>`;

    return bpmn;
  }
}

export const workflowEngineService = new WorkflowEngineService();

