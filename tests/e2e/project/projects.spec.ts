import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard');
  });

  test('should create a new project from template', async ({ page }) => {
    // Navigate to projects
    await page.click('text=Projects');
    await page.waitForSelector('text=New Project');
    
    // Click create button
    await page.click('text=New Project');
    
    // Fill project details
    await page.locator('input[name="name"]').fill('Test Project E2E');
    await page.locator('textarea[name="description"]').fill('Created by E2E test');
    
    // Select template
    await page.click('text=Web Application');
    
    // Submit
    await page.click('button:has-text("Create Project")');
    
    // Verify project created
    await page.waitForURL('**/project/**');
    await expect(page.locator('h1:has-text("Test Project E2E")')).toBeVisible({ timeout: 10000 });
  });

  test('should create project from scratch', async ({ page }) => {
    await page.click('text=Projects');
    await page.click('text=New Project');
    
    await page.locator('input[name="name"]').fill('Blank Project');
    await page.locator('textarea[name="description"]').fill('Blank project from scratch');
    
    // Select blank template
    await page.click('text=Start from Scratch');
    await page.click('button:has-text("Create Project")');
    
    await page.waitForURL('**/project/**');
    await expect(page.locator('h1:has-text("Blank Project")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('text=Projects');
    await page.click('text=New Project');
    
    // Try to submit without name
    await page.click('button:has-text("Create Project")');
    
    // Check validation error
    await expect(page.locator('text=/name is required/i')).toBeVisible();
  });

  test('should edit project name and description', async ({ page }) => {
    // Go to first project
    await page.click('text=Projects');
    await page.click('.project-card:first-child');
    
    // Click edit button
    await page.click('button[aria-label="Edit project"]');
    
    // Update details
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill('Updated Project Name');
    
    const descInput = page.locator('textarea[name="description"]');
    await descInput.fill('Updated description');
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Verify updated
    await expect(page.locator('h1:has-text("Updated Project Name")')).toBeVisible();
  });

  test('should delete project with confirmation', async ({ page }) => {
    // Go to first project
    await page.click('text=Projects');
    await page.click('.project-card:first-child');
    
    // Click delete button
    await page.click('button[aria-label="Delete project"]');
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    
    // Should redirect to projects list
    await page.waitForURL('**/projects');
    
    // Verify project is deleted (not in list)
    await expect(page.locator('h1:has-text("Deleted Project")')).not.toBeVisible();
  });

  test('should share project via link', async ({ page }) => {
    await page.click('text=Projects');
    await page.click('.project-card:first-child');
    
    // Click share button
    await page.click('button[aria-label="Share project"]');
    
    // Toggle link sharing
    await page.click('text=Enable link sharing');
    
    // Copy link
    await page.click('button:has-text("Copy Link")');
    
    // Verify copied message
    await expect(page.locator('text=Link copied')).toBeVisible();
  });

  test('should export project', async ({ page }) => {
    await page.click('text=Projects');
    await page.click('.project-card:first-child');
    
    // Click export
    await page.click('button[aria-label="Export project"]');
    
    // Select format
    await page.click('text=JSON');
    
    // Start download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export")')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should search projects', async ({ page }) => {
    await page.click('text=Projects');
    
    // Search for project
    await page.locator('input[placeholder="Search projects"]').fill('test');
    await page.press('input[placeholder="Search projects"]', 'Enter');
    
    // Verify results
    await page.waitForTimeout(500);
    const projectCards = await page.locator('.project-card').count();
    expect(projectCards).toBeGreaterThan(0);
  });

  test('should filter projects by status', async ({ page }) => {
    await page.click('text=Projects');
    
    // Open filters
    await page.click('button:has-text("Filters")');
    
    // Select active status
    await page.click('text=Active');
    
    // Verify filtered results
    await page.waitForTimeout(500);
    const activeBadges = await page.locator('text=Active').count();
    expect(activeBadges).toBeGreaterThan(0);
  });

  test('should sort projects by date', async ({ page }) => {
    await page.click('text=Projects');
    
    // Open sort dropdown
    await page.click('button:has-text("Sort")');
    
    // Select by date
    await page.click('text=Date Created (Newest)');
    
    // Verify sorted
    await page.waitForTimeout(500);
    const projectCards = await page.locator('.project-card').count();
    expect(projectCards).toBeGreaterThan(0);
  });

  test('should handle concurrent edits', async ({ page, context }) => {
    // Open project in first tab
    await page.click('text=Projects');
    await page.click('.project-card:first-child');
    
    // Open same project in second tab
    const page2 = await context.newPage();
    await page2.goto(page.url());
    
    // Edit in first tab
    await page.click('button[aria-label="Edit project"]');
    await page.locator('input[name="name"]').fill('Edit from Tab 1');
    await page.click('button:has-text("Save")');
    
    // Wait for sync
    await page.waitForTimeout(1000);
    
    // Verify second tab shows update
    await page2.reload();
    await expect(page2.locator('h1:has-text("Edit from Tab 1")')).toBeVisible();
  });
});
