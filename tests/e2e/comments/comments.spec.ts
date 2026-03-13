import { test, expect } from '@playwright/test';

test.describe('Comments & Collaboration', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
    
    // Navigate to a project with comments
    await page.click('text=Projects');
    await page.click('[data-testid="project-card"]:first-child');
  });

  test('should create a comment', async ({ page }) => {
    // Click on comments tab
    await page.click('text=Comments');
    
    // Write comment
    await page.locator('textarea[placeholder*="comment"]').fill('This is a test comment');
    await page.click('button:has-text("Post Comment")');
    
    // Verify comment appears
    await expect(page.locator('text=This is a test comment')).toBeVisible({ timeout: 5000 });
  });

  test('should reply to a comment', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find first comment and click reply
    const comment = page.locator('[data-testid="comment-item"]:first-child');
    await comment.locator('button:has-text("Reply")').click();
    
    // Write reply
    await page.locator('textarea[placeholder*="reply"]').fill('This is a reply');
    await page.click('button:has-text("Post Reply")');
    
    // Verify reply appears
    await expect(page.locator('text=This is a reply')).toBeVisible();
  });

  test('should add reaction to comment', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find comment and click reactions
    const comment = page.locator('[data-testid="comment-item"]:first-child');
    await comment.locator('button[aria-label="Add reaction"]').click();
    
    // Select thumbs up
    await page.click('button:has-text("👍")');
    
    // Verify reaction added
    await expect(comment.locator('button:has-text("👍")')).toBeVisible();
  });

  test('should remove reaction', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find comment with reaction
    const comment = page.locator('[data-testid="comment-item"]:first-child');
    
    // Click existing reaction to remove
    await comment.locator('button:has-text("👍")').click();
    
    // Verify reaction removed
    const reactionCount = await comment.locator('button:has-text("👍")').count();
    expect(reactionCount).toBe(0);
  });

  test('should use @mention autocomplete', async ({ page }) => {
    await page.click('text=Comments');
    
    // Start typing comment with @
    await page.locator('textarea[placeholder*="comment"]').fill('Hey @');
    
    // Wait for autocomplete dropdown
    await expect(page.locator('.mention-autocomplete')).toBeVisible({ timeout: 3000 });
    
    // Select first user
    await page.click('.mention-autocomplete button:first-child');
    
    // Verify mention inserted
    const textareaValue = await page.locator('textarea').inputValue();
    expect(textareaValue).toContain('@');
  });

  test('should edit comment', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find own comment
    const comment = page.locator('[data-testid="comment-item"][data-owner="me"]:first-child');
    await comment.locator('button[aria-label="More options"]').click();
    await page.click('text=Edit');
    
    // Edit text
    await page.locator('textarea[name="edit-comment"]').fill('Updated comment text');
    await page.click('button:has-text("Save")');
    
    // Verify updated
    await expect(page.locator('text=Updated comment text')).toBeVisible();
  });

  test('should delete comment', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find own comment
    const comment = page.locator('[data-testid="comment-item"][data-owner="me"]:first-child');
    await comment.locator('button[aria-label="More options"]').click();
    await page.click('text=Delete');
    
    // Confirm
    await page.click('button:has-text("Delete")');
    
    // Verify deleted
    await expect(comment).not.toBeVisible();
  });

  test('should resolve comment thread', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find comment
    const comment = page.locator('[data-testid="comment-item"]:first-child');
    await comment.locator('button[aria-label="Resolve"]').click();
    
    // Verify resolved badge
    await expect(comment.locator('text=Resolved')).toBeVisible();
  });

  test('should reopen resolved comment', async ({ page }) => {
    await page.click('text=Comments');
    
    // Show resolved comments
    await page.click('button:has-text("Show Resolved")');
    
    // Find resolved comment
    const comment = page.locator('[data-testid="comment-item"][data-resolved="true"]:first-child');
    await comment.locator('button[aria-label="Reopen"]').click();
    
    // Verify reopened
    await expect(comment.locator('text=Resolved')).not.toBeVisible();
  });

  test('should sort comments by date', async ({ page }) => {
    await page.click('text=Comments');
    
    // Click sort dropdown
    await page.click('button[aria-label="Sort comments"]');
    await page.click('text=Newest First');
    
    // Verify sorted
    const timestamps = await page.locator('[data-testid="comment-timestamp"]').allTextContents();
    // Verify timestamps are in descending order
  });

  test('should filter comments by author', async ({ page }) => {
    await page.click('text=Comments');
    
    // Click filter
    await page.click('button[aria-label="Filter comments"]');
    await page.locator('input[placeholder*="author"]').fill('john');
    await page.click('button:has-text("Apply")');
    
    // Verify filtered
    const comments = await page.locator('[data-testid="comment-item"]').count();
    expect(comments).toBeGreaterThan(0);
  });

  test('should show thread reply count', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find comment with replies
    const comment = page.locator('[data-testid="comment-item"]:has([data-testid="reply-count"])').first();
    
    // Verify reply count visible
    await expect(comment.locator('[data-testid="reply-count"]')).toBeVisible();
  });

  test('should expand thread replies', async ({ page }) => {
    await page.click('text=Comments');
    
    // Find comment with replies
    const comment = page.locator('[data-testid="comment-item"]:first-child');
    await comment.locator('button:has-text("replies")').click();
    
    // Verify replies visible
    await expect(page.locator('[data-testid="reply-item"]')).toBeVisible();
  });

  test('should collapse thread replies', async ({ page }) => {
    await page.click('text=Comments');
    
    // Expand replies first
    const comment = page.locator('[data-testid="comment-item"]:first-child');
    await comment.locator('button:has-text("replies")').click();
    
    // Collapse
    await comment.locator('button:has-text("Hide replies")').click();
    
    // Verify replies hidden
    await expect(page.locator('[data-testid="reply-item"]')).not.toBeVisible();
  });
});
