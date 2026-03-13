/**
 * Sub-Project Detection Service
 * Analyzes brainstorming ideas to detect potential sub-projects (webapp, mobile app, website, etc.)
 */

import { logger } from '../utils/logger.js';

export interface DetectedSubProject {
  id: string;
  name: string;
  type: 'webapp' | 'mobile-app' | 'website' | 'api' | 'desktop-app' | 'other';
  confidence: number; // 0-1
  matchedIdeas: string[]; // Idea IDs that matched this type
  keywords: string[]; // Keywords that triggered detection
}

export interface SubProjectDetectionInput {
  ideas: Array<{
    id: string;
    label: string;
    description?: string;
    tags?: string[];
  }>;
  topic?: string;
}

export class SubProjectDetector {
  // Pattern matching rules for different project types
  private readonly patterns = {
    'webapp': [
      /\b(web\s*app|webapp|web\s*application|web\s*platform|saas|web\s*based|online\s*platform|web\s*service)\b/i,
      /\b(spa|single\s*page|react|vue|angular|next\.?js|nuxt)\b/i,
      /\b(dashboard|admin\s*panel|web\s*interface|web\s*portal)\b/i,
    ],
    'mobile-app': [
      /\b(mobile\s*app|ios\s*app|android\s*app|iphone|ipad|smartphone|tablet)\b/i,
      /\b(react\s*native|flutter|swift|kotlin|ios|android)\b/i,
      /\b(app\s*store|play\s*store|mobile\s*application)\b/i,
    ],
    'website': [
      /\b(website|web\s*site|landing\s*page|static\s*site|blog|portfolio)\b/i,
      /\b(html|css|wordpress|squarespace|wix)\b/i,
      /\b(informational|brochure|marketing\s*site)\b/i,
    ],
    'api': [
      /\b(api|rest\s*api|graphql|backend\s*api|microservice)\b/i,
      /\b(endpoint|service\s*layer|backend\s*service)\b/i,
      /\b(serverless|lambda|webhook)\b/i,
    ],
    'desktop-app': [
      /\b(desktop\s*app|windows\s*app|mac\s*app|linux\s*app)\b/i,
      /\b(electron|qt|gtk|native\s*desktop)\b/i,
      /\b(standalone\s*application|client\s*application)\b/i,
    ],
  };

  private readonly typeLabels = {
    'webapp': 'Web Application',
    'mobile-app': 'Mobile App',
    'website': 'Website',
    'api': 'API/Backend',
    'desktop-app': 'Desktop App',
    'other': 'Other',
  };

  /**
   * Detect sub-projects from brainstorming ideas
   */
  detectSubProjects(input: SubProjectDetectionInput): DetectedSubProject[] {
    const { ideas, topic } = input;
    
    // Combine all text for analysis
    const allText = [
      topic || '',
      ...ideas.map(i => `${i.label} ${i.description || ''} ${(i.tags || []).join(' ')}`),
    ].join(' ').toLowerCase();

    const detected: Map<string, DetectedSubProject> = new Map();

    // Check each project type
    for (const [type, patterns] of Object.entries(this.patterns)) {
      const matchedIdeas: string[] = [];
      const matchedKeywords: string[] = [];
      let matchCount = 0;

      // Check each pattern
      for (const pattern of patterns) {
        if (pattern.test(allText)) {
          matchCount++;
          const matches = allText.match(new RegExp(pattern.source, 'gi'));
          if (matches) {
            matchedKeywords.push(...matches.slice(0, 3)); // Limit to first 3 matches
          }
        }
      }

      // Check individual ideas
      for (const idea of ideas) {
        const ideaText = `${idea.label} ${idea.description || ''} ${(idea.tags || []).join(' ')}`.toLowerCase();
        for (const pattern of patterns) {
          if (pattern.test(ideaText) && !matchedIdeas.includes(idea.id)) {
            matchedIdeas.push(idea.id);
            break;
          }
        }
      }

      // Calculate confidence
      // Base confidence on number of patterns matched and ideas matched
      const patternConfidence = Math.min(matchCount / patterns.length, 1);
      const ideaConfidence = Math.min(matchedIdeas.length / Math.max(ideas.length, 1), 1);
      const confidence = (patternConfidence * 0.6 + ideaConfidence * 0.4);

      // Only include if confidence is above threshold
      if (confidence > 0.3 && (matchCount > 0 || matchedIdeas.length > 0)) {
        detected.set(type, {
          id: `subproject-${type}-${Date.now()}`,
          name: this.typeLabels[type as keyof typeof this.typeLabels],
          type: type as DetectedSubProject['type'],
          confidence: Math.round(confidence * 100) / 100,
          matchedIdeas,
          keywords: [...new Set(matchedKeywords)].slice(0, 5), // Unique keywords, max 5
        });
      }
    }

    // Sort by confidence (highest first)
    return Array.from(detected.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Limit to top 5
  }

  /**
   * Get recommended sub-project type based on topic
   */
  recommendFromTopic(topic: string): DetectedSubProject['type'] | null {
    const topicLower = topic.toLowerCase();
    
    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(topicLower)) {
          return type as DetectedSubProject['type'];
        }
      }
    }
    
    return null;
  }
}

export const subProjectDetector = new SubProjectDetector();


