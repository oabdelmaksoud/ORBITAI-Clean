/**
 * NLP Service
 * Natural Language Processing for content analysis and generation
 * Uses spaCy concepts and transformer models
 */

import { logger } from '../utils/logger.js';

export interface ContentAnalysis {
  summary: string;
  keywords: string[];
  entities: Entity[];
  sentiment: Sentiment;
  topics: Topic[];
  readability: ReadabilityScore;
}

export interface Entity {
  text: string;
  label: string; // PERSON, ORG, PRODUCT, etc.
  confidence: number;
}

export interface Sentiment {
  score: number; // -1 to 1
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface Topic {
  topic: string;
  relevance: number;
}

export interface ReadabilityScore {
  score: number; // 0-100
  level: 'very-easy' | 'easy' | 'medium' | 'hard' | 'very-hard';
  averageSentenceLength: number;
  averageWordLength: number;
}

class NLPService {
  /**
   * Summarize content
   */
  async summarize(content: string, maxLength: number = 200): Promise<string> {
    try {
      // Simple extractive summarization (can be enhanced with LLM)
      const sentences = this.splitIntoSentences(content);

      if (sentences.length <= 3) {
        return content;
      }

      // Score sentences by word frequency
      const wordFreq = this.calculateWordFrequency(content);
      const sentenceScores = sentences.map(sentence => ({
        sentence,
        score: this.scoreSentence(sentence, wordFreq)
      }));

      // Select top sentences
      sentenceScores.sort((a, b) => b.score - a.score);
      const summarySentences = sentenceScores
        .slice(0, Math.ceil(sentences.length * 0.3))
        .map(s => s.sentence)
        .join(' ');

      return summarySentences.length > maxLength
        ? summarySentences.substring(0, maxLength) + '...'
        : summarySentences;
    } catch (error: unknown) {
      logger.error('Failed to summarize content:', error);
      // Fallback: return first N characters
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
  }

  /**
   * Extract keywords from content
   */
  async extractKeywords(content: string, maxKeywords: number = 10): Promise<string[]> {
    try {
      // Remove stop words and extract meaningful terms
      const words = this.tokenize(content);
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
        'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
      ]);

      // Filter and count
      const wordCounts = new Map<string, number>();
      words.forEach(word => {
        const lower = word.toLowerCase();
        if (lower.length > 3 && !stopWords.has(lower)) {
          wordCounts.set(lower, (wordCounts.get(lower) || 0) + 1);
        }
      });

      // Sort by frequency and return top keywords
      const sorted = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);

      return sorted;
    } catch (error: unknown) {
      logger.error('Failed to extract keywords:', error);
      return [];
    }
  }

  /**
   * Extract entities from content
   */
  async extractEntities(content: string): Promise<Entity[]> {
    try {
      // Simple entity extraction (can be enhanced with NER models)
      const entities: Entity[] = [];

      // Extract potential entities (capitalized words/phrases)
      const words = this.tokenize(content);
      const capitalized = words.filter(w => /^[A-Z]/.test(w) && w.length > 2);

      // Group consecutive capitalized words (likely entities)
      let currentEntity = '';
      let startIndex = 0;

      for (let i = 0; i < words.length; i++) {
        if (/^[A-Z]/.test(words[i]) && words[i].length > 2) {
          if (currentEntity) {
            currentEntity += ' ' + words[i];
          } else {
            currentEntity = words[i];
            startIndex = i;
          }
        } else {
          if (currentEntity && currentEntity.split(' ').length >= 1) {
            entities.push({
              text: currentEntity,
              label: this.inferEntityType(currentEntity),
              confidence: 0.7
            });
          }
          currentEntity = '';
        }
      }

      // Add final entity if exists
      if (currentEntity) {
        entities.push({
          text: currentEntity,
          label: this.inferEntityType(currentEntity),
          confidence: 0.7
        });
      }

      // Remove duplicates
      const unique = Array.from(
        new Map(entities.map(e => [e.text.toLowerCase(), e])).values()
      );

      return unique;
    } catch (error: unknown) {
      logger.error('Failed to extract entities:', error);
      return [];
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(content: string): Promise<Sentiment> {
    try {
      // Simple sentiment analysis (can be enhanced with ML models)
      const positiveWords = new Set([
        'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
        'perfect', 'best', 'love', 'like', 'happy', 'pleased', 'satisfied',
        'success', 'successful', 'improve', 'improved', 'better', 'best'
      ]);

      const negativeWords = new Set([
        'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike',
        'unhappy', 'disappointed', 'failed', 'failure', 'problem', 'issue',
        'error', 'bug', 'broken', 'worse', 'poor'
      ]);

      const words = this.tokenize(content.toLowerCase());
      let positiveCount = 0;
      let negativeCount = 0;

      words.forEach(word => {
        if (positiveWords.has(word)) positiveCount++;
        if (negativeWords.has(word)) negativeCount++;
      });

      const total = positiveCount + negativeCount;
      let score = 0;
      let label: 'positive' | 'neutral' | 'negative' = 'neutral';

      if (total > 0) {
        score = (positiveCount - negativeCount) / total;
        if (score > 0.2) label = 'positive';
        else if (score < -0.2) label = 'negative';
      }

      return {
        score,
        label,
        confidence: Math.abs(score)
      };
    } catch (error: unknown) {
      logger.error('Failed to analyze sentiment:', error);
      return {
        score: 0,
        label: 'neutral',
        confidence: 0
      };
    }
  }

  /**
   * Analyze content comprehensively
   */
  async analyzeContent(content: string): Promise<ContentAnalysis> {
    try {
      const [summary, keywords, entities, sentiment, topics, readability] = await Promise.all([
        this.summarize(content),
        this.extractKeywords(content),
        this.extractEntities(content),
        this.analyzeSentiment(content),
        this.extractTopics(content),
        this.calculateReadability(content)
      ]);

      return {
        summary,
        keywords,
        entities,
        sentiment,
        topics,
        readability
      };
    } catch (error: unknown) {
      logger.error('Failed to analyze content:', error);
      throw error;
    }
  }

  /**
   * Extract topics from content
   */
  private async extractTopics(content: string): Promise<Topic[]> {
    // Simple topic extraction based on keyword frequency
    const keywords = await this.extractKeywords(content, 20);
    const wordFreq = this.calculateWordFrequency(content);

    return keywords.map(keyword => ({
      topic: keyword,
      relevance: (wordFreq.get(keyword.toLowerCase()) || 0) / 10
    })).slice(0, 5);
  }

  /**
   * Calculate readability score
   */
  private calculateReadability(content: string): ReadabilityScore {
    const sentences = this.splitIntoSentences(content);
    const words = this.tokenize(content);

    const averageSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
    const averageWordLength = words.length > 0
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length
      : 0;

    // Simple Flesch-like score (simplified)
    let score = 100;
    score -= averageSentenceLength * 1.5;
    score -= (averageWordLength - 4) * 10;
    score = Math.max(0, Math.min(100, score));

    let level: ReadabilityScore['level'] = 'medium';
    if (score >= 80) level = 'very-easy';
    else if (score >= 60) level = 'easy';
    else if (score >= 40) level = 'medium';
    else if (score >= 20) level = 'hard';
    else level = 'very-hard';

    return {
      score,
      level,
      averageSentenceLength,
      averageWordLength
    };
  }

  // Helper methods
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private calculateWordFrequency(text: string): Map<string, number> {
    const words = this.tokenize(text);
    const freq = new Map<string, number>();
    words.forEach(word => {
      freq.set(word, (freq.get(word) || 0) + 1);
    });
    return freq;
  }

  private scoreSentence(sentence: string, wordFreq: Map<string, number>): number {
    const words = this.tokenize(sentence);
    return words.reduce((score, word) => score + (wordFreq.get(word) || 0), 0);
  }

  private inferEntityType(text: string): string {
    // Simple heuristics (can be enhanced with NER)
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(text)) return 'PERSON';
    if (text.includes('Inc') || text.includes('Corp') || text.includes('Ltd')) return 'ORG';
    if (text.includes('API') || text.includes('System') || text.includes('Service')) return 'PRODUCT';
    return 'MISC';
  }
}

export const nlpService = new NLPService();
