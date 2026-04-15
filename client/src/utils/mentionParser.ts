/**
 * Mention Parser Utilities
 * Parses @mentions from text and provides utilities for working with mentions
 */

export interface Mention {
  username: string;
  position: number;
  length: number;
  userId?: string;
}

/**
 * Regex pattern for matching @mentions
 * Matches: @username, @username123, @user_name
 * Does not match: @@username, @username@domain
 */
const MENTION_REGEX = /(?<![@a-zA-Z0-9_-])@([a-zA-Z0-9_-]{1,30})(?=\s|$|[^a-zA-Z0-9_-])/g;

/**
 * Parse all mentions from text
 * @param text - Text to parse for mentions
 * @returns Array of Mention objects
 */
export function parseMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  let match;
  
  // Reset regex lastIndex
  MENTION_REGEX.lastIndex = 0;
  
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      position: match.index,
      length: match[0].length
    });
  }
  
  return mentions;
}

/**
 * Extract unique usernames from text
 * @param text - Text to parse for mentions
 * @returns Array of unique usernames (without @ symbol)
 */
export function extractMentionedUsernames(text: string): string[] {
  const mentions = parseMentions(text);
  const uniqueUsernames = [...new Set(mentions.map(m => m.username))];
  return uniqueUsernames;
}

/**
 * Replace mentions in text with formatted version
 * @param text - Original text with @mentions
 * @param formatter - Function to format each mention
 * @returns Text with formatted mentions
 */
export function formatMentions(
  text: string,
  formatter: (username: string) => string
): string {
  let result = text;
  const mentions = parseMentions(text);
  
  // Process mentions in reverse order to maintain positions
  for (let i = mentions.length - 1; i >= 0; i--) {
    const mention = mentions[i];
    const formatted = formatter(mention.username);
    result = result.substring(0, mention.position) + 
             formatted + 
             result.substring(mention.position + mention.length);
  }
  
  return result;
}

/**
 * Convert mentions to HTML with links
 * @param text - Text with @mentions
 * @param getUserProfileUrl - Function to get user profile URL from username
 * @returns HTML string with linked mentions
 */
export function mentionsToHtml(
  text: string,
  getUserProfileUrl: (username: string) => string
): string {
  return formatMentions(text, (username) => {
    const url = getUserProfileUrl(username);
    return `<a href="${url}" class="mention" data-username="${username}">@${username}</a>`;
  });
}

/**
 * Validate mention syntax
 * @param text - Text to validate
 * @returns Object with valid boolean and error message if invalid
 */
export function validateMentionSyntax(text: string): {
  valid: boolean;
  error?: string;
} {
  // If the text is just '@' or ends with '@' without a username
  if (text === '@' || text.endsWith(' @')) {
    return {
      valid: false,
      error: 'Username must be at least 1 character long'
    };
  }
  
  // Extract potential mentions that aren't matched by the regex due to length or invalid chars
  const allPotentialMentions = text.match(/@[^\s]*/g) || [];

  for (const potential of allPotentialMentions) {
    const username = potential.substring(1);
    
    // Skip if empty, handled above
    if (username.length === 0) continue;

    if (username.length > 30) {
      return {
        valid: false,
        error: 'Username cannot exceed 30 characters'
      };
    }
    
    // Check for invalid characters
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return {
        valid: false,
        error: 'Username can only contain letters, numbers, underscores, and hyphens'
      };
    }
  }

  return { valid: true };
}

/**
 * Find mention at cursor position
 * @param text - Full text
 * @param cursorPosition - Current cursor position
 * @returns Mention object if cursor is within a mention, null otherwise
 */
export function findMentionAtCursor(text: string, cursorPosition: number): Mention | null {
  const mentions = parseMentions(text);
  
  for (const mention of mentions) {
    const mentionEnd = mention.position + mention.length;
    
    if (cursorPosition >= mention.position && cursorPosition <= mentionEnd) {
      return mention;
    }
  }
  
  return null;
}

/**
 * Check if text ends with incomplete mention (for autocomplete)
 * @param text - Text to check
 * @returns Object with hasIncompleteMention boolean and partial username if true
 */
export function checkIncompleteMention(text: string): {
  hasIncompleteMention: boolean;
  partialUsername?: string;
  startPosition?: number;
} {
  // Find last @ symbol
  const lastAtIndex = text.lastIndexOf('@');
  
  if (lastAtIndex === -1) {
    return { hasIncompleteMention: false };
  }
  
  // Check if there's a space after @ (incomplete mention)
  const textAfterAt = text.substring(lastAtIndex + 1);
  
  // If there's a space or newline, it's not an incomplete mention
  if (/\s/.test(textAfterAt)) {
    return { hasIncompleteMention: false };
  }
  
  // Extract partial username
  const match = textAfterAt.match(/^([a-zA-Z0-9_-]*)/);
  
  if (match) {
    return {
      hasIncompleteMention: true,
      partialUsername: match[1],
      startPosition: lastAtIndex
    };
  }
  
  return { hasIncompleteMention: false };
}

/**
 * Replace incomplete mention with full username
 * @param text - Original text
 * @param startPosition - Position of @ symbol
 * @param username - Username to insert
 * @returns Text with completed mention
 */
export function completeMention(
  text: string,
  startPosition: number,
  username: string
): string {
  const beforeMention = text.substring(0, startPosition);
  const afterMention = text.substring(startPosition).replace(/^@[a-zA-Z0-9_-]*/, `@${username} `);
  
  return beforeMention + afterMention;
}

/**
 * Get all mention positions for highlighting
 * @param text - Text to parse
 * @returns Array of start and end positions
 */
export function getMentionPositions(text: string): Array<{ start: number; end: number }> {
  const mentions = parseMentions(text);
  return mentions.map(m => ({
    start: m.position,
    end: m.position + m.length
  }));
}
