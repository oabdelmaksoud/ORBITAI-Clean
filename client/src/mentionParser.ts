/**
 * Mention Parser Utility
 * Parses, validates, and manipulates @mentions in text
 */

export interface Mention {
  username: string;
  position: number;
  length: number;
}

export interface MentionValidation {
  valid: boolean;
  error?: string;
}

export interface IncompleteMentionResult {
  hasIncompleteMention: boolean;
  partialUsername?: string;
  startPosition?: number;
}

const MENTION_REGEX = /(?<![@\w])@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;
const MAX_USERNAME_LENGTH = 30;

/**
 * Parse all @mentions from text
 */
export function parseMentions(text: string): Mention[] {
  if (!text) return [];

  const mentions: Mention[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      position: match.index,
      length: match[0].length,
    });
  }

  return mentions;
}

/**
 * Extract unique usernames from text
 */
export function extractMentionedUsernames(text: string): string[] {
  const mentions = parseMentions(text);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const mention of mentions) {
    if (!seen.has(mention.username)) {
      seen.add(mention.username);
      result.push(mention.username);
    }
  }

  return result;
}

/**
 * Format mentions in text using a custom formatter
 */
export function formatMentions(
  text: string,
  formatter: (username: string) => string
): string {
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  return text.replace(regex, (_match, username) => formatter(username));
}

/**
 * Validate mention syntax in text
 */
export function validateMentionSyntax(text: string): MentionValidation {
  const atIndex = text.lastIndexOf('@');
  if (atIndex === -1) {
    return { valid: true };
  }

  const fullAfterAt = text.slice(atIndex + 1);

  if (!fullAfterAt || fullAfterAt.length === 0) {
    return { valid: false, error: 'Username cannot be empty' };
  }

  // Extract the username portion (stops at whitespace or end)
  const usernameCandidate = fullAfterAt.split(/\s/)[0];

  if (usernameCandidate.length > MAX_USERNAME_LENGTH) {
    return {
      valid: false,
      error: `Username must be 30 characters or less`,
    };
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(usernameCandidate)) {
    return { valid: false, error: 'Username contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Find mention at a specific cursor position
 */
export function findMentionAtCursor(
  text: string,
  cursorPosition: number
): Mention | null {
  if (!text) return null;

  const mentions = parseMentions(text);

  for (const mention of mentions) {
    const start = mention.position;
    const end = mention.position + mention.length;
    if (cursorPosition >= start && cursorPosition <= end) {
      return mention;
    }
  }

  return null;
}

/**
 * Check if text ends with an incomplete mention
 */
export function checkIncompleteMention(text: string): IncompleteMentionResult {
  if (!text) {
    return { hasIncompleteMention: false };
  }

  // Look for @ at the end of text that might be incomplete
  const match = text.match(/@([a-zA-Z0-9_-]*)$/);

  if (!match) {
    return { hasIncompleteMention: false };
  }

  const partialUsername = match[1];
  const startPosition = text.length - match[0].length;

  return {
    hasIncompleteMention: true,
    partialUsername,
    startPosition,
  };
}

/**
 * Complete an incomplete mention with a full username
 */
export function completeMention(
  text: string,
  mentionStart: number,
  fullUsername: string
): string {
  const before = text.slice(0, mentionStart);
  const afterMention = text.slice(mentionStart).replace(/^@[a-zA-Z0-9_-]*/, '');
  return `${before}@${fullUsername} ${afterMention}`;
}
