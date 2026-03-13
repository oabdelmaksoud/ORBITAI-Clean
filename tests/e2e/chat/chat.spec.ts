import { test, expect } from '@playwright/test';

test.describe('Chat & AI Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
  });

  test('should send a message in chat', async ({ page }) => {
    // Navigate to chat
    await page.click('text=Chat');
    
    // Type message
    await page.locator('textarea[placeholder*="message"]').fill('Hello, this is a test message');
    
    // Send
    await page.click('button:has-text("Send")');
    
    // Verify message appears
    await expect(page.locator('text=Hello, this is a test message')).toBeVisible({ timeout: 5000 });
  });

  test('should show AI response streaming', async ({ page }) => {
    await page.click('text=Chat');
    
    // Send message that triggers AI response
    await page.locator('textarea[placeholder*="message"]').fill('Write a hello world function');
    await page.click('button:has-text("Send")');
    
    // Wait for streaming indicator
    await expect(page.locator('text=/thinking|generating/i')).toBeVisible({ timeout: 3000 });
    
    // Wait for response to complete
    await expect(page.locator('.ai-response')).toBeVisible({ timeout: 15000 });
  });

  test('should render markdown in responses', async ({ page }) => {
    await page.click('text=Chat');
    
    await page.locator('textarea[placeholder*="message"]').fill('Show me some markdown formatting');
    await page.click('button:has-text("Send")');
    
    // Wait for response
    await page.waitForSelector('.ai-response', { timeout: 15000 });
    
    // Check for markdown elements
    const hasBold = await page.locator('.ai-response strong').count();
    const hasCode = await page.locator('.ai-response code').count();
    expect(hasBold + hasCode).toBeGreaterThan(0);
  });

  test('should support @mentions', async ({ page }) => {
    await page.click('text=Chat');
    
    // Type @ to trigger autocomplete
    await page.locator('textarea[placeholder*="message"]').fill('Hey @');
    
    // Wait for autocomplete dropdown
    await expect(page.locator('.mention-autocomplete')).toBeVisible({ timeout: 3000 });
    
    // Select first user
    await page.click('.mention-autocomplete button:first-child');
    
    // Verify mention is inserted
    const textareaValue = await page.locator('textarea[placeholder*="message"]').inputValue();
    expect(textareaValue).toContain('@');
  });

  test('should navigate autocomplete with keyboard', async ({ page }) => {
    await page.click('text=Chat');
    
    await page.locator('textarea[placeholder*="message"]').fill('@');
    await expect(page.locator('.mention-autocomplete')).toBeVisible();
    
    // Press arrow down
    await page.press('textarea', 'ArrowDown');
    
    // Press Enter to select
    await page.press('textarea', 'Enter');
    
    // Verify mention inserted
    const textareaValue = await page.locator('textarea').inputValue();
    expect(textareaValue).toMatch(/@[a-z]+/i);
  });

  test('should copy code blocks', async ({ page }) => {
    await page.click('text=Chat');
    
    // Request code
    await page.locator('textarea[placeholder*="message"]').fill('Write a Python function');
    await page.click('button:has-text("Send")');
    
    // Wait for code block
    await page.waitForSelector('pre code', { timeout: 15000 });
    
    // Click copy button
    await page.click('button[aria-label="Copy code"]');
    
    // Verify copied message
    await expect(page.locator('text=/copied/i')).toBeVisible();
  });

  test('should handle Enter to send, Shift+Enter for newline', async ({ page }) => {
    await page.click('text=Chat');
    
    const textarea = page.locator('textarea[placeholder*="message"]');
    
    // Type with Shift+Enter for newline
    await textarea.fill('Line 1');
    await textarea.press('Shift+Enter');
    await textarea.type('Line 2');
    
    // Verify newline was added
    const value = await textarea.inputValue();
    expect(value).toContain('\n');
    
    // Press Enter to send
    await textarea.press('Enter');
    
    // Verify message sent
    await expect(page.locator('text=Line 1')).toBeVisible({ timeout: 5000 });
  });

  test('should support attachments', async ({ page }) => {
    await page.click('text=Chat');
    
    // Click attachment button
    await page.click('button[aria-label="Attach file"]');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./tests/fixtures/test-image.png');
    
    // Verify file preview
    await expect(page.locator('.attachment-preview')).toBeVisible({ timeout: 3000 });
  });

  test('should show typing indicator', async ({ page }) => {
    await page.click('text=Chat');
    
    // Send message
    await page.locator('textarea').fill('Hello');
    await page.click('button:has-text("Send")');
    
    // Look for typing indicator
    const typingIndicator = await page.locator('text=/AI is typing|thinking/i').count();
    expect(typingIndicator).toBeGreaterThan(0);
  });

  test('should maintain chat history', async ({ page }) => {
    await page.click('text=Chat');
    
    // Send unique message
    const uniqueMessage = `Test message ${Date.now()}`;
    await page.locator('textarea').fill(uniqueMessage);
    await page.click('button:has-text("Send")');
    
    // Wait for message to appear
    await expect(page.locator(`text=${uniqueMessage}`)).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Verify message is still there
    await expect(page.locator(`text=${uniqueMessage}`)).toBeVisible({ timeout: 10000 });
  });

  test('should clear chat history', async ({ page }) => {
    await page.click('text=Chat');
    
    // Send message
    await page.locator('textarea').fill('Temporary message');
    await page.click('button:has-text("Send")');
    
    // Wait for message
    await expect(page.locator('text=Temporary message')).toBeVisible();
    
    // Clear chat
    await page.click('button[aria-label="Clear chat"]');
    await page.click('button:has-text("Clear")');
    
    // Verify message is gone
    await expect(page.locator('text=Temporary message')).not.toBeVisible();
  });
});
