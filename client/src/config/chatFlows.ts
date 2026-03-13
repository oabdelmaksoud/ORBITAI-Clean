/**
 * Guided Chat Flow Configuration
 * Defines the questions and flow for helping users describe their project ideas
 */

export interface ChatQuestion {
  id: string;
  question: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'select' | 'multi-select';
  options?: string[];
  required: boolean;
  skipable: boolean;
  followUpQuestions?: ChatQuestion[];
}

export interface ChatFlow {
  id: string;
  name: string;
  description: string;
  questions: ChatQuestion[];
}

export const PROJECT_DISCOVERY_FLOW: ChatFlow = {
  id: 'project-discovery',
  name: 'Project Discovery',
  description: 'Help users describe their project idea step by step',
  questions: [
    {
      id: 'project-type',
      question: 'What type of project are you building?',
      placeholder: 'e.g., Web app, Mobile app, API, Desktop app, Game, etc.',
      type: 'select',
      options: [
        'Web Application',
        'Mobile Application',
        'Desktop Application',
        'API/Backend Service',
        'Game',
        'Data Analytics Tool',
        'E-commerce Platform',
        'Social Media Platform',
        'Content Management System',
        'Other'
      ],
      required: false,
      skipable: true
    },
    {
      id: 'target-audience',
      question: 'Who is your target audience?',
      placeholder: 'e.g., Small businesses, Individual consumers, Enterprise clients, Developers, etc.',
      type: 'text',
      required: false,
      skipable: true
    },
    {
      id: 'main-features',
      question: 'What are the main features you want?',
      placeholder: 'List the key features separated by commas',
      type: 'textarea',
      required: false,
      skipable: true
    },
    {
      id: 'tech-preferences',
      question: 'Do you have any technology preferences?',
      placeholder: 'e.g., React, Python, Node.js, MongoDB, etc. (or leave blank)',
      type: 'text',
      required: false,
      skipable: true
    },
    {
      id: 'timeline',
      question: 'What is your timeline?',
      placeholder: 'e.g., 1 month, 3 months, 6 months, etc.',
      type: 'select',
      options: [
        '1-2 weeks',
        '1 month',
        '2-3 months',
        '3-6 months',
        '6-12 months',
        'No specific timeline'
      ],
      required: false,
      skipable: true
    },
    {
      id: 'budget',
      question: 'What is your budget range?',
      placeholder: 'e.g., $100, $500, $1000, etc.',
      type: 'select',
      options: [
        'Under $100',
        '$100 - $500',
        '$500 - $1,000',
        '$1,000 - $5,000',
        '$5,000+',
        'No specific budget'
      ],
      required: false,
      skipable: true
    },
    {
      id: 'additional-requirements',
      question: 'Any additional requirements or constraints?',
      placeholder: 'e.g., Must be accessible, Needs to work offline, Requires real-time updates, etc.',
      type: 'textarea',
      required: false,
      skipable: true
    }
  ]
};

/**
 * Get the next question in the flow based on current answers
 */
export function getNextQuestion(
  flow: ChatFlow,
  currentQuestionId: string | null,
  answers: Record<string, any>
): ChatQuestion | null {
  const questions = flow.questions;
  
  if (!currentQuestionId) {
    // Start with first question
    return questions[0] || null;
  }
  
  const currentIndex = questions.findIndex(q => q.id === currentQuestionId);
  if (currentIndex === -1 || currentIndex === questions.length - 1) {
    return null; // Flow complete
  }
  
  return questions[currentIndex + 1];
}

/**
 * Check if we have enough information to generate a project preview
 */
export function hasEnoughInformation(
  flow: ChatFlow,
  answers: Record<string, any>
): boolean {
  // Require at least 4 questions answered for meaningful project understanding
  const answeredCount = Object.keys(answers).filter(key => {
    const value = answers[key];
    return value !== null && value !== undefined && value !== '';
  }).length;
  
  // Also check that we have at least project type and main features
  const hasProjectType = !!answers['project-type'];
  const hasMainFeatures = !!answers['main-features'];
  
  return answeredCount >= 4 && (hasProjectType || hasMainFeatures);
}

/**
 * Generate a summary of collected information
 */
export function generateSummary(answers: Record<string, any>): string {
  const parts: string[] = [];
  
  if (answers['project-type']) {
    parts.push(`Project Type: ${answers['project-type']}`);
  }
  if (answers['target-audience']) {
    parts.push(`Target Audience: ${answers['target-audience']}`);
  }
  if (answers['main-features']) {
    parts.push(`Main Features: ${answers['main-features']}`);
  }
  if (answers['tech-preferences']) {
    parts.push(`Tech Preferences: ${answers['tech-preferences']}`);
  }
  if (answers['timeline']) {
    parts.push(`Timeline: ${answers['timeline']}`);
  }
  if (answers['budget']) {
    parts.push(`Budget: ${answers['budget']}`);
  }
  if (answers['additional-requirements']) {
    parts.push(`Additional Requirements: ${answers['additional-requirements']}`);
  }
  
  return parts.join('\n');
}




