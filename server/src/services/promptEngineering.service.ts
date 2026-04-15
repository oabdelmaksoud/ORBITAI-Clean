/**
 * Prompt Engineering Service
 * Provides standardized, research-based prompt structures for all AI models/providers
 * Applies best practices: XML delimiters, few-shot examples, chain-of-thought, quality gates
 */

import { logger } from '../utils/logger.js';

export interface PromptContext {
  role?: string;
  task?: string;
  input?: string;
  context?: string;
  useInternet?: boolean;
  examples?: Array<{ before: string; after: string }>;
  outputFormat?: string;
  qualityCriteria?: string[];
}

export interface EnhancedPromptResult {
  prompt: string;
  systemInstruction?: string;
}

/**
 * Enhance a prompt using best practices for prompt engineering
 * Applies to ALL models/providers (Gemini, OpenAI, Anthropic, etc.)
 */
export function enhancePrompt(
  basePrompt: string,
  context: PromptContext = {}
): EnhancedPromptResult {
  const {
    role = 'AI Assistant',
    task = 'Complete the requested task',
    input = basePrompt,
    context: additionalContext = '',
    useInternet = false,
    examples = [],
    outputFormat,
    qualityCriteria = []
  } = context;

  // Build enhanced prompt with XML-style delimiters and structured format
  const enhancedPrompt = `<role>
You are ${role}. Your expertise includes following best practices and delivering high-quality, actionable results.
</role>

<task>
${task}
</task>

<input>
${input}
</input>

${additionalContext ? `<context>
${additionalContext}
${useInternet ? '\nYou have access to online research tools. Use them to gather current, real-world information and best practices.' : ''}
</context>` : useInternet ? `<context>
You have access to online research tools. Use them to gather current, real-world information and best practices.
</context>` : ''}

${examples.length > 0 ? `<examples>
Here are examples of effective transformations:

${examples.map((ex, idx) => `EXAMPLE ${idx + 1}:
BEFORE: "${ex.before}"
AFTER: "${ex.after}"`).join('\n\n')}
</examples>` : ''}

<methodology>
Follow this structured approach:

STEP 1: ANALYSIS & UNDERSTANDING
- Parse the input to identify core objectives
- Extract implicit requirements and assumptions
- Determine context and constraints
${useInternet ? '- Research current best practices using online sources' : ''}

STEP 2: STRUCTURE & ORGANIZATION
- Organize information logically
- Group related concepts together
- Establish clear hierarchy and flow

STEP 3: ENHANCEMENT & EXPANSION
- Expand vague descriptions into specific, actionable requirements
- Add missing critical information
- Include technical details where appropriate
- Provide concrete examples

STEP 4: REFINEMENT & POLISH
- Ensure clarity and remove ambiguity
- Use professional, consistent terminology
- Verify completeness and coherence
</methodology>

${outputFormat ? `<output_format>
${outputFormat}
</output_format>` : ''}

${qualityCriteria.length > 0 ? `<quality_gates>
Before finalizing, verify:
${qualityCriteria.map(criteria => `✓ ${criteria}`).join('\n')}
</quality_gates>` : ''}

<output_instructions>
CRITICAL REQUIREMENTS:
1. Use clear, specific language throughout
2. Provide concrete examples where they clarify concepts
3. Include measurable metrics and constraints where applicable
4. Maintain professional tone and consistency
5. Ensure all requirements are actionable
6. Preserve original intent while adding necessary context
${useInternet ? '7. Cite sources and current best practices from online research' : ''}

BEGIN OUTPUT:
</output_instructions>`;

  return {
    prompt: enhancedPrompt,
    systemInstruction: `You are ${role}. ${task}`
  };
}

/**
 * Enhance orchestration prompt for task generation
 */
export function enhanceOrchestrationPrompt(
  phase: string,
  description: string,
  completedTasks: any[],
  agents: any[],
  researchContext: string = '',
  maxTasks: number = 8
): EnhancedPromptResult {
  const projectSummary = description.substring(0, 200);
  const recentTasks = (completedTasks || []).slice(-3).map((t: any) => t.title).join(', ') || 'None';
  const agentRoles = (agents || []).slice(0, 5).map((a: any) => a.role).join(', ');

  const enhancedPrompt = `<role>
You are an expert project orchestrator and task planner specializing in software development project management.
</role>

<task>
Generate ${maxTasks} well-structured tasks for the current project phase based on project requirements${researchContext ? ' and current best practices from online research' : ''}.
</task>

<project_context>
Phase: ${phase}
Project Summary: ${projectSummary}
Recently Completed Tasks: ${recentTasks}
Available Agents: ${agentRoles}
${researchContext ? `\n\nRESEARCH INSIGHTS (from online research):\n${researchContext}` : ''}
</project_context>

<methodology>
Follow this structured approach:

STEP 1: PHASE ANALYSIS
- Understand the current phase requirements
- Identify what needs to be accomplished
- Consider dependencies from completed tasks

STEP 2: TASK DECOMPOSITION
- Break down phase objectives into actionable tasks
- Ensure tasks are specific and measurable
- Assign appropriate agents based on their expertise

STEP 3: DEPENDENCY MAPPING
- Identify task dependencies
- Order tasks logically
- Ensure prerequisites are clear

STEP 4: VALIDATION
- Verify tasks align with project goals
- Ensure tasks are achievable
- Check agent assignments are appropriate
</methodology>

<output_format>
Return a JSON object with this structure:
{
  "tasks": [
    {
      "title": "Specific task title",
      "description": "Detailed task description with technical details",
      "assignedTo": "Agent role name",
      "dependencies": ["task-id-1", "task-id-2"]
    }
  ]
}
</output_format>

<quality_gates>
Before finalizing, verify:
✓ Each task is specific and actionable
✓ Tasks align with the current phase
✓ Agent assignments match their expertise
✓ Dependencies are correctly identified
✓ Tasks build on completed work
${researchContext ? '✓ Tasks incorporate research insights where relevant' : ''}
</quality_gates>

<output_instructions>
Generate ${maxTasks} tasks that:
- Are specific and actionable
- Include technical details where relevant
- Are properly assigned to appropriate agents
- Have correct dependencies
- Build logically on completed tasks
${researchContext ? '- Incorporate best practices from research insights' : ''}

BEGIN TASK GENERATION:
</output_instructions>`;

  return {
    prompt: enhancedPrompt,
    systemInstruction: 'You are an expert project orchestrator. Generate well-structured tasks for software development projects.'
  };
}

/**
 * Get relevant requirement content for agent prompts
 */
function getRelevantRequirementContent(artifacts: any[], task: any): string {
  // Filter requirement artifacts
  const reqArtifacts = artifacts.filter((a: any) => a.type === 'requirement');
  
  if (reqArtifacts.length === 0) {
    return '';
  }
  
  const requirementSections: string[] = [];
  
  for (const artifact of reqArtifacts) {
    const content = artifact.content || '';
    const title = artifact.title || 'Untitled Requirement';
    
    // Summarize if content is too long (>2000 chars)
    if (content.length > 2000) {
      // Try to extract key parts (first 500 chars + last 200 chars)
      const summary = content.substring(0, 500) + 
                    '\n... [content truncated, see full artifact for details] ...\n' +
                    content.substring(content.length - 200);
      requirementSections.push(`\n${title}:\n${summary}`);
    } else if (content.length > 0) {
      // Include full content for smaller requirements
      requirementSections.push(`\n${title}:\n${content}`);
    }
  }
  
  if (requirementSections.length === 0) {
    return '';
  }
  
  return requirementSections.join('\n\n---\n\n');
}

/**
 * Enhance task execution prompt for agent work
 */
export function enhanceTaskExecutionPrompt(
  agent: any,
  task: any,
  projectContext: string,
  artifacts: any[],
  researchContext: string = '',
  toolsInfo: string = ''
): EnhancedPromptResult {
  const enhancedPrompt = `<role>
You are ${agent.name || agent.role}, a ${agent.role}.
Goal: ${agent.goal || 'Execute tasks efficiently and effectively'}
${agent.backstory ? `Background: ${agent.backstory}` : ''}
</role>

<task>
Title: ${task.title}
Description: ${task.description}
</task>

<project_context>
${projectContext.substring(0, 5000)}
</project_context>

<artifacts>
${artifacts.length > 0 ? artifacts.map((a: any) => `- ${a.title} (${a.type})`).join('\n') : 'No artifacts available'}
</artifacts>

${getRelevantRequirementContent(artifacts, task) ? `<requirements>
📋 RELEVANT REQUIREMENTS:
${getRelevantRequirementContent(artifacts, task)}

IMPORTANT: Ensure your implementation follows these requirements. Reference requirement IDs (REQ-001, FR-001, UC-001, etc.) when creating code artifacts and use traceRefs to link implementations back to requirements.
</requirements>` : ''}

<issue_detection_instructions>
CRITICAL: If you detect any issues during your work, you MUST create tasks to fix them:

1. **Security Issues**: Create a task for any security vulnerabilities (SQL injection, XSS, authentication flaws, etc.)
   - Task Title: "Fix Security: [Issue Type]"
   - Priority: Critical or High
   - Assign to: QA/Audit Agent

2. **Performance Issues**: Create a task for performance bottlenecks (slow queries, memory leaks, inefficient algorithms)
   - Task Title: "Optimize Performance: [Issue Description]"
   - Priority: Medium or High
   - Assign to: Implementation Agent

3. **Code Quality Issues**: Create a task for best practice violations (SOLID, DRY, KISS violations)
   - Task Title: "Improve Code Quality: [Principle]"
   - Priority: Medium
   - Assign to: Implementation Agent

4. **Bugs**: Create a task for any bugs or errors you discover
   - Task Title: "Fix Bug: [Bug Description]"
   - Priority: Based on severity
   - Assign to: Remediation Agent

5. **Missing Requirements**: Create a task if you find requirements that aren't implemented
   - Task Title: "Implement Requirement: [REQ-ID]"
   - Priority: Based on requirement priority
   - Assign to: Requirements Agent or Implementation Agent

When creating tasks, include:
- Clear title describing the issue
- Detailed description with location (file/line if applicable)
- Recommended fix or approach
- Priority level (critical, high, medium, low)
- Appropriate agent assignment

The system will automatically create these tasks for you when you report issues in your output.
</issue_detection_instructions>

${toolsInfo ? `<available_tools>
${toolsInfo}

IMPORTANT: Use the available tools when they can help you complete the task more effectively.
</available_tools>` : ''}

${researchContext ? `<research_insights>
🌐 ONLINE RESEARCH INSIGHTS (Current Best Practices):
${researchContext}

Use these research insights to inform your task execution and ensure you're following current best practices.
</research_insights>` : ''}

<methodology>
Follow this structured approach:

STEP 1: REASONING & ANALYSIS
- Analyze the task requirements
- Consider the project context and artifacts
- Plan your approach
${researchContext ? '- Review research insights for best practices' : ''}
${toolsInfo ? '- Identify which tools can help with this task' : ''}

STEP 2: EXECUTION
- Execute the task following your plan
- Use tools when appropriate
- Generate code, reviews, or deliverables as needed

STEP 3: VALIDATION
- Verify the output meets requirements
- Ensure quality and completeness
- Check for errors or issues
</methodology>

<output_format>
Format your response as follows:

<!-- REASONING_START -->
[Your thinking process, analysis, approach, and decision-making steps for this task]
<!-- REASONING_END -->

[Your actual task output - code, review, or other deliverables]

<!-- ISSUES_START -->
[If you detect any issues, report them here as JSON array:
[
  {
    "type": "security" | "performance" | "quality" | "best-practice" | "bug" | "compliance" | "requirement",
    "severity": "critical" | "high" | "medium" | "low",
    "title": "Brief issue title",
    "description": "Detailed description of the issue",
    "location": "File/line reference if applicable",
    "recommendation": "How to fix the issue"
  }
]
Only include critical or high severity issues to avoid creating too many tasks.]
<!-- ISSUES_END -->

If you need to generate code, provide full, working code.
If you need to review, provide a structured review.
</output_format>

<quality_gates>
Before finalizing, verify:
✓ Output addresses all task requirements
✓ Code is complete and functional (if applicable)
✓ Review is structured and comprehensive (if applicable)
✓ Best practices are followed
✓ Quality standards are met
</quality_gates>

<output_instructions>
Execute the task following the methodology above. Provide your reasoning first, then deliver the actual output.

BEGIN TASK EXECUTION:
</output_instructions>`;

  return {
    prompt: enhancedPrompt,
    systemInstruction: `You are ${agent.name || agent.role}. ${agent.goal || 'Execute tasks efficiently.'}`
  };
}

/**
 * Enhance research prompt for deep research feature
 */
export function enhanceResearchPrompt(query: string): EnhancedPromptResult {
  // This uses the same structure as the deep-research endpoint
  // The full implementation is already in gemini.routes.ts
  // This is a placeholder for consistency
  return {
    prompt: query,
    systemInstruction: 'You are a senior software architect and technical researcher.'
  };
}

/**
 * Enhance prompt enhancement prompt (Polish feature)
 */
export function enhancePromptEnhancementPrompt(input: string, useInternet: boolean = false): EnhancedPromptResult {
  // This uses the same structure as the enhance-prompt endpoint
  // The full implementation is already in gemini.routes.ts
  // This is a placeholder for consistency
  return {
    prompt: input,
    systemInstruction: 'You are an elite technical writer and requirements analyst.'
  };
}

/**
 * Structure agent-to-agent communication messages
 * Ensures all agent communications follow a clear, structured format
 */
export interface AgentCommunicationContext {
  sender: {
    role: string;
    name?: string;
    goal?: string;
  };
  receiver: {
    role: string;
    name?: string;
    goal?: string;
  };
  messageType: 'draft' | 'critique' | 'refinement' | 'request' | 'response' | 'handoff';
  context?: {
    task?: {
      id: string;
      title: string;
      description: string;
    };
    project?: {
      id: string;
      name: string;
      phase: string;
    };
    artifacts?: Array<{
      id: string;
      title: string;
      type: string;
    }>;
    previousMessages?: Array<{
      sender: string;
      message: string;
      timestamp: number;
    }>;
  };
  content: string; // Raw message content to structure
}

/**
 * Structure an agent communication message
 * Formats messages using XML-style delimiters and clear sections
 */
export function structureAgentCommunication(
  context: AgentCommunicationContext
): string {
  const {
    sender,
    receiver,
    messageType,
    context: commContext,
    content
  } = context;

  // Determine communication purpose based on type
  const purposeMap: Record<string, string> = {
    'draft': 'Share work-in-progress for review',
    'critique': 'Provide feedback and suggestions',
    'refinement': 'Request or provide improvements',
    'request': 'Request assistance or information',
    'response': 'Respond to a request',
    'handoff': 'Transfer work to another agent'
  };

  const purpose = purposeMap[messageType] || 'Communicate information';

  // Build structured message
  const structuredMessage = `<agent_communication>
<header>
FROM: ${sender.name || sender.role} (${sender.role})
TO: ${receiver.name || receiver.role} (${receiver.role})
TYPE: ${messageType.toUpperCase()}
PURPOSE: ${purpose}
TIMESTAMP: ${new Date().toISOString()}
</header>

${commContext?.task ? `<task_context>
Task ID: ${commContext.task.id}
Task Title: ${commContext.task.title}
Task Description: ${commContext.task.description}
</task_context>` : ''}

${commContext?.project ? `<project_context>
Project: ${commContext.project.name}
Current Phase: ${commContext.project.phase}
</project_context>` : ''}

${commContext?.artifacts && commContext.artifacts.length > 0 ? `<relevant_artifacts>
${commContext.artifacts.map(a => `- ${a.title} (${a.type})`).join('\n')}
</relevant_artifacts>` : ''}

${commContext?.previousMessages && commContext.previousMessages.length > 0 ? `<conversation_history>
${commContext.previousMessages.slice(-3).map(m => `[${m.sender}]: ${m.message}`).join('\n')}
</conversation_history>` : ''}

<message_content>
${content}
</message_content>

${messageType === 'request' ? `<action_required>
Please provide:
- [Specific information or action needed]
- [Expected format or deliverable]
- [Deadline if applicable]
</action_required>` : ''}

${messageType === 'critique' ? `<feedback_structure>
STRENGTHS:
- [What was done well]

AREAS FOR IMPROVEMENT:
- [Specific issues or concerns]

RECOMMENDATIONS:
- [Actionable suggestions]
</feedback_structure>` : ''}

${messageType === 'handoff' ? `<handoff_details>
WORK COMPLETED:
- [Summary of completed work]

WORK TRANSFERRED:
- [What is being handed off]

NEXT STEPS:
- [What the receiver should do next]

DEPENDENCIES:
- [Any dependencies or prerequisites]
</handoff_details>` : ''}

${messageType === 'response' ? `<response_structure>
REQUEST ADDRESSED:
- [What was requested]

RESPONSE:
- [The actual response content]

ADDITIONAL INFORMATION:
- [Any extra context or resources]
</response_structure>` : ''}

</agent_communication>`;

  return structuredMessage;
}

/**
 * Format reasoning as structured agent communication
 */
export function structureReasoningMessage(
  agent: { role: string; name?: string },
  reasoning: string,
  task?: { id: string; title: string; description: string }
): string {
  return structureAgentCommunication({
    sender: {
      role: agent.role,
      name: agent.name
    },
    receiver: {
      role: agent.role, // Self-reflection
      name: agent.name
    },
    messageType: 'draft',
    context: task ? {
      task: {
        id: task.id,
        title: task.title,
        description: task.description
      }
    } : undefined,
    content: reasoning
  });
}

/**
 * Format evaluation feedback as structured agent communication
 */
export function structureEvaluationMessage(
  evaluatorRole: string,
  agent: { role: string; name?: string },
  evaluation: {
    score: number;
    reasoning: string;
    criteria: string[];
  },
  task?: { id: string; title: string }
): string {
  const feedbackContent = `Quality Score: ${evaluation.score}/100

Evaluation Criteria:
${evaluation.criteria.map(c => `- ${c}`).join('\n')}

Detailed Reasoning:
${evaluation.reasoning}

${evaluation.score < 70 ? '⚠️ Quality Gate: Output requires improvement before proceeding.' : '✅ Quality Gate: Output meets standards.'}`;

  return structureAgentCommunication({
    sender: {
      role: evaluatorRole
    },
    receiver: {
      role: agent.role,
      name: agent.name
    },
    messageType: 'critique',
    context: task ? {
      task: {
        id: task.id,
        title: task.title,
        description: ''
      }
    } : undefined,
    content: feedbackContent
  });
}

