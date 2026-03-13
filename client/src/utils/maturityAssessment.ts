import { ProjectPreview } from '@src/services/geminiService';
import { Artifact } from '@orbitai/shared';

export interface MaturityCriteria {
  clarity: number;
  feasibility: number;
  completeness: number;
  standards: number;
  research: number;
}

export interface MaturityAssessment {
  overall: number;
  level: 'concept' | 'developing' | 'mature' | 'production-ready';
  criteria: MaturityCriteria;
  color: string;
  bgColor: string;
  borderColor: string;
  // AI-powered enhancements
  aiInsights?: {
    clarity?: string;
    feasibility?: string;
    completeness?: string;
    standards?: string;
    research?: string;
  };
  aiRecommendations?: string[];
  aiReasoning?: string;
  isAIPowered?: boolean;
}

export interface MaturityAssessmentInput {
  projectName?: string;
  projectDescription?: string;
  conversationMessages?: Array<{ sender: string; text: string }>;
  projectPreview?: ProjectPreview | null;
  artifacts?: Artifact[];
  selectedStandards?: string[];
  useInternet?: boolean;
  hasResearchFindings?: boolean;
  activeAgentsCount?: number;
  // NEW: Idea-based scoring inputs
  ideas?: Array<{
    id: string;
    label: string;
    description?: string;
    category?: string;
    connections?: string[];
    isEnriched?: boolean; // Has been enriched with online research
  }>;
}

/**
 * Calculate maturity assessment based on project state
 * 
 * CRITERIA BREAKDOWN:
 * 
 * 1. CLARITY (0-100 points)
 *    - Project name exists: +20 points
 *    - 3+ user messages: +20 points
 *    - 5+ user messages: +10 points
 *    - Average message length > 50 chars: +20 points
 *    - Average message length > 100 chars: +10 points
 *    - Project description exists and detailed: +20 points
 *    - Agents involved: +40 points (Agents clarify ambiguity)
 * 
 * 2. FEASIBILITY (0-100 points)
 *    - Project preview exists: +40 points
 *    - Architecture diagram exists: +30 points
 *    - Wireframe/prototype exists: +20 points
 *    - Theme selected: +10 points
 *    - Agents involved: +40 points (Agents validate feasibility)
 * 
 * 3. COMPLETENESS (0-100 points)
 *    - Executive summary exists: +25 points
 *    - Wireframe exists: +25 points
 *    - Architecture diagram exists: +25 points
 *    - Theme defined: +15 points
 *    - Additional artifacts: +10 points
 *    - Agents involved: +40 points (Agents ensure completeness)
 * 
 * 4. STANDARDS (0-100 points)
 *    - 1+ standards selected: +30 points
 *    - 2+ standards selected: +20 points
 *    - 3+ standards selected: +20 points
 *    - 5+ standards selected: +30 points
 *    - Agents involved: +30 points (Agents enforce standards)
 * 
 * 5. RESEARCH (0-100 points)
 *    - Internet research enabled: +40 points
 *    - Research findings present: +30 points
 *    - Multiple research sources: +30 points
 *    - Agents involved: +40 points (Agents perform deep research)
 */
export function calculateMaturityAssessment(input: MaturityAssessmentInput): MaturityAssessment {
  const criteria: MaturityCriteria = {
    clarity: 0,
    feasibility: 0,
    completeness: 0,
    standards: 0,
    research: 0
  };

  const hasAgents = (input.activeAgentsCount || 0) > 0;
  const agentBoost = hasAgents ? 40 : 0; // Significant boost when agents are involved

  // Get qualified ideas (excluding welcome bubble)
  const qualifiedIdeas = input.ideas?.filter(i => i.id !== 'welcome-bubble') || [];
  const ideaCount = qualifiedIdeas.length;

  // 1. CLARITY Assessment
  if (input.projectName && input.projectName.trim().length > 0) {
    criteria.clarity += 20;
  }

  if (input.projectDescription && input.projectDescription.trim().length > 50) {
    criteria.clarity += 20;
  }

  if (input.conversationMessages) {
    const userMessages = input.conversationMessages.filter(m => m.sender === 'user');
    if (userMessages.length >= 3) criteria.clarity += 20;
    if (userMessages.length >= 5) criteria.clarity += 10;

    const avgMessageLength = userMessages.reduce((sum, m) => sum + m.text.length, 0) / (userMessages.length || 1);
    if (avgMessageLength > 50) criteria.clarity += 20;
    if (avgMessageLength > 100) criteria.clarity += 10;
  }

  // Baseline: Having ANY qualified ideas shows progress (generous for ideation phase)
  if (ideaCount >= 1) criteria.clarity += 20; // Baseline for any idea work
  if (ideaCount >= 3) criteria.clarity += 15; // Growing ideation
  if (ideaCount >= 5) criteria.clarity += 15; // Substantial ideation

  // Ideas with descriptions add to clarity
  if (input.ideas) {
    const ideasWithDesc = input.ideas.filter(i => i.description && i.description.length > 10).length;
    if (ideasWithDesc >= 2) criteria.clarity += 15;
    if (ideasWithDesc >= 4) criteria.clarity += 10;
  }

  if (hasAgents) criteria.clarity += agentBoost;
  criteria.clarity = Math.min(criteria.clarity, 100);

  // 2. FEASIBILITY Assessment
  // Ideation-phase baseline: ideas demonstrate feasibility thinking
  if (input.projectPreview) {
    criteria.feasibility += 40;
  } else {
    // Generous baseline for ideation phase - ideas show feasibility exploration
    if (ideaCount >= 1) criteria.feasibility += 30; // Strong baseline for any idea work
    if (ideaCount >= 3) criteria.feasibility += 15; // Growing ideation
    if (ideaCount >= 5) criteria.feasibility += 15; // Substantial ideation
    if (hasAgents) criteria.feasibility += 10; // Additional agent boost
  }

  if (input.artifacts) {
    const hasArchitecture = input.artifacts.some(a =>
      a.type === 'design' && a.title.toLowerCase().includes('architecture')
    );
    if (hasArchitecture) criteria.feasibility += 30;

    const hasWireframe = input.artifacts.some(a =>
      (a.type === 'design' || a.type === 'build') && (a.title.toLowerCase().includes('wireframe') || a.title.toLowerCase().includes('prototype'))
    );
    if (hasWireframe) criteria.feasibility += 20;
  }

  if (input.projectPreview?.architectureDiagram) {
    criteria.feasibility += 10;
  }

  // Ideas covering multiple categories = better feasibility analysis
  if (input.ideas) {
    const categories = new Set(input.ideas.map(i => i.category).filter(Boolean));
    if (categories.size >= 2) criteria.feasibility += 15;
    if (categories.size >= 4) criteria.feasibility += 15;
  }

  if (hasAgents && input.projectPreview) criteria.feasibility += agentBoost; // Agent boost only with preview
  criteria.feasibility = Math.min(criteria.feasibility, 100);

  // 3. COMPLETENESS Assessment
  // In ideation phase (no preview yet), give baseline points for conversation depth
  if (input.projectPreview?.summary) {
    criteria.completeness += 25;
  } else if (hasAgents && input.conversationMessages && input.conversationMessages.length >= 5) {
    // Agents discussing the project is a form of completeness
    criteria.completeness += 20; // Baseline for thorough agent discussion
  }

  if (input.projectPreview?.wireframeCode) {
    criteria.completeness += 25;
  }

  if (input.projectPreview?.architectureDiagram) {
    criteria.completeness += 25;
  }

  if (input.projectPreview?.recommendedMethodology) {
    criteria.completeness += 15;
  }

  if (input.artifacts && input.artifacts.length > 0) {
    criteria.completeness += 10;
  }

  // Conversation depth contributes to completeness even without artifacts (generous for ideation)
  if (input.conversationMessages) {
    const userMsgs = input.conversationMessages.filter(m => m.sender === 'user');
    const totalChars = userMsgs.reduce((sum, m) => sum + m.text.length, 0);
    if (totalChars >= 50) criteria.completeness += 25; // Basic conversation
    if (totalChars >= 200) criteria.completeness += 15; // Substantive discussion
    if (totalChars >= 400) criteria.completeness += 10; // Detailed requirements

    const totalMessages = input.conversationMessages.length;
    if (totalMessages >= 6) criteria.completeness += 15;
    else if (totalMessages >= 3) criteria.completeness += 10;
  }

  // High idea count with connections = more complete ideation
  if (ideaCount >= 3) criteria.completeness += 15;
  if (ideaCount >= 6) criteria.completeness += 10;
  if (input.ideas) {
    const ideasWithConnections = input.ideas.filter(i => i.connections && i.connections.length > 0).length;
    if (ideasWithConnections >= 2) criteria.completeness += 10;
  }

  if (hasAgents) criteria.completeness += agentBoost;
  criteria.completeness = Math.min(criteria.completeness, 100);

  // 4. STANDARDS Assessment
  const standardsCount = input.selectedStandards?.length || 0;
  if (standardsCount >= 1) criteria.standards += 30;
  if (standardsCount >= 2) criteria.standards += 20;
  if (standardsCount >= 3) criteria.standards += 20;
  if (standardsCount >= 5) criteria.standards += 30;

  // Baseline: Give ideation-phase projects a strong starting point (can improve by selecting standards)
  if (standardsCount === 0 && ideaCount >= 1) {
    criteria.standards += 40; // Strong baseline for ideation phase
  }

  // Requirement category ideas contribute to standards
  if (input.ideas) {
    const reqIdeas = input.ideas.filter(i => i.category === 'requirement' || i.category === 'constraint').length;
    if (reqIdeas >= 1) criteria.standards += 10;
    if (reqIdeas >= 3) criteria.standards += 10;
  }

  if (hasAgents) criteria.standards += 30; // Agents suggest/enforce standards
  criteria.standards = Math.min(criteria.standards, 100);

  // 5. RESEARCH Assessment
  if (input.useInternet) {
    criteria.research += 40;
  }

  if (input.hasResearchFindings) {
    criteria.research += 30;
  }

  if (input.conversationMessages) {
    const hasResearchInMessages = input.conversationMessages.some(m =>
      m.text.includes('Research Findings') ||
      m.text.includes('**Research Findings:**') ||
      m.text.toLowerCase().includes('research')
    );
    if (hasResearchInMessages) {
      criteria.research += 30;
    }
  }

  // Ideas represent research/thinking work - give strong baseline
  if (ideaCount >= 1) criteria.research += 25; // Any idea = research done
  if (ideaCount >= 3) criteria.research += 15;
  if (ideaCount >= 5) criteria.research += 10;

  // Enriched ideas (with online research) boost research score
  if (input.ideas) {
    const enrichedIdeas = input.ideas.filter(i => i.isEnriched).length;
    if (enrichedIdeas >= 1) criteria.research += 15;
    if (enrichedIdeas >= 3) criteria.research += 15;
  }

  if (hasAgents) criteria.research += agentBoost;
  criteria.research = Math.min(criteria.research, 100);

  // Calculate overall maturity (weighted average)
  const overall = Math.round(
    (criteria.clarity * 0.25) +
    (criteria.feasibility * 0.30) +
    (criteria.completeness * 0.25) +
    (criteria.standards * 0.10) +
    (criteria.research * 0.10)
  );

  // Determine maturity level
  let level: 'concept' | 'developing' | 'mature' | 'production-ready' = 'concept';
  let color = 'text-slate-400';
  let bgColor = 'bg-slate-100';
  let borderColor = 'border-slate-200';

  if (overall >= 80) {
    level = 'production-ready';
    color = 'text-emerald-600';
    bgColor = 'bg-emerald-50';
    borderColor = 'border-emerald-300';
  } else if (overall >= 60) {
    level = 'mature';
    color = 'text-blue-600';
    bgColor = 'bg-blue-50';
    borderColor = 'border-blue-300';
  } else if (overall >= 40) {
    level = 'developing';
    color = 'text-amber-600';
    bgColor = 'bg-amber-50';
    borderColor = 'border-amber-300';
  }

  return {
    overall,
    level,
    criteria,
    color,
    bgColor,
    borderColor
  };
}

/**
 * Get AI-powered maturity assessment from backend
 */
export async function getAIMaturityAssessment(input: MaturityAssessmentInput): Promise<MaturityAssessment> {
  try {
    // Check if user is a guest - skip API call and use rule-based assessment
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    const isGuestToken = token && (token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3);

    if (isGuestToken) {
      // For guest users, skip API call and use rule-based assessment directly
      return calculateMaturityAssessment(input);
    }

    // Use apiUrlNormalizer to ensure correct port (3002) even with cached code
    const { getApiBaseUrl } = await import('./apiUrlNormalizer');
    const API_BASE_URL = getApiBaseUrl();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/maturity-assessment/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`AI assessment failed: ${response.statusText}`);
    }

    const result = await response.json();
    const aiAssessment = result.data.assessment;

    // Convert AI assessment to MaturityAssessment format
    const assessment: MaturityAssessment = {
      overall: aiAssessment.overall,
      level: aiAssessment.level,
      criteria: aiAssessment.criteria,
      aiInsights: aiAssessment.insights,
      aiRecommendations: aiAssessment.recommendations,
      aiReasoning: aiAssessment.reasoning,
      isAIPowered: true,
      // Set colors based on level
      color: aiAssessment.overall >= 80 ? 'text-emerald-600' :
        aiAssessment.overall >= 60 ? 'text-blue-600' :
          aiAssessment.overall >= 40 ? 'text-amber-600' : 'text-slate-400',
      bgColor: aiAssessment.overall >= 80 ? 'bg-emerald-50' :
        aiAssessment.overall >= 60 ? 'bg-blue-50' :
          aiAssessment.overall >= 40 ? 'bg-amber-50' : 'bg-slate-100',
      borderColor: aiAssessment.overall >= 80 ? 'border-emerald-300' :
        aiAssessment.overall >= 60 ? 'border-blue-300' :
          aiAssessment.overall >= 40 ? 'border-amber-300' : 'border-slate-200'
    };

    return assessment;
  } catch (error: any) {
    // Suppress warnings for guest users (expected behavior - they use rule-based assessment)
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    const isGuestToken = token && (token.startsWith('guest-token-') || !token.includes('.') || token.split('.').length !== 3);

    if (!isGuestToken && !error.suppressLogging && !error.isGuestError) {
      console.warn('AI maturity assessment failed, falling back to rule-based:', error);
    }
    // Fallback to rule-based assessment
    return calculateMaturityAssessment(input);
  }
}

/**
 * Calculate hybrid maturity assessment (combines rule-based and AI)
 * Uses AI when available, falls back to rule-based
 */
export async function calculateHybridMaturityAssessment(
  input: MaturityAssessmentInput,
  useAI: boolean = true
): Promise<MaturityAssessment> {
  // Try AI first if enabled and project has enough content
  if (useAI && input.conversationMessages && input.conversationMessages.length > 0) {
    try {
      return await getAIMaturityAssessment(input);
    } catch (error) {
      console.warn('AI assessment failed, using rule-based:', error);
    }
  }

  // Fallback to rule-based
  return calculateMaturityAssessment(input);
}

/**
 * Get criteria description for tooltips/help text
 */
export function getCriteriaDescription(criterion: keyof MaturityCriteria): string {
  const descriptions: Record<keyof MaturityCriteria, string> = {
    clarity: 'Measures how clear and well-defined the project requirements are. Based on project name, description quality, and conversation depth.',
    feasibility: 'Assesses whether the project is technically achievable. Based on architecture diagrams, wireframes, and technical planning.',
    completeness: 'Evaluates how complete the project documentation is. Includes executive summary, wireframes, architecture, and artifacts.',
    standards: 'Measures adherence to quality standards and best practices. Based on number of selected quality standards.',
    research: 'Assesses the depth of research and market analysis. Based on internet research usage and research findings.'
  };

  return descriptions[criterion];
}

