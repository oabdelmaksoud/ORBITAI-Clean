import { test, expect } from '@playwright/test';

test.describe('Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
  });

  test('should create a new workspace', async ({ page }) => {
    // Navigate to workspace selector
    await page.click('[data-testid="workspace-selector"]');
    await page.click('text=Create Workspace');
    
    // Fill in workspace details
    await page.locator('input[name="name"]').fill('Test Workspace');
    await page.locator('textarea[name="description"]').fill('A test workspace for E2E testing');
    
    // Submit
    await page.click('button:has-text("Create")');
    
    // Verify workspace created
    await expect(page.locator('text=Test Workspace')).toBeVisible({ timeout: 5000 });
  });

  test('should switch between workspaces', async ({ page }) => {
    // Assume multiple workspaces exist
    await page.click('[data-testid="workspace-selector"]');
    
    // Click on different workspace
    await page.click('[data-testid="workspace-item"]:nth-child(2)');
    
    // Verify workspace changed
    await expect(page.locator('[data-testid="current-workspace"]')).not.toContainText('Previous Workspace');
  });

  test('should invite member to workspace', async ({ page }) => {
    // Go to workspace settings
    await page.click('[data-testid="workspace-selector"]');
    await page.click('button[aria-label="Workspace settings"]');
    
    // Navigate to members tab
    await page.click('text=Members');
    
    // Invite new member
    await page.click('button:has-text("Invite Member")');
    await page.locator('input[name="email"]').fill('newuser@example.com');
    await page.locator('select[name="role"]').selectOption('member');
    await page.click('button:has-text("Send Invite")');
    
    // Verify invitation sent
    await expect(page.locator('text=Invitation sent')).toBeVisible();
  });

  test('should update member role', async ({ page }) => {
    // Go to workspace settings
    await page.click('[data-testid="workspace-selector"]');
    await page.click('button[aria-label="Workspace settings"]');
    await page.click('text=Members');
    
    // Find member and change role
    const memberRow = page.locator('[data-testid="member-row"]:first-child');
    await memberRow.locator('select[name="role"]').selectOption('admin');
    
    // Verify role updated
    await expect(page.locator('text=Role updated')).toBeVisible();
  });

  test('should remove member from workspace', async ({ page }) => {
    // Go to workspace settings
    await page.click('[data-testid="workspace-selector"]');
    await page.click('button[aria-label="Workspace settings"]');
    await page.click('text=Members');
    
    // Remove member
    const memberRow = page.locator('[data-testid="member-row"]:last-child');
    await memberRow.locator('button[aria-label="Remove member"]').click();
    
    // Confirm removal
    await page.click('button:has-text("Remove")');
    
    // Verify member removed
    await expect(page.locator('text=Member removed')).toBeVisible();
  });

  test('should update workspace settings', async ({ page }) => {
    // Go to workspace settings
    await page.click('[data-testid="workspace-selector"]');
    await page.click('button[aria-label="Workspace settings"]');
    
    // Update settings
    await page.locator('input[name="name"]').fill('Updated Workspace Name');
    await page.locator('textarea[name="description"]').fill('Updated description');
    
    // Toggle settings
    await page.click('button[aria-label="Toggle member invites"]');
    await page.click('button[aria-label="Toggle require approval"]');
    
    // Save
    await page.click('button:has-text("Save Changes")');
    
    // Verify saved
    await expect(page.locator('text=Settings saved')).toBeVisible();
  });

  test('should delete workspace', async ({ page }) => {
    // Go to workspace settings
    await page.click('[data-testid="workspace-selector"]');
    await page.click('button[aria-label="Workspace settings"]');
    
    // Navigate to danger zone
    await page.click('text=Danger Zone');
    
    // Delete workspace
    await page.click('button:has-text("Delete this workspace")');
    
    // Confirm twice
    await page.click('button:has-text("Delete")');
    await page.click('button:has-text("Delete")');
    
    // Verify redirected to workspace list
    await expect(page).toHaveURL(/.*\/workspaces/);
  });

  test('should show workspace members list', async ({ page }) => {
    // Open workspace selector
    await page.click('[data-testid="workspace-selector"]');
    
    // View members
    await page.click('button[aria-label="View members"]');
    
    // Verify members displayed
    await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
    const memberCount = await page.locator('[data-testid="member-item"]').count();
    expect(memberCount).toBeGreaterThan(0);
  });

  test('should filter workspaces by search', async ({ page }) => {
    // Open workspace selector
    await page.click('[data-testid="workspace-selector"]');
    
    // Search
    await page.locator('input[placeholder*="Search"]').fill('Test');
    
    // Verify filtered results
    const workspaces = await page.locator('[data-testid="workspace-item"]').count();
    expect(workspaces).toBeGreaterThan(0);
  });

  test('should display workspace role badges', async ({ page }) => {
    // Go to workspace settings
    await page.click('[data-testid="workspace-selector"]');
    await page.click('button[aria-label="Workspace settings"]');
    await page.click('text=Members');
    
    // Verify role badges
    await expect(page.locator('text=Owner')).toBeVisible();
    await expect(page.locator('text=Admin')).toBeVisible();
    await expect(page.locator('text=Member')).toBeVisible();
  });

  test('should show workspace usage stats', async ({ page }) => {
    // Go to workspace dashboard
    await page.click('[data-testid="workspace-selector"]');
    
    // Check stats cards
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Members')).toBeVisible();
    await expect(page.locator('text=Tasks')).toBeVisible();
  });
});
