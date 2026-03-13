import {
  parseMentions,
  extractMentionedUsernames,
  formatMentions,
  validateMentionSyntax,
  findMentionAtCursor,
  checkIncompleteMention,
  completeMention
} from '../mentionParser';

describe('mentionParser', () => {
  describe('parseMentions', () => {
    it('should parse single mention', () => {
      const text = 'Hello @john, how are you?';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].username).toBe('john');
      expect(mentions[0].position).toBe(6);
      expect(mentions[0].length).toBe(5);
    });

    it('should parse multiple mentions', () => {
      const text = 'Hey @john and @jane, check this out';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0].username).toBe('john');
      expect(mentions[1].username).toBe('jane');
    });

    it('should not parse @@ as mention', () => {
      const text = 'Email me at test@@example.com';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(0);
    });

    it('should parse usernames with numbers', () => {
      const text = 'Hello @user123';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].username).toBe('user123');
    });

    it('should parse usernames with underscores', () => {
      const text = 'Hey @john_doe';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].username).toBe('john_doe');
    });

    it('should parse usernames with hyphens', () => {
      const text = 'Hi @john-doe';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].username).toBe('john-doe');
    });

    it('should not parse invalid characters', () => {
      const text = 'Invalid @user!name';
      const mentions = parseMentions(text);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].username).toBe('user');
    });

    it('should handle empty text', () => {
      expect(parseMentions('')).toHaveLength(0);
    });

    it('should handle text without mentions', () => {
      expect(parseMentions('Hello world')).toHaveLength(0);
    });
  });

  describe('extractMentionedUsernames', () => {
    it('should extract unique usernames', () => {
      const text = '@john @jane @john @bob';
      const usernames = extractMentionedUsernames(text);
      
      expect(usernames).toEqual(['john', 'jane', 'bob']);
    });

    it('should return empty array for no mentions', () => {
      expect(extractMentionedUsernames('No mentions here')).toEqual([]);
    });
  });

  describe('formatMentions', () => {
    it('should format mentions using custom formatter', () => {
      const text = 'Hello @john';
      const formatted = formatMentions(text, (username) => `[${username}]`);
      
      expect(formatted).toBe('Hello [john]');
    });

    it('should format multiple mentions', () => {
      const text = '@john and @jane';
      const formatted = formatMentions(text, (username) => `@${username.toUpperCase()}`);
      
      expect(formatted).toBe('@JOHN and @JANE');
    });
  });

  describe('validateMentionSyntax', () => {
    it('should validate correct mention', () => {
      const result = validateMentionSyntax('Hello @john');
      expect(result.valid).toBe(true);
    });

    it('should reject empty username', () => {
      const result = validateMentionSyntax('Hello @');
      expect(result.valid).toBe(false);
    });

    it('should reject too long username', () => {
      const longUsername = 'a'.repeat(31);
      const result = validateMentionSyntax(`@${longUsername}`);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('30 characters');
    });

    it('should reject invalid characters', () => {
      const result = validateMentionSyntax('@user!name');
      expect(result.valid).toBe(false);
    });
  });

  describe('findMentionAtCursor', () => {
    it('should find mention at cursor position', () => {
      const text = 'Hello @john, how are you?';
      const mention = findMentionAtCursor(text, 8);
      
      expect(mention).not.toBeNull();
      expect(mention?.username).toBe('john');
    });

    it('should return null if cursor not in mention', () => {
      const text = 'Hello @john, how are you?';
      const mention = findMentionAtCursor(text, 0);
      
      expect(mention).toBeNull();
    });

    it('should return null for empty text', () => {
      expect(findMentionAtCursor('', 0)).toBeNull();
    });
  });

  describe('checkIncompleteMention', () => {
    it('should detect incomplete mention', () => {
      const result = checkIncompleteMention('Hello @jo');
      
      expect(result.hasIncompleteMention).toBe(true);
      expect(result.partialUsername).toBe('jo');
      expect(result.startPosition).toBe(6);
    });

    it('should not detect complete mention as incomplete', () => {
      const result = checkIncompleteMention('Hello @john ');
      
      expect(result.hasIncompleteMention).toBe(false);
    });

    it('should return false for no @ symbol', () => {
      const result = checkIncompleteMention('Hello world');
      
      expect(result.hasIncompleteMention).toBe(false);
    });

    it('should handle empty string', () => {
      const result = checkIncompleteMention('');
      
      expect(result.hasIncompleteMention).toBe(false);
    });
  });

  describe('completeMention', () => {
    it('should complete mention with username', () => {
      const text = 'Hello @jo';
      const completed = completeMention(text, 6, 'john');
      
      expect(completed).toBe('Hello @john ');
    });

    it('should replace incomplete mention at end', () => {
      const text = 'Hey @a';
      const completed = completeMention(text, 4, 'alice');
      
      expect(completed).toBe('Hey @alice ');
    });

    it('should preserve text after cursor', () => {
      const text = '@jo and @jane';
      const completed = completeMention(text, 0, 'john');
      
      expect(completed).toBe('@john  and @jane');
    });
  });
});
